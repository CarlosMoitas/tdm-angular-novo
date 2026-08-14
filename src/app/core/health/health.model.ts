/**
 * Model de domínio do health check enterprise da plataforma.
 *
 * Desacopla a UI (Navbar/HealthFacade) do formato bruto retornado pelo
 * backend (HealthStatusResponseDto). O valor central consumido pela UI é
 * `readyForExecution` — a única pergunta que realmente importa para o
 * usuário: "posso executar um card agora?".
 */
export type LayerStatus = 'UP' | 'DOWN';

export interface GatewayHealth {
  gateway: LayerStatus;
  tdm: LayerStatus;
  authentication: LayerStatus;
  readyForExecution: boolean;
  message: string;
  timestamp: string;
}
