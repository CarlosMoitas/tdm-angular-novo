import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';

const RETRYABLE_STATUS_CODES = [502, 503, 504];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

/**
 * Estratégia de retry conservadora, aplicada APENAS a falhas transitórias
 * de infraestrutura do Gateway/TDM:
 *
 *   502 Bad Gateway
 *   503 Service Unavailable
 *   504 Gateway Timeout
 *   status 0 (timeout / erro de rede, sem resposta do servidor)
 *
 * NUNCA aplica retry para erros de contrato/negócio (400, 401, 403, 404),
 * pois repetir esses requests não resolveria o problema e poderia mascarar
 * bugs reais ou gerar efeitos colaterais em operações não-idempotentes.
 *
 * Máximo de 2 tentativas adicionais, com pequeno backoff fixo.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  // Apenas GETs são retried por padrão (idempotentes). POST/PUT/DELETE de
  // efeitos colaterais (ex.: submit-and-download) não devem ser repetidos
  // automaticamente sem confirmação explícita do usuário.
  if (req.method !== 'GET') {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: HttpErrorResponse, retryCount) => {
        if (!isRetryable(error)) {
          throw error;
        }
        return timer(RETRY_DELAY_MS * retryCount);
      },
    }),
  );
};

function isRetryable(error: HttpErrorResponse): boolean {
  return error.status === 0 || RETRYABLE_STATUS_CODES.includes(error.status);
}
