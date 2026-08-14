/**
 * Contratos do health check enterprise deste servidor.
 *
 * Diferente de um simples "o processo está de pé?", este health check
 * valida a cadeia completa necessária para o Portal executar requests
 * reais no Broadcom TDM: Gateway → URL do TDM configurada → login/token
 * do TDM efetivamente obtido.
 */
export type LayerStatus = 'UP' | 'DOWN';

export interface HealthCheckResult {
  gateway: LayerStatus;
  tdm: LayerStatus;
  authentication: LayerStatus;
  readyForExecution: boolean;
  message: string;
  timestamp: string;
}
