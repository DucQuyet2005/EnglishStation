/**
 * Custom Application Error
 * Extends native Error with HTTP status code and error code
 * for consistent error handling across the application.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguishes operational errors from programming errors

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }

  // ---- Factory Methods for Common Errors ----

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }

  static notFound(message: string = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static tooLarge(message: string = 'File too large') {
    return new AppError(message, 413, 'FILE_TOO_LARGE');
  }

  static unsupportedMedia(message: string = 'Unsupported file type') {
    return new AppError(message, 415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable') {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  static transcriptionFailed(message: string = 'Transcription failed') {
    return new AppError(message, 502, 'TRANSCRIPTION_FAILED');
  }
}
