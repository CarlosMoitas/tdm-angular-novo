import { ExecutionStatus } from './execution-status.enum';

/**
 * Metadados mínimos necessários para identificar/exibir de onde uma
 * execução se originou (qual card, qual catálogo), sem acoplar o motor de
 * monitoramento a nenhum Catalog/Card específico do TDM.
 */
export interface ExecutionSource {
  cardId: string;
  cardLabel?: string;
  catalogId?: string;
}

/**
 * Estado completo e persistível de uma execução de Job monitorada pelo
 * Portal.
 *
 * Este é o modelo CENTRAL do módulo `core/executions` — reutilizável para
 * qualquer Catalog/Card do Broadcom TDM, não específico de nenhum
 * workflow. Cada chamada a `ExecutionManagerService.startExecution()`
 * cria uma instância deste tipo, monitorada pelo `JobMonitorService`.
 */
export interface TrackedExecution {
  /** Identificador único da execução dentro do Portal (não é o jobId do TDM). */
  id: string;

  /** jobId retornado pelo TDM na submissão (usado no polling de status). */
  jobId: string;

  /** Origem da execução — qual card/catálogo a disparou. */
  source: ExecutionSource;

  status: ExecutionStatus;

  /** Mensagem amigável mais recente (erro, motivo de falha, etc.). */
  message?: string;

  /** Indica se o TDM retornou um artefato disponível para esta execução. */
  hasArtifact: boolean;

  startedAt: Date;
  updatedAt: Date;

  /**
   * Preenchido apenas quando a execução chega a um estado terminal
   * (COMPLETED/FAILED/CANCELLED/ARTIFACT_READY) — TIMEOUT/SLOW não
   * finalizam o polling, portanto não preenchem este campo.
   */
  finishedAt?: Date;

  /** Número de consultas de status já realizadas (observabilidade/depuração). */
  pollCount: number;
}

/**
 * Estado mínimo persistido em `sessionStorage` para permitir retomar o
 * monitoramento de execuções ativas após um refresh (F5) da página — ver
 * `execution.store.ts`. Deliberadamente NÃO persiste todo o
 * `TrackedExecution` (mensagens, contadores etc.), apenas o necessário
 * para identificar o job e retomar o polling do zero.
 */
export interface PersistedExecutionHandle {
  id: string;
  jobId: string;
  status: ExecutionStatus;
  startedAt: string; // ISO string (Date não é serializável diretamente)
  source: ExecutionSource;
}

// ---------------------------------------------------------------------
// Estrutura preparada para workflows encadeados futuros (múltiplos
// requests dependentes). Modelada agora conforme solicitado, mas SEM
// implementação de orquestração ainda — isso será endereçado em uma
// próxima etapa, quando os workflows encadeados migrarem para este
// módulo (ver docs/jornada-debito-automatico-planejamento.md).
// ---------------------------------------------------------------------

/** Uma etapa individual de um workflow encadeado (ex.: "Habilitar Conta MA"). */
export interface WorkflowStep {
  id: string;
  label: string;
  /** ID da execução (TrackedExecution.id) correspondente a esta etapa, quando iniciada. */
  executionId?: string;
  status: ExecutionStatus | 'NOT_STARTED';
}

/**
 * Relação de dependência entre duas etapas de um workflow: `to` só pode
 * iniciar após `from` atingir um estado de sucesso.
 */
export interface ExecutionDependency {
  from: string; // WorkflowStep.id
  to: string; // WorkflowStep.id
}

/** Um workflow encadeado completo (múltiplas execuções dependentes entre si). */
export interface WorkflowExecution {
  id: string;
  label: string;
  steps: WorkflowStep[];
  dependencies: ExecutionDependency[];
  startedAt: Date;
  updatedAt: Date;
}
