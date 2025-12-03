/**
 * Security Middleware
 * Implements security best practices: Helmet, Rate Limiting, CORS, Input Sanitization
 */

import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

/**
 * Configure Helmet.js for security headers
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Allow inline styles for Tailwind
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"], // Allow data URIs and HTTPS images
        connectSrc: ["'self'", "ws:", "wss:", "*"], // Allow WebSocket connections and external APIs
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://r2cdn.perplexity.ai"],
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
 * General API rate limiter (IP-based)
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to prevent 429 errors during normal usage
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === "/health" || req.path === "/api/health";
  },
});

/**
 * Per-user API rate limiter (for authenticated requests)
 * Uses user ID instead of IP address for better accuracy
 */
export const userApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for authenticated users (200 requests per 15 min)
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, fallback to IP using proper IPv6-safe helper
    if ((req as any).user?.id) {
      return String((req as any).user.id);
    }
    // Use ipKeyGenerator helper for IPv6-safe IP handling
    // ipKeyGenerator takes an IP string (req.ip), not the Request object
    return ipKeyGenerator(req.ip || "unknown");
  },
  skip: (req: Request) => {
    // Skip for health checks
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

    // Also allow undefined origin (for curl, Postman, etc.) if in dev
    if (process.env.NODE_ENV === "development") {
        allowedOrigins.push("undefined");
    }

    // Allow requests with no origin (like mobile apps or curl requests)
    // Never use "*" when credentials are enabled (security risk)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
      // Use first allowed origin as fallback instead of "*"
      const allowedOrigin = origin || (allowedOrigins.length > 0 ? allowedOrigins[0] : null);
      if (allowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      }
    } else {
      // In production, reject unknown origins
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ message: "Origin not allowed" });
      }
      // In development, allow but use first allowed origin instead of "*"
      const fallbackOrigin = allowedOrigins.length > 0 ? allowedOrigins[0] : null;
      if (fallbackOrigin) {
        res.setHeader("Access-Control-Allow-Origin", fallbackOrigin);
      }
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
  // Generate a default SESSION_SECRET for development if not provided
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "development") {
    const crypto = require("crypto");
    process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[SECURITY] SESSION_SECRET not set - generated a temporary one for development.\n" +
      "⚠️  WARNING: This will change on every restart. Set SESSION_SECRET in .env for production."
    );
  }

  const required = [
    "DATABASE_URL",
    "SESSION_SECRET",
  ];

  const missing: string[] = [];
  const invalid: string[] = [];

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

  // Validate format of critical environment variables
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgres://') && 
        !process.env.DATABASE_URL.startsWith('postgresql://') &&
        !process.env.DATABASE_URL.startsWith('postgresql+ssl://')) {
      invalid.push('DATABASE_URL must start with postgres://, postgresql://, or postgresql+ssl://');
    }
  }

  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      invalid.push('SESSION_SECRET must be at least 32 characters long');
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    const invalidOrigins = origins.filter(o => {
      try {
        new URL(o);
        return false;
      } catch {
        return true;
      }
    });
    if (invalidOrigins.length > 0) {
      invalid.push(`ALLOWED_ORIGINS contains invalid URLs: ${invalidOrigins.join(', ')}`);
    }
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid environment variable formats:\n${invalid.join('\n')}\n` +
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

  // Validate format of critical environment variables
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgres://') && 
        !process.env.DATABASE_URL.startsWith('postgresql://') &&
        !process.env.DATABASE_URL.startsWith('postgresql+')) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
    }
  }

  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long');
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    for (const origin of origins) {
      if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
        throw new Error(`Invalid origin format in ALLOWED_ORIGINS: ${origin}. Must start with http:// or https://`);
      }
    }
  }
}

