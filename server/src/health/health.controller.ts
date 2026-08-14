import { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service';

/**
 * GET /health/status — health check enterprise, consolidando Gateway,
 * TDM e Autenticação em uma única resposta.
 */
export async function getHealthStatus(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await healthService.checkHealth();
    res.json(result);
  } catch (error) {
    next(error);
  }
}
