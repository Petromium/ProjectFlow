/**
 * Centralized Error Handler Middleware
 * Provides consistent error responses across all API routes
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { ZodError } from "zod";

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error("API Error", error instanceof Error ? error : new Error(String(error)), {
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      errors: error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
      ...(process.env.NODE_ENV === "development" && { details: error.errors }),
    });
    return;
  }

  // Handle custom API errors
  const apiError = error as ApiError;
  const statusCode = apiError.statusCode || 500;
  const message = apiError.message || "Internal server error";

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  
  res.status(statusCode).json({
    message,
    ...(isDevelopment && {
      stack: error.stack,
      error: error.name,
    }),
  });
}

/**
 * Async route wrapper to catch errors
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a standardized API error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

