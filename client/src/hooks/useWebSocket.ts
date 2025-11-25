import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

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

interface WebSocketMessage {
  type: EventType | "authenticated" | "project-joined" | "organization-joined" | "error" | "pong";
  payload: any;
  timestamp?: number;
  userId?: string;
}

interface UseWebSocketOptions {
  projectId?: number;
  organizationId?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
  autoInvalidateQueries?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);

  optionsRef.current = options;

  const invalidateProjectQueries = useCallback((projectId: number, eventType: EventType) => {
    const entityType = eventType.split("-")[0];

    switch (entityType) {
      case "task":
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
        break;
      case "risk":
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/risks`] });
        break;
      case "issue":
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/issues`] });
        break;
      case "stakeholder":
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/stakeholders`] });
        break;
      case "cost":
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/costs`] });
        break;
      case "project":
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
        break;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "authenticated":
          console.log("[WS] Authenticated successfully");
          if (optionsRef.current.projectId) {
            wsRef.current?.send(
              JSON.stringify({
                type: "join-project",
                payload: { projectId: optionsRef.current.projectId },
              })
            );
          }
          if (optionsRef.current.organizationId) {
            wsRef.current?.send(
              JSON.stringify({
                type: "join-organization",
                payload: { organizationId: optionsRef.current.organizationId },
              })
            );
          }
          break;

        case "project-joined":
          console.log("[WS] Joined project:", message.payload.projectId);
          setConnectedUsers(message.payload.users || []);
          break;

        case "organization-joined":
          console.log("[WS] Joined organization:", message.payload.organizationId);
          break;

        case "user-joined":
          console.log("[WS] User joined:", message.payload.userId);
          setConnectedUsers((prev) => {
            if (!prev.includes(message.payload.userId)) {
              return [...prev, message.payload.userId];
            }
            return prev;
          });
          optionsRef.current.onUserJoined?.(message.payload.userId);
          break;

        case "user-left":
          console.log("[WS] User left:", message.payload.userId);
          setConnectedUsers((prev) => prev.filter((id) => id !== message.payload.userId));
          optionsRef.current.onUserLeft?.(message.payload.userId);
          break;

        case "error":
          console.error("[WS] Error:", message.payload.message);
          break;

        case "pong":
          break;

        default:
          if (
            optionsRef.current.autoInvalidateQueries !== false &&
            message.payload?.projectId
          ) {
            invalidateProjectQueries(message.payload.projectId, message.type as EventType);
          }
          optionsRef.current.onMessage?.(message);
      }
    } catch (error) {
      console.error("[WS] Failed to parse message:", error);
    }
  }, [invalidateProjectQueries]);

  const connect = useCallback(() => {
    if (!user?.id) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log("[WS] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      setIsConnected(true);

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setIsConnected(false);
      setConnectedUsers([]);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  }, [user?.id, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectedUsers([]);
  }, []);

  const joinProject = useCallback((projectId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "join-project",
          payload: { projectId },
        })
      );
    }
  }, []);

  const leaveProject = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "leave-project",
          payload: {},
        })
      );
    }
  }, []);

  const sendCursorPosition = useCallback((x: number, y: number, elementId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "cursor-move",
          payload: { x, y, elementId },
        })
      );
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  useEffect(() => {
    if (isConnected && options.projectId) {
      joinProject(options.projectId);
    }
  }, [isConnected, options.projectId, joinProject]);

  return {
    isConnected,
    connectedUsers,
    joinProject,
    leaveProject,
    sendCursorPosition,
    disconnect,
  };
}
