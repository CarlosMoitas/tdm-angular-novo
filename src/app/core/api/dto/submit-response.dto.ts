/**
 * Contrato CONFIRMADO: resposta de POST /gw/api/requests/submit-and-download
 *
 * Representa o payload bruto retornado pelo Gateway após submissão e
 * acompanhamento (polling) do job no Broadcom TDM, incluindo o download
 * do artefato quando aplicável. Campos vêm diretamente do Gateway — a
 * camada de Model (core/models/execution.model.ts) desacopla a UI deste
 * formato.
 */
export interface ExtractedContaInfoDto {
  found: boolean;
  agencia?: string;
  conta?: string;
  reason?: string;
}

export interface SubmitResponseDto {
  success: boolean;
  requestedJobId?: number | string;
  childJobId?: number | string;
  effectiveJobId?: number | string;
  parentStatus?: string;
  childStatus?: string;
  sizeBytes?: number;
  artifactLocation?: string;
  message?: string;
  /**
   * Preenchido apenas quando o artefato retornado permite extrair a conta
   * corrente criada (rotina "Contas Correntes - PF" / Agendar Débito
   * Automático). Usado para encadear automaticamente o card
   * "Habilitar Conta MA".
   */
  extractedContaInfo?: ExtractedContaInfoDto;
}
