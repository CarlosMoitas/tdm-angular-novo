import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../logging/logger.service';
import { ApiError } from '../models/api-error.model';
import { CORRELATION_ID_CONTEXT } from './correlation-id.interceptor';

/**
 * Intercepta todas as respostas HTTP com erro (401, 403, 404, 500, erros de
 * rede, etc.) e as normaliza no contrato único `ApiError`
 * (ver core/models/api-error.model.ts) antes de propagar para os
 * serviços/facades.
 *
 * Objetivo: nenhum componente ou serviço deve precisar interpretar
 * `HttpErrorResponse` diretamente — sempre recebem um `ApiError` já
 * normalizado, com mensagem amigável pronta para exibição e o mesmo
 * Correlation ID enviado na requisição (para rastreamento ponta a ponta
 * com o Gateway/TDM).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const correlationId = req.context.get(CORRELATION_ID_CONTEXT) || undefined;
      const normalized = normalizeError(error, correlationId);
      logger.error(`Falha na requisição ${req.method} ${req.url}`, correlationId, normalized);
      return throwError(() => normalized);
    }),
  );
};

function normalizeError(error: HttpErrorResponse, correlationId?: string): ApiError {
  // Erro de rede / sem resposta do servidor (status 0)
  if (error.status === 0) {
    return {
      status: 0,
      message: 'Não foi possível conectar ao Gateway do Portal TDM. Verifique sua conexão.',
      code: 'NETWORK_ERROR',
      correlationId,
      details: error,
    };
  }

  switch (error.status) {
    case 401:
      return {
        status: 401,
        message: 'Sessão expirada ou inválida. Faça login novamente.',
        code: 'UNAUTHORIZED',
        correlationId,
        details: error.error,
      };
    case 403:
      return {
        status: 403,
        message: 'Você não tem permissão para executar esta ação.',
        code: 'FORBIDDEN',
        correlationId,
        details: error.error,
      };
    case 404:
      return {
        status: 404,
        message: 'Recurso não encontrado no Gateway do Portal TDM.',
        code: 'NOT_FOUND',
        correlationId,
        details: error.error,
      };
    case 500:
      return {
        status: 500,
        message: 'Erro interno no Gateway do Portal TDM. Tente novamente mais tarde.',
        code: 'INTERNAL_ERROR',
        correlationId,
        details: error.error,
      };
    default:
      return {
        status: error.status,
        message:
          extractGatewayMessage(error) ?? 'Ocorreu um erro inesperado ao comunicar com o Gateway.',
        code: 'UNKNOWN_ERROR',
        correlationId,
        details: error.error,
      };
  }
}

/**
 * Tenta extrair uma mensagem amigável do payload de erro retornado pelo
 * Gateway, já que o formato exato do corpo de erro pode variar entre
 * endpoints.
 */
function extractGatewayMessage(error: HttpErrorResponse): string | undefined {
  const body = error.error;
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object') {
    return (body as { message?: string }).message;
  }
  return undefined;
}
