/**
 * Security Middleware
 * Implements security best practices: Helmet, Rate Limiting, CORS, Input Sanitization
 */

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

/**
 * Configure Helmet.js for security headers
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Tailwind
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"], // Allow data URIs and HTTPS images
        connectSrc: ["'self'", "ws:", "wss:", "*"], // Allow WebSocket connections and external APIs
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility with some browsers
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  });
}

/**
 * General API rate limiter (stricter)
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === "/health" || req.path === "/api/health";
  },
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: "Too many authentication attempts, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Strict rate limiter for password reset
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: "Too many password reset attempts, please try again after 1 hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for file uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: "Too many file uploads, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * CORS configuration
 * Only allow specific origins in production
 */
export function configureCORS() {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : ["http://localhost:5000", "http://localhost:3000"]; // Default for development

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    } else {
      // In production, reject unknown origins
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ message: "Origin not allowed" });
      }
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  };
}

/**
 * Basic input sanitization middleware
 * Removes potentially dangerous characters from string inputs
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitizeString = (str: any): any => {
    if (typeof str === "string") {
      // Remove null bytes and other control characters
      return str.replace(/\0/g, "").replace(/[\x00-\x1F\x7F]/g, "");
    }
    if (Array.isArray(str)) {
      return str.map(sanitizeString);
    }
    if (str && typeof str === "object") {
      const sanitized: Record<string, any> = {};
      for (const key in str) {
        sanitized[key] = sanitizeString(str[key]);
      }
      return sanitized;
    }
    return str;
  };

  if (req.body) {
    req.body = sanitizeString(req.body);
  }
  if (req.query) {
    req.query = sanitizeString(req.query);
  }
  if (req.params) {
    req.params = sanitizeString(req.params);
  }

  next();
}

/**
 * Validate required environment variables on startup
 */
export function validateEnvironmentVariables(): void {
  const required = [
    "DATABASE_URL",
    "SESSION_SECRET",
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      "Please check your .env file or environment configuration."
    );
  }

  // Warn about optional but recommended variables
  const recommended = [
    "ALLOWED_ORIGINS",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "SENDGRID_API_KEY",
  ];

  const missingRecommended: string[] = [];
  for (const key of recommended) {
    if (!process.env[key]) {
      missingRecommended.push(key);
    }
  }

  if (missingRecommended.length > 0 && process.env.NODE_ENV === "production") {
    console.warn(
      `[SECURITY] Recommended environment variables not set: ${missingRecommended.join(", ")}\n` +
      "Some features may not work correctly in production."
    );
  }
}

