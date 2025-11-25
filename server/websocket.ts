import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { parse as parseCookie } from "cookie";
import { createHmac, timingSafeEqual } from "crypto";
import { sessionStore } from "./replitAuth";
import { storage } from "./storage";
import { log } from "./app";

interface AuthenticatedSocket extends WebSocket {
  userId: string;
  projectId?: number;
  organizationId?: number;
  isAlive: boolean;
  isAuthenticated: boolean;
}

interface BroadcastMessage {
  type: string;
  payload: any;
  timestamp: number;
  userId: string;
}

type EventType =
  | "task-created"
  | "task-updated"
  | "task-deleted"
  | "risk-created"
  | "risk-updated"
  | "risk-deleted"
  | "issue-created"
  | "issue-updated"
  | "issue-deleted"
  | "stakeholder-created"
  | "stakeholder-updated"
  | "stakeholder-deleted"
  | "cost-item-created"
  | "cost-item-updated"
  | "cost-item-deleted"
  | "project-updated"
  | "user-joined"
  | "user-left"
  | "cursor-move"
  | "comment-added";

function sign(val: string, secret: string): string {
  return createHmac("sha256", secret).update(val).digest("base64").replace(/=+$/, "");
}

function unsign(signedVal: string, secret: string): string | false {
  const tentativeValue = signedVal.slice(0, signedVal.lastIndexOf("."));
  const expectedInput = tentativeValue + "." + sign(tentativeValue, secret);
  const expectedBuffer = Buffer.from(expectedInput);
  const inputBuffer = Buffer.from(signedVal);
  
  if (expectedBuffer.length !== inputBuffer.length) {
    return false;
  }
  
  return timingSafeEqual(expectedBuffer, inputBuffer) ? tentativeValue : false;
}

function parseSessionId(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  
  const cookies = parseCookie(cookieHeader);
  const sessionCookie = cookies["connect.sid"];
  
  if (!sessionCookie) return null;
  
  const decoded = decodeURIComponent(sessionCookie);
  
  if (decoded.startsWith("s:")) {
    const unsigned = unsign(decoded.slice(2), secret);
    return unsigned || null;
  }
  
  return sessionCookie;
}

async function getSessionUser(sessionId: string): Promise<{ id: string; claims: any } | null> {
  return new Promise((resolve) => {
    sessionStore.get(sessionId, (err, session) => {
      if (err || !session) {
        resolve(null);
        return;
      }
      
      const passport = (session as any).passport;
      if (passport?.user?.claims?.sub) {
        resolve({
          id: passport.user.claims.sub,
          claims: passport.user.claims,
        });
      } else {
        resolve(null);
      }
    });
  });
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private projectRooms: Map<number, Set<AuthenticatedSocket>> = new Map();
  private organizationRooms: Map<number, Set<AuthenticatedSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private failedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws",
    });

    this.wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
      const socket = ws as AuthenticatedSocket;
      socket.isAlive = true;
      socket.isAuthenticated = false;

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || 
                       req.socket.remoteAddress || 
                       "unknown";

      const attempts = this.failedAttempts.get(clientIp);
      if (attempts) {
        const now = Date.now();
        if (now - attempts.lastAttempt < this.RATE_LIMIT_WINDOW && 
            attempts.count >= this.MAX_FAILED_ATTEMPTS) {
          log(`WebSocket rate limited: ${clientIp}`, "ws");
          socket.close(4029, "Too many requests");
          return;
        }
        if (now - attempts.lastAttempt >= this.RATE_LIMIT_WINDOW) {
          this.failedAttempts.delete(clientIp);
        }
      }

      const sessionId = parseSessionId(req.headers.cookie);
      
      if (!sessionId) {
        this.recordFailedAttempt(clientIp);
        log("WebSocket connection rejected: no session cookie", "ws");
        socket.close(4001, "Unauthorized: No session");
        return;
      }

      const user = await getSessionUser(sessionId);
      
      if (!user) {
        this.recordFailedAttempt(clientIp);
        log("WebSocket connection rejected: invalid session", "ws");
        socket.close(4001, "Unauthorized: Invalid session");
        return;
      }

      socket.userId = user.id;
      socket.isAuthenticated = true;
      
      log(`WebSocket client connected: ${user.id}`, "ws");

      socket.send(
        JSON.stringify({
          type: "authenticated",
          payload: { userId: user.id, timestamp: Date.now() },
        })
      );

      socket.on("pong", () => {
        socket.isAlive = true;
      });

      socket.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(socket, message);
        } catch (error) {
          log(`Invalid WebSocket message: ${error}`, "ws");
          socket.send(
            JSON.stringify({
              type: "error",
              payload: { message: "Invalid message format" },
            })
          );
        }
      });

      socket.on("close", () => {
        this.handleDisconnect(socket);
        log(`WebSocket client disconnected: ${socket.userId}`, "ws");
      });

      socket.on("error", (error) => {
        log(`WebSocket error for ${socket.userId}: ${error.message}`, "ws");
      });
    });

    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws) => {
        const socket = ws as AuthenticatedSocket;
        if (!socket.isAlive) {
          this.handleDisconnect(socket);
          return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, 30000);

    log("WebSocket server initialized on /ws", "ws");
  }

  private recordFailedAttempt(clientIp: string) {
    const existing = this.failedAttempts.get(clientIp);
    if (existing) {
      existing.count++;
      existing.lastAttempt = Date.now();
    } else {
      this.failedAttempts.set(clientIp, { count: 1, lastAttempt: Date.now() });
    }
  }

  private async handleMessage(socket: AuthenticatedSocket, message: any) {
    if (!socket.isAuthenticated) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Not authenticated" },
        })
      );
      return;
    }

    switch (message.type) {
      case "join-project":
        await this.handleJoinProject(socket, message.payload);
        break;

      case "leave-project":
        this.handleLeaveProject(socket);
        break;

      case "join-organization":
        await this.handleJoinOrganization(socket, message.payload);
        break;

      case "leave-organization":
        this.handleLeaveOrganization(socket);
        break;

      case "cursor-move":
        this.handleCursorMove(socket, message.payload);
        break;

      case "ping":
        socket.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;

      default:
        socket.send(
          JSON.stringify({
            type: "error",
            payload: { message: `Unknown message type: ${message.type}` },
          })
        );
    }
  }

  private async handleJoinProject(
    socket: AuthenticatedSocket,
    payload: { projectId: number }
  ) {
    if (!payload.projectId) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Missing projectId" },
        })
      );
      return;
    }

    const project = await storage.getProject(payload.projectId);
    if (!project) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Project not found" },
        })
      );
      return;
    }

    const userOrg = await storage.getUserOrganization(socket.userId, project.organizationId);
    if (!userOrg) {
      log(`Access denied: ${socket.userId} tried to join project ${payload.projectId}`, "ws");
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Access denied to project" },
        })
      );
      return;
    }

    this.handleLeaveProject(socket);

    socket.projectId = payload.projectId;

    if (!this.projectRooms.has(payload.projectId)) {
      this.projectRooms.set(payload.projectId, new Set());
    }
    this.projectRooms.get(payload.projectId)!.add(socket);

    this.broadcastToProject(
      payload.projectId,
      {
        type: "user-joined",
        payload: {
          userId: socket.userId,
          projectId: payload.projectId,
        },
        timestamp: Date.now(),
        userId: socket.userId,
      },
      socket
    );

    const usersInRoom = Array.from(
      this.projectRooms.get(payload.projectId) || []
    ).map((s) => s.userId);

    socket.send(
      JSON.stringify({
        type: "project-joined",
        payload: {
          projectId: payload.projectId,
          users: usersInRoom,
          timestamp: Date.now(),
        },
      })
    );

    log(
      `User ${socket.userId} joined project ${payload.projectId} (${usersInRoom.length} users online)`,
      "ws"
    );
  }

  private handleLeaveProject(socket: AuthenticatedSocket) {
    if (!socket.projectId) return;

    const room = this.projectRooms.get(socket.projectId);
    if (room) {
      room.delete(socket);

      this.broadcastToProject(socket.projectId, {
        type: "user-left",
        payload: {
          userId: socket.userId,
          projectId: socket.projectId,
        },
        timestamp: Date.now(),
        userId: socket.userId,
      });

      if (room.size === 0) {
        this.projectRooms.delete(socket.projectId);
      }

      log(`User ${socket.userId} left project ${socket.projectId}`, "ws");
    }

    socket.projectId = undefined;
  }

  private async handleJoinOrganization(
    socket: AuthenticatedSocket,
    payload: { organizationId: number }
  ) {
    if (!payload.organizationId) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Missing organizationId" },
        })
      );
      return;
    }

    const userOrg = await storage.getUserOrganization(socket.userId, payload.organizationId);
    if (!userOrg) {
      log(`Access denied: ${socket.userId} tried to join organization ${payload.organizationId}`, "ws");
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Access denied to organization" },
        })
      );
      return;
    }

    this.handleLeaveOrganization(socket);

    socket.organizationId = payload.organizationId;

    if (!this.organizationRooms.has(payload.organizationId)) {
      this.organizationRooms.set(payload.organizationId, new Set());
    }
    this.organizationRooms.get(payload.organizationId)!.add(socket);

    socket.send(
      JSON.stringify({
        type: "organization-joined",
        payload: {
          organizationId: payload.organizationId,
          timestamp: Date.now(),
        },
      })
    );

    log(
      `User ${socket.userId} joined organization ${payload.organizationId}`,
      "ws"
    );
  }

  private handleLeaveOrganization(socket: AuthenticatedSocket) {
    if (!socket.organizationId) return;

    const room = this.organizationRooms.get(socket.organizationId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) {
        this.organizationRooms.delete(socket.organizationId);
      }
    }

    socket.organizationId = undefined;
  }

  private handleCursorMove(
    socket: AuthenticatedSocket,
    payload: { x: number; y: number; elementId?: string }
  ) {
    if (!socket.projectId) return;

    this.broadcastToProject(
      socket.projectId,
      {
        type: "cursor-move",
        payload: {
          userId: socket.userId,
          x: payload.x,
          y: payload.y,
          elementId: payload.elementId,
        },
        timestamp: Date.now(),
        userId: socket.userId,
      },
      socket
    );
  }

  private handleDisconnect(socket: AuthenticatedSocket) {
    this.handleLeaveProject(socket);
    this.handleLeaveOrganization(socket);
  }

  broadcastToProject(
    projectId: number,
    message: BroadcastMessage,
    excludeSocket?: AuthenticatedSocket
  ) {
    const room = this.projectRooms.get(projectId);
    if (!room) return;

    const data = JSON.stringify(message);
    room.forEach((socket) => {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  }

  broadcastToOrganization(
    organizationId: number,
    message: BroadcastMessage,
    excludeSocket?: AuthenticatedSocket
  ) {
    const room = this.organizationRooms.get(organizationId);
    if (!room) return;

    const data = JSON.stringify(message);
    room.forEach((socket) => {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  }

  notifyProjectUpdate(
    projectId: number,
    eventType: EventType,
    payload: any,
    userId: string
  ) {
    this.broadcastToProject(projectId, {
      type: eventType,
      payload,
      timestamp: Date.now(),
      userId,
    });
  }

  notifyOrganizationUpdate(
    organizationId: number,
    eventType: EventType,
    payload: any,
    userId: string
  ) {
    this.broadcastToOrganization(organizationId, {
      type: eventType,
      payload,
      timestamp: Date.now(),
      userId,
    });
  }

  getProjectUserCount(projectId: number): number {
    return this.projectRooms.get(projectId)?.size || 0;
  }

  getConnectedUsers(): number {
    return this.wss?.clients.size || 0;
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
    }

    this.projectRooms.clear();
    this.organizationRooms.clear();
    this.failedAttempts.clear();

    log("WebSocket server shut down", "ws");
  }
}

export const wsManager = new WebSocketManager();
