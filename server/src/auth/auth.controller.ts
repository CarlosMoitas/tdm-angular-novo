import { NextFunction, Request, Response } from 'express';
import { authService } from './auth.service';
import { LoginRequest } from './auth.types';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as LoginRequest;
      const result = await authService.login(body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  logout(_req: Request, res: Response): void {
    // Sessão é stateless (JWT) — o "logout" é responsabilidade do cliente
    // (descartar o token). Mantemos o endpoint para simetria de contrato
    // e para permitir, no futuro, invalidação server-side (blacklist/SSO).
    res.status(204).send();
  },

  me(req: Request, res: Response): void {
    const authHeader = req.header('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload = authService.verifyToken(token);

    res.json({
      id: payload.sub,
      username: payload.username,
      name: payload.name,
      roles: payload.roles,
    });
  },
};
