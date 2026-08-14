import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * IMPORTANTE — fronteira de segurança:
 * O token injetado aqui é o token de SESSÃO DO GATEWAY/PORTAL (emitido por
 * `POST /gw/auth/login`), NUNCA uma credencial do Broadcom TDM em si.
 * O Angular não conhece, não armazena e não envia usuário/senha/token do
 * TDM — essa responsabilidade é inteiramente do Gateway, que troca este
 * token de sessão por credenciais internas do TDM no backend.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authReq);
};
