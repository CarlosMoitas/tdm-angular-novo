import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/** Permite que outros interceptors (ex.: ErrorInterceptor) leiam o mesmo Correlation ID. */
export const CORRELATION_ID_CONTEXT = new HttpContextToken<string>(() => '');

/**
 * Gera um Correlation ID único por requisição e o anexa como header
 * `X-Correlation-Id`, permitindo rastreamento ponta a ponta:
 *
 * Angular → Gateway → Broadcom TDM
 *
 * O mesmo identificador pode então ser usado para correlacionar logs
 * do frontend com logs do Gateway e do TDM durante troubleshooting.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationId = generateCorrelationId();

  const reqWithHeader = req.clone({
    setHeaders: { [CORRELATION_ID_HEADER]: correlationId },
    context: req.context.set(CORRELATION_ID_CONTEXT, correlationId),
  });

  return next(reqWithHeader);
};

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Fallback simples caso `crypto.randomUUID` não esteja disponível.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
