import { NextFunction, Request, Response } from 'express';
import { authService } from '../auth/auth.service';
import { AppError } from './error.middleware';
import { JwtPayload } from '../auth/auth.types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Protege rotas exigindo um JWT de sessão do Portal válido
 * (`Authorization: Bearer <token>`), emitido por `AuthService.login`.
 *
 * Este middleware NUNCA lida com credenciais/tokens do Broadcom TDM —
 * essa é uma responsabilidade exclusiva de `server/src/tdm`.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new AppError(401, 'Token de sessão ausente.');
  }

  req.user = authService.verifyToken(token);
  next();
}
