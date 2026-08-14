import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ExecutionService } from '../services/execution.service';
import { SubmitRequestDto } from '../api/dto/submit-request.dto';
import { JobStatusModel } from '../models/job.model';
import { ApiError } from '../models/api-error.model';
import { JobMonitorService, DEFAULT_POLL_INTERVAL_MS } from './job-monitor.service';
import { ExecutionStore } from './execution.store';
import { ExecutionNotificationService } from './execution-notification.service';
import { ExecutionStatus } from './execution-status.enum';
import { ExecutionSource, TrackedExecution } from './execution.model';

/** Acima de 2 minutos sem chegar a um estado terminal → SLOW. */
const SLOW_THRESHOLD_MS = 2 * 60 * 1000;
/** Acima de 10 minutos sem chegar a um estado terminal → TIMEOUT. */
const TIMEOUT_THRESHOLD_MS = 10 * 60 * 1000;

function generateExecutionId(): string {
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Orquestrador CENTRAL de execuções — único ponto de entrada que a UI
 * (Home, cards, etc.) deve conhecer. A Home NUNCA implementa polling,
 * lógica de timeout ou notificações: ela apenas chama
 * `ExecutionManagerService.startExecution(payload, source)` e consome o
 * estado reativo exposto pelo `ExecutionStore` (injetado separadamente
 * pelos componentes que precisam exibir o progresso).
 *
 * Responsabilidades:
 *   1) Submeter o request ao Gateway (via ExecutionService, já existente).
 *   2) Criar/atualizar a `TrackedExecution` correspondente no `ExecutionStore`.
 *   3) Iniciar o polling do job via `JobMonitorService` (nunca setInterval/setTimeout).
 *   4) Reclassificar o status observado em SLOW/TIMEOUT com base no tempo
 *      decorrido desde `startedAt` (regra de negócio, não vem do TDM).
 *   5) Disparar notificações padronizadas via `ExecutionNotificationService`
 *      nas transições relevantes (conclusão, falha, lentidão, artefato).
 *   6) Retomar o monitoramento de execuções ativas após um refresh (F5),
 *      lendo os handles persistidos pelo `ExecutionStore`.
 *
 * Reutilizável para QUALQUER Catalog/Card do TDM — não conhece nenhum
 * card específico, apenas recebe um payload genérico (`SubmitRequestDto`)
 * e uma origem (`ExecutionSource`) para fins de exibição/rastreamento.
 */
@Injectable({ providedIn: 'root' })
export class ExecutionManagerService implements OnDestroy {
  /** Assinaturas ativas de polling, por `executionId` — necessário para poder parar corretamente. */
  private readonly subscriptions = new Map<string, Subscription>();

  constructor(
    private readonly executionService: ExecutionService,
    private readonly jobMonitor: JobMonitorService,
    private readonly store: ExecutionStore,
    private readonly notifications: ExecutionNotificationService,
  ) {
    this.resumeFromPersistedHandles();
  }

  ngOnDestroy(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
    this.jobMonitor.stopAll();
  }

  /**
   * Inicia uma nova execução: submete o payload ao Gateway e, a partir do
   * jobId retornado, começa o monitoramento assíncrono automaticamente.
   *
   * Retorna o `id` da execução (gerado pelo Portal) imediatamente — a UI
   * pode usar esse id para localizar a execução no `ExecutionStore`
   * enquanto o job avança de status (ex.: `store.get(id)` num computed).
   */
  startExecution(
    payload: SubmitRequestDto,
    source: ExecutionSource,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  ): string {
    const executionId = generateExecutionId();
    const now = new Date();

    // Cria a entrada em PENDING imediatamente, antes mesmo da resposta
    // HTTP chegar — a UI já pode exibir "iniciando..." sem esperar.
    this.store.upsert({
      id: executionId,
      jobId: '',
      source,
      status: ExecutionStatus.PENDING,
      hasArtifact: false,
      startedAt: now,
      updatedAt: now,
      pollCount: 0,
    });

    this.notifications.info(`Execução "${source.cardLabel ?? source.cardId}" iniciada.`, executionId);

    this.executionService.execute(payload).subscribe({
      next: (execution) => {
        const jobId = execution.effectiveJobId ?? execution.requestedJobId;
        if (!jobId) {
          this.markFailed(executionId, 'O Gateway não retornou um jobId para esta execução.');
          return;
        }

        const hasArtifact = Boolean(execution.extractedContaInfo?.found) || Boolean(execution.sizeBytes);
        this.patch(executionId, { jobId, hasArtifact, status: ExecutionStatus.RUNNING });

        if (!execution.success) {
          this.markFailed(
            executionId,
            execution.message ?? 'A execução no TDM não foi concluída com sucesso.',
          );
          return;
        }

        // O backend atual (submit-and-download) já aguarda a conclusão
        // do job antes de responder — ou seja, quando chegamos aqui o
        // job já está em um estado terminal do lado do TDM. Ainda assim,
        // iniciamos o `trackJob` normalmente: caso o backend evolua para
        // responder de forma assíncrona (retornando o jobId sem esperar
        // a conclusão — necessário para jobs que levam vários minutos),
        // este mesmo fluxo passa a monitorar corretamente via polling,
        // sem qualquer alteração adicional nesta camada.
        this.trackJob(executionId, jobId, pollIntervalMs);
      },
      error: (error: ApiError) => {
        this.markFailed(executionId, error.message);
      },
    });

    return executionId;
  }

  /**
   * Inicia (ou retoma) o monitoramento assíncrono de um job já submetido
   * ao TDM, delegando o polling propriamente dito ao `JobMonitorService`.
   * A cada tick, reavalia o status observado, aplica as regras de
   * SLOW/TIMEOUT baseadas no tempo decorrido, atualiza o `ExecutionStore`
   * e dispara notificações nas transições relevantes.
   */
  private trackJob(executionId: string, jobId: string, pollIntervalMs: number): void {
    const subscription = this.jobMonitor.monitor(jobId, pollIntervalMs).subscribe({
      next: (jobStatus) => this.handlePollResult(executionId, jobStatus),
      error: (error: ApiError) => {
        this.markFailed(executionId, error.message ?? 'Falha ao consultar o status do job.');
      },
    });

    this.subscriptions.set(executionId, subscription);
  }

  private handlePollResult(executionId: string, jobStatus: JobStatusModel): void {
    const current = this.store.get(executionId);
    if (!current) {
      return;
    }

    const elapsedMs = Date.now() - current.startedAt.getTime();
    const normalizedStatus = String(jobStatus.status).toUpperCase();

    // 1) Estados terminais reportados diretamente pelo TDM têm prioridade.
    if (normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED') {
      this.markCompleted(executionId, current.hasArtifact ? ExecutionStatus.ARTIFACT_READY : ExecutionStatus.COMPLETED);
      return;
    }

    if (normalizedStatus === 'FAILED') {
      this.markFailed(executionId, jobStatus.message ?? 'O job falhou no Broadcom TDM.');
      return;
    }

    // 2) Caso ainda ativo (PENDING/RUNNING), reclassifica com base no
    // tempo decorrido — SLOW/TIMEOUT são estados DERIVADOS, não vêm do TDM.
    let derivedStatus: ExecutionStatus =
      normalizedStatus === 'PENDING' ? ExecutionStatus.PENDING : ExecutionStatus.RUNNING;

    if (elapsedMs >= TIMEOUT_THRESHOLD_MS) {
      derivedStatus = ExecutionStatus.TIMEOUT;
    } else if (elapsedMs >= SLOW_THRESHOLD_MS) {
      derivedStatus = ExecutionStatus.SLOW;
    }

    const statusChanged = current.status !== derivedStatus;

    this.patch(executionId, {
      status: derivedStatus,
      message: jobStatus.message,
      pollCount: current.pollCount + 1,
    });

    // Notifica apenas na TRANSIÇÃO para SLOW/TIMEOUT (não a cada poll).
    if (statusChanged && derivedStatus === ExecutionStatus.SLOW) {
      this.notifications.warning(
        `Job ${current.jobId} está demorando mais que o esperado (mais de 2 minutos).`,
        executionId,
      );
    }
    if (statusChanged && derivedStatus === ExecutionStatus.TIMEOUT) {
      this.notifications.warning(
        `Job ${current.jobId} excedeu 10 minutos em execução. O monitoramento continua.`,
        executionId,
      );
    }
  }

  private markCompleted(
    executionId: string,
    status: ExecutionStatus.COMPLETED | ExecutionStatus.ARTIFACT_READY,
  ): void {
    const current = this.store.get(executionId);
    this.patch(executionId, { status, finishedAt: new Date() });
    this.stopTracking(executionId);

    if (status === ExecutionStatus.ARTIFACT_READY) {
      this.notifications.success(
        `Job ${current?.jobId ?? executionId} concluído — artefato disponível.`,
        executionId,
      );
    } else {
      this.notifications.success(`Job ${current?.jobId ?? executionId} concluído.`, executionId);
    }
  }

  private markFailed(executionId: string, message: string): void {
    this.patch(executionId, { status: ExecutionStatus.FAILED, message, finishedAt: new Date() });
    this.stopTracking(executionId);
    this.notifications.error(message, executionId);
  }

  /** Aplica um patch parcial sobre a TrackedExecution existente e persiste no store. */
  private patch(executionId: string, changes: Partial<TrackedExecution>): void {
    const current = this.store.get(executionId);
    if (!current) {
      return;
    }
    this.store.upsert({
      ...current,
      ...changes,
      updatedAt: new Date(),
    });
  }

  /** Para o polling (JobMonitorService + assinatura local) de uma execução. */
  private stopTracking(executionId: string): void {
    const current = this.store.get(executionId);
    if (current?.jobId) {
      this.jobMonitor.stop(current.jobId);
    }
    const subscription = this.subscriptions.get(executionId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(executionId);
    }
  }

  /**
   * Ao inicializar a aplicação, lê os handles mínimos persistidos em
   * `sessionStorage` (ver `ExecutionStore.readPersistedHandles`) e
   * retoma automaticamente o polling de cada execução que ainda estava
   * ativa antes do refresh (F5) — sem exigir nenhuma ação do usuário.
   */
  private resumeFromPersistedHandles(): void {
    const handles = this.store.readPersistedHandles();

    for (const handle of handles) {
      // Reconstroi uma TrackedExecution minimamente válida a partir do
      // handle persistido — os demais campos (message, pollCount, etc.)
      // são reiniciados, pois não são persistidos por design.
      this.store.upsert({
        id: handle.id,
        jobId: handle.jobId,
        source: handle.source,
        status: handle.status,
        hasArtifact: false,
        startedAt: new Date(handle.startedAt),
        updatedAt: new Date(),
        pollCount: 0,
      });

      if (handle.jobId) {
        this.trackJob(handle.id, handle.jobId, DEFAULT_POLL_INTERVAL_MS);
      }
    }
  }
}
