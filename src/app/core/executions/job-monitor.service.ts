import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { JobService } from '../services/job.service';
import { JobStatusModel } from '../models/job.model';

/** Intervalo padrão de polling, em milissegundos (requisito: 5 segundos). */
export const DEFAULT_POLL_INTERVAL_MS = 5_000;

/**
 * Motor de POLLING CENTRALIZADO — o único ponto do sistema autorizado a
 * consultar `GET /gw/api/jobs/:jobId/status` repetidamente ao longo do
 * tempo.
 *
 * IMPORTANTE — regra arquitetural: nenhum componente de UI (Home, cards,
 * etc.) deve usar `setInterval`/`setTimeout` diretamente para acompanhar
 * um job. Toda a responsabilidade de "perguntar de novo em N segundos"
 * fica exclusivamente aqui, usando RxJS (`timer` + `switchMap`), nunca
 * temporizadores nativos do browser espalhados pelo código.
 *
 * Este service é DELIBERADAMENTE agnóstico de regras de negócio (SLOW,
 * TIMEOUT, notificações, etc.) — ele apenas entrega o status bruto do
 * job a cada tick. Essas regras ficam no `ExecutionManagerService`, que é
 * quem decide como interpretar o resultado de cada poll.
 *
 * Fluxo:
 *   ExecutionManagerService
 *     ↓
 *   JobMonitorService.monitor(jobId)
 *     ↓
 *   GET /gw/api/jobs/{jobId}/status  (via JobService)
 *     ↓
 *   Gateway
 *     ↓
 *   Broadcom TDM
 */
@Injectable({ providedIn: 'root' })
export class JobMonitorService {
  private readonly stopSignals = new Map<string, Subject<void>>();

  constructor(private readonly jobService: JobService) {}

  /**
   * Inicia o polling de um job específico, emitindo o status bruto a
   * cada `intervalMs` (padrão: 5s, configurável por chamada — requisito
   * explícito de intervalo configurável).
   *
   * A emissão continua indefinidamente até `stop(jobId)` ser chamado
   * (tipicamente pelo `ExecutionManagerService`, quando o job atinge um
   * estado terminal estável) — este service não decide quando parar por
   * conta própria, pois não interpreta o significado de negócio do
   * status.
   */
  monitor(jobId: string, intervalMs: number = DEFAULT_POLL_INTERVAL_MS): Observable<JobStatusModel> {
    this.stop(jobId); // garante que não haja duas assinaturas ativas para o mesmo job

    const stopSignal = new Subject<void>();
    this.stopSignals.set(jobId, stopSignal);

    return timer(0, intervalMs).pipe(
      switchMap(() => this.jobService.getStatus(jobId)),
      takeUntil(stopSignal),
      tap({
        // Ao completar, limpa a referência para não acumular Subjects.
        complete: () => this.stopSignals.delete(jobId),
      }),
    );
  }

  /** Interrompe o polling de um job específico, se estiver ativo. */
  stop(jobId: string): void {
    const stopSignal = this.stopSignals.get(jobId);
    if (stopSignal) {
      stopSignal.next();
      stopSignal.complete();
      this.stopSignals.delete(jobId);
    }
  }

  /** Interrompe TODOS os pollings ativos (ex.: logout do usuário). */
  stopAll(): void {
    for (const jobId of Array.from(this.stopSignals.keys())) {
      this.stop(jobId);
    }
  }
}
