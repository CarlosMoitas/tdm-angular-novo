/**
 * Suporte a múltiplos ambientes (TI/TU) no workflow "Abertura de Contas".
 *
 * O usuário escolhe o ambiente no card "Contas Correntes - PF". Essa
 * escolha determina qual configuração técnica (levelID, configurationId,
 * vtfnodeID, dataDesign) deve ser usada em CADA um dos 3 cards do
 * workflow, já que o TDM possui rotinas/publish configs distintas por
 * ambiente.
 *
 * IMPORTANTE: os valores fixos abaixo (levelID, configurationId, vtfnodeID,
 * dataDesign) são a config técnica REAL de cada rotina no TDM para cada
 * ambiente — não são "chutes", foram fornecidos e validados manualmente.
 * O que É dinâmico e não deve ser fixado em nenhum lugar são: a agência
 * (digitada/lida no primeiro card), a conta (extraída do artefato .zip) e
 * o projeto Jira (também vindo do primeiro card, embora hoje tenha um
 * valor único observado em todos os exemplos).
 *
 * Por ora a UI mantém o ambiente fixo em 'TU' (nenhum seletor visual
 * ainda), mas toda a cadeia de builders/Facade já está preparada para
 * receber 'TI' quando o seletor for implementado.
 */
export type WorkflowEnvironment = 'TI' | 'TU';

/** Ambiente padrão usado enquanto a UI não expõe o seletor TI/TU. */
export const DEFAULT_WORKFLOW_ENVIRONMENT: WorkflowEnvironment = 'TU';

/** Config técnica do card "Contas Correntes - PF" (levelID 3309) por ambiente. */
export interface ContasCorrentesEnvConfig {
  /** Valor exato de `p_ambiente_gerar_conta` esperado pelo TDM. */
  ambienteLabel: string;
  segmentoContaCorretePF: string;
  configurationId: number;
}

/** Config técnica do card "Habilitar Conta MA" por ambiente (levelID varia). */
export interface HabilitarContaMaEnvConfig {
  levelID: number;
  configurationId: number;
  vtfnodeID: string;
  vtfnodeName: string;
}

/** Config técnica do card "Débito Automático" por ambiente (levelID fixo). */
export interface DebitoAutomaticoEnvConfig {
  configurationId: number;
}

const CONTAS_CORRENTES_CONFIG: Record<WorkflowEnvironment, ContasCorrentesEnvConfig> = {
  TU: {
    ambienteLabel: 'PDB204P - TU',
    segmentoContaCorretePF: '000-CLIENTE CLASSIC',
    configurationId: 2982,
  },
  TI: {
    ambienteLabel: 'PCM2AB  - NOVO TI',
    segmentoContaCorretePF: '',
    configurationId: 2985,
  },
};

const HABILITAR_CONTA_MA_CONFIG: Record<WorkflowEnvironment, HabilitarContaMaEnvConfig> = {
  TU: {
    levelID: 4588,
    configurationId: 3019,
    vtfnodeID: '420',
    vtfnodeName: 'Habilitar Conta MA TU',
  },
  TI: {
    levelID: 4593,
    configurationId: 3032,
    vtfnodeID: '540',
    vtfnodeName: 'Habilitar MA NOVO TI',
  },
};

// O card "Débito Automático" usa a MESMA rotina/configuração técnica em
// ambos os ambientes — apenas as variáveis de negócio (agência, conta,
// projeto Jira) mudam, e essas já vêm do contexto do workflow.
const DEBITO_AUTOMATICO_CONFIG: Record<WorkflowEnvironment, DebitoAutomaticoEnvConfig> = {
  TU: { configurationId: 845 },
  TI: { configurationId: 845 },
};

export function getContasCorrentesEnvConfig(environment: WorkflowEnvironment): ContasCorrentesEnvConfig {
  return CONTAS_CORRENTES_CONFIG[environment];
}

export function getHabilitarContaMaEnvConfig(environment: WorkflowEnvironment): HabilitarContaMaEnvConfig {
  return HABILITAR_CONTA_MA_CONFIG[environment];
}

export function getDebitoAutomaticoEnvConfig(environment: WorkflowEnvironment): DebitoAutomaticoEnvConfig {
  return DEBITO_AUTOMATICO_CONFIG[environment];
}
