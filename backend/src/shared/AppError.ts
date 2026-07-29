/**
 * Operational error with an HTTP status. Anything thrown that is NOT an
 * AppError is treated as an unexpected 500 by the error middleware.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(message, 401);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError(message, 404);
  }

  static unprocessable(message: string, details?: unknown): AppError {
    return new AppError(message, 422, details);
  }

  static upstream(message: string, details?: unknown): AppError {
    return new AppError(message, 502, details);
  }
}
