/**
 * Model de domínio da execução de uma requisição TDM via Gateway.
 *
 * Desacopla a UI (Home/Facade) do formato bruto retornado pelo Gateway
 * (SubmitResponseDto). Qualquer mudança no contrato do Gateway é absorvida
 * pelo mapper (core/api/mappers/execution.mapper.ts), sem impactar quem
 * consome este Model.
 */
export interface ExtractedContaInfo {
  found: boolean;
  agencia?: string;
  conta?: string;
  reason?: string;
}

export interface Execution {
  success: boolean;
  requestedJobId?: string;
  childJobId?: string;
  effectiveJobId?: string;
  parentStatus?: string;
  childStatus?: string;
  sizeBytes?: number;
  message?: string;
  /**
   * Agência/conta corrente extraídas do artefato, quando aplicável
   * (rotina "Contas Correntes - PF"). Usado para encadear o próximo
   * passo do workflow ("Habilitar Conta MA").
   */
  extractedContaInfo?: ExtractedContaInfo;
}
