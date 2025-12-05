import { type Server } from "node:http";
import crypto from "crypto";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes } from "./routes";
import {
  configureHelmet,
  configureCORS,
  sanitizeInput,
  validateEnvironmentVariables,
  apiLimiter,
} from "./middleware/security";
import { logger } from "./services/cloudLogging";
import { recordApiResponseTime, recordApiRequestCount, recordErrorCount } from "./services/cloudMonitoring";

// Validate environment variables on startup
try {
  validateEnvironmentVariables();
} catch (error) {
  logger.error("[SECURITY] Environment validation failed", error);
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

export function log(message: string, source = "express") {
  // Use Cloud Logging logger instead of console.log
  logger.info(message, { source });
}

export const app = express();

// Security middleware (applied early)
app.use(configureHelmet());
app.use(configureCORS());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
  limit: "10mb", // Limit JSON payload size
}));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Input sanitization (after body parsing)
app.use(sanitizeInput);

// Apply general API rate limiting
app.use("/api", apiLimiter);

// Request ID middleware (add early for tracing)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Generate request ID for tracing
  const requestId = crypto.randomUUID();
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const requestId = (req as any).id || 'unknown';
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", async () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Log HTTP request with Cloud Logging
      logger.httpRequest(
        req.method,
        path,
        res.statusCode,
        duration,
        {
          httpRequest: {
            requestMethod: req.method,
            requestUrl: path,
            status: res.statusCode,
            userAgent: req.get("user-agent"),
            remoteIp: req.ip || req.socket.remoteAddress,
          },
        }
      );

      // Record metrics
      await recordApiResponseTime(path, req.method, duration, res.statusCode);
      await recordApiRequestCount(path, req.method, res.statusCode);

      // Record error metrics for 5xx errors
      if (res.statusCode >= 500) {
        await recordErrorCount("server_error", path);
      } else if (res.statusCode >= 400) {
        await recordErrorCount("client_error", path);
      }
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use(async (err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error with Cloud Logging
    logger.error("Unhandled error in Express middleware", err, {
      httpRequest: {
        requestMethod: _req.method,
        requestUrl: _req.path,
        status,
      },
    });

    // Record error metric
    await recordErrorCount("unhandled_error", _req.path);

    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // Initialize scheduler for background tasks (exchange rate sync, etc.)
  const { initializeScheduler, cleanupScheduler } = await import("./scheduler");
  initializeScheduler();
  
  // Cleanup on graceful shutdown
  process.on('SIGTERM', () => {
    logger.info("SIGTERM received, cleaning up...");
    cleanupScheduler();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    logger.info("SIGINT received, cleaning up...");
    cleanupScheduler();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Cloud Run uses PORT=8080 by default, but we support any port via env var
  // Default to 8080 for Cloud Run compatibility, fallback to 5000 for local dev
  const port = parseInt(process.env.PORT || '8080', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    logger.info(`Server started and serving on port ${port}`, {
      port,
      environment: process.env.NODE_ENV || "development",
    });
  });
}
