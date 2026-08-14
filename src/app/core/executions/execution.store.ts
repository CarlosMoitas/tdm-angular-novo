import { Injectable, computed, signal } from '@angular/core';
import { ExecutionStatus, ACTIVE_EXECUTION_STATUSES, FAILURE_EXECUTION_STATUSES } from './execution-status.enum';
import { PersistedExecutionHandle, TrackedExecution } from './execution.model';

const STORAGE_KEY = 'tdm_tracked_executions_v1';

/**
 * Store centralizado de execuções, baseado em Angular Signals — NENHUM
 * componente ou service deve manter estado próprio de execuções fora
 * deste store. Reutilizável por qualquer Catalog/Card do Broadcom TDM.
 *
 * Mantém uma coleção única indexada por `id` (Map), com Signals derivados
 * (`activeExecutions`, `completedExecutions`, `failedExecutions`) — nunca
 * uma variável única, permitindo múltiplos jobs simultâneos (Job A
 * Running, Job B Running, Job C Completed, etc.).
 *
 * Responsável também pela persistência MÍNIMA (jobId/status/startedAt/source)
 * em `sessionStorage`, usada pelo `ExecutionManagerService` para retomar o
 * polling após um refresh (F5) da página.
 */
@Injectable({ providedIn: 'root' })
export class ExecutionStore {
  private readonly _executions = signal<ReadonlyMap<string, TrackedExecution>>(new Map());

  /** Todas as execuções conhecidas (ativas + terminais), como array reativo. */
  readonly all = computed(() => Array.from(this._executions().values()));

  /** Execuções que ainda exigem polling ativo (PENDING/RUNNING/SLOW/TIMEOUT). */
  readonly activeExecutions = computed(() =>
    this.all().filter((execution) => ACTIVE_EXECUTION_STATUSES.has(execution.status)),
  );

  /** Execuções concluídas com sucesso (COMPLETED/ARTIFACT_READY). */
  readonly completedExecutions = computed(() =>
    this.all().filter(
      (execution) =>
        execution.status === ExecutionStatus.COMPLETED ||
        execution.status === ExecutionStatus.ARTIFACT_READY,
    ),
  );

  /** Execuções finalizadas com falha/cancelamento. */
  readonly failedExecutions = computed(() =>
    this.all().filter((execution) => FAILURE_EXECUTION_STATUSES.has(execution.status)),
  );

  get(id: string): TrackedExecution | undefined {
    return this._executions().get(id);
  }

  upsert(execution: TrackedExecution): void {
    this._executions.update((current) => {
      const next = new Map(current);
      next.set(execution.id, execution);
      return next;
    });
    this.persist();
  }

  remove(id: string): void {
    this._executions.update((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    this.persist();
  }

  /**
   * Grava em `sessionStorage` apenas o necessário para retomar o polling
   * das execuções ainda ATIVAS (ver `PersistedExecutionHandle`) — nunca o
   * histórico completo, para manter a persistência leve e evitar dados
   * obsoletos acumulando entre sessões.
   */
  private persist(): void {
    const handles: PersistedExecutionHandle[] = this.activeExecutions().map((execution) => ({
      id: execution.id,
      jobId: execution.jobId,
      status: execution.status,
      startedAt: execution.startedAt.toISOString(),
      source: execution.source,
    }));

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
    } catch {
      // Armazenamento indisponível (ex.: modo privado) — a aplicação
      // continua funcionando normalmente, apenas sem retomada após F5.
    }
  }

  /**
   * Lê os handles persistidos de execuções ativas de uma sessão anterior.
   * Consumido pelo `ExecutionManagerService` na inicialização da
   * aplicação para retomar o polling automaticamente.
   */
  readPersistedHandles(): PersistedExecutionHandle[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as PersistedExecutionHandle[];
    } catch {
      return [];
    }
  }
}
