/**
 * Global Error Handling Middleware
 * Catches all errors thrown in the application and returns
 * a standardized error response.
 *
 * Error flow:
 * 1. Controller throws AppError or native Error
 * 2. asyncHandler catches it and calls next(error)
 * 3. This middleware formats and sends the response
 */
import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/responseHelper';
import { logger } from '../utils/logger';

const errorLogger = logger.child('ErrorHandler');

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // ---- Multer Errors (file upload issues) ----
  if (err instanceof MulterError) {
    errorLogger.warn('Multer error:', { code: err.code, message: err.message });

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        sendError(res, 413, 'FILE_TOO_LARGE', 'File exceeds maximum allowed size');
        return;
      case 'LIMIT_FILE_COUNT':
        sendError(res, 400, 'TOO_MANY_FILES', 'Only one file can be uploaded at a time');
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        sendError(res, 400, 'UNEXPECTED_FIELD', 'Unexpected file field. Use "audio" as field name');
        return;
      default:
        sendError(res, 400, 'UPLOAD_ERROR', err.message);
        return;
    }
  }

  // ---- Application Errors (intentional, operational) ----
  if (err instanceof AppError) {
    errorLogger.warn(`AppError [${err.code}]: ${err.message}`);
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  // ---- Unexpected Errors (programming bugs, unhandled cases) ----
  errorLogger.error('Unexpected error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred',
  );
};
