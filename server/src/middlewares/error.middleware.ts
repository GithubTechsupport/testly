import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const flattened = (error as ZodError).flatten();
    return res.status(400).json({
      message: "Validation failed",
      errors: flattened,
    });
  }

  if (error instanceof HttpError) {
    if (error.statusCode >= 500) {
      logger.error(error.message, error.details ?? error);
    }
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  }

  logger.error("Unhandled error", error);
  return res.status(500).json({ message: "Internal server error" });
}
