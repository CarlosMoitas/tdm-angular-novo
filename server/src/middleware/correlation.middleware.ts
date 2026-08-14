import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Garante que toda requisição tenha um Correlation ID, reaproveitando o
 * header enviado pelo Angular (`X-Correlation-Id`) quando presente, ou
 * gerando um novo caso contrário. O mesmo ID é devolvido na resposta e
 * usado em todos os logs desta requisição, permitindo rastreamento
 * ponta a ponta: Angular → este servidor → Broadcom TDM.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_ID_HEADER);
  const correlationId = incoming && incoming.trim() ? incoming.trim() : randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  next();
}
