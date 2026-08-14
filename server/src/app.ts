import express, { Express } from 'express';
import cors from 'cors';
import { correlationMiddleware } from './middleware/correlation.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { authRouter } from './auth/auth.routes';
import { tdmRouter } from './tdm/tdm.routes';
import { healthRouter } from './health/health.routes';

/**
 * Monta a aplicação Express deste servidor.
 *
 * Rotas expostas (consumidas pelo Angular via `/gw`, ver proxy.conf.json):
 *   GET  /health
 *   GET  /health/status                       (health check enterprise: Gateway + TDM + Auth)
 *   POST /auth/login
 *   POST /auth/logout
 *   GET  /auth/me
 *   POST /api/requests/submit-and-download   (protegida por JWT do Portal)
 *   GET  /api/jobs/:jobId/status              (protegida por JWT do Portal)
 *   POST /api/jobs/:jobId/download-artifact   (protegida por JWT do Portal)
 */
export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(correlationMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'Servidor tdm-angular-novo ativo' });
  });

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/api', tdmRouter);

  app.use(errorMiddleware);

  return app;
}
