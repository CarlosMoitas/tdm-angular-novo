/**
 * Contrato único de erro normalizado, consumido por toda a aplicação.
 * Nenhum componente ou serviço deve interpretar `HttpErrorResponse`
 * diretamente — sempre recebem um `ApiError` já normalizado pelo
 * ErrorInterceptor.
 */
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  correlationId?: string;
  details?: unknown;
}
