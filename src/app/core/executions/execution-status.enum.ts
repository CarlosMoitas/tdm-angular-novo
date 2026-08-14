/**
 * Estados possíveis de uma execução de Job no Broadcom TDM, monitorada
 * pelo Portal.
 *
 * Ciclo de vida esperado (nem todo job passa por todos os estados):
 *
 *   PENDING → RUNNING → COMPLETED
 *                     → SLOW      → COMPLETED | FAILED | TIMEOUT
 *                     → TIMEOUT   (continua sendo monitorado)
 *                     → FAILED
 *   (qualquer estado) → CANCELLED (cancelamento manual, futuro)
 *   COMPLETED → ARTIFACT_READY  (quando o job gera artefato para download)
 *
 * IMPORTANTE: `SLOW` e `TIMEOUT` são estados DERIVADOS do tempo decorrido
 * (ver `execution.store.ts` / regras de negócio em `execution-manager.service.ts`),
 * não são retornados diretamente pelo TDM — o TDM só informa
 * PENDING/RUNNING/COMPLETED/FAILED (ver `JobStatusDto`). O Portal
 * reclassifica o estado observado com base no tempo decorrido desde
 * `startedAt`.
 */
export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SLOW = 'SLOW',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  ARTIFACT_READY = 'ARTIFACT_READY',
}

/** Estados que ainda exigem polling ativo (job não chegou a um estado terminal "estável"). */
export const ACTIVE_EXECUTION_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  ExecutionStatus.PENDING,
  ExecutionStatus.RUNNING,
  ExecutionStatus.SLOW,
  ExecutionStatus.TIMEOUT, // TIMEOUT continua sendo monitorado, por requisito explícito
]);

/** Estados finais de sucesso. */
export const SUCCESS_EXECUTION_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  ExecutionStatus.COMPLETED,
  ExecutionStatus.ARTIFACT_READY,
]);

/** Estados finais de falha/interrupção. */
export const FAILURE_EXECUTION_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  ExecutionStatus.FAILED,
  ExecutionStatus.CANCELLED,
]);
