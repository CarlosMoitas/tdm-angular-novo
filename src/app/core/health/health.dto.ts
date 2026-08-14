/**
 * Contrato bruto retornado por GET /health/status.
 */
export type LayerStatusDto = 'UP' | 'DOWN';

export interface HealthStatusResponseDto {
  gateway: LayerStatusDto;
  tdm: LayerStatusDto;
  authentication: LayerStatusDto;
  readyForExecution: boolean;
  message: string;
  timestamp: string;
}
