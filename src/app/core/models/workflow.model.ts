/**
 * Contratos mínimos para suportar, no futuro, workflows encadeados de
 * execuções TDM (ex.: Request 1 → Request 2 → Request 3, onde cada etapa
 * depende do resultado da anterior).
 *
 * Nenhuma lógica de encadeamento é implementada ainda — apenas os
 * contratos necessários para introduzir workflows sem refatorar a
 * arquitetura existente (ExecutionService, HomeFacade).
 */

/** Identifica um passo individual dentro de um workflow de execuções. */
export interface WorkflowStep {
  stepId: string;
  cardId: string;
  label: string;
  order: number;
}

/** Declara que um step depende do resultado (Execution) de outro step anterior. */
export interface ExecutionDependency {
  stepId: string;
  dependsOnStepId: string;
}

/** Estado de execução de um workflow completo (múltiplos steps encadeados). */
export interface WorkflowExecution {
  workflowId: string;
  steps: WorkflowStep[];
  dependencies: ExecutionDependency[];
  completedStepIds: string[];
  currentStepId?: string;
}
