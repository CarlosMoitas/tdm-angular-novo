import { Router } from 'express';
import { getHealthStatus } from './health.controller';

export const healthRouter = Router();

/**
 * GET /health/status — health check enterprise (Gateway + TDM + Auth).
 * Rota pública (não exige JWT do Portal) — o objetivo é permitir que a
 * Navbar consulte o status antes mesmo do usuário estar logado.
 */
healthRouter.get('/status', getHealthStatus);
