/**
 * Async Handler Utility
 * Wraps async route handlers to automatically catch errors
 * and forward them to the Express error handling middleware.
 * This eliminates the need for try-catch blocks in every controller.
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
