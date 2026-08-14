import { NextFunction, Request, Response } from 'express';
import { logger } from '../logging/logger';

/**
 * Erro de negócio normalizado, lançado pelos services/controllers.
 * O `errorMiddleware` converte qualquer erro lançado na aplicação para
 * o mesmo formato de resposta, incluindo o Correlation ID da requisição.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const correlationId = req.correlationId;

  if (err instanceof AppError) {
    logger.warn(err.message, correlationId, { code: err.code, details: err.details });
    res.status(err.status).json({
      message: err.message,
      code: err.code,
      correlationId,
      details: err.details,
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Erro interno inesperado.';
  logger.error(message, correlationId, err);

  res.status(500).json({
    message: 'Erro interno inesperado.',
    correlationId,
  });
}
