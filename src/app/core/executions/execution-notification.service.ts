import { Injectable, computed, signal } from '@angular/core';

export type ExecutionNotificationKind = 'success' | 'error' | 'warning' | 'info';

export interface ExecutionNotification {
  id: string;
  kind: ExecutionNotificationKind;
  message: string;
  createdAt: Date;
  /** ID da execução (TrackedExecution.id) relacionada, quando aplicável. */
  executionId?: string;
}

const MAX_NOTIFICATIONS = 50;

/**
 * Sistema PADRONIZADO e CENTRALIZADO de notificações de execuções.
 *
 * Nenhum componente deve montar mensagens de notificação diretamente —
 * toda a lógica de "o que dizer quando o job muda de estado" fica no
 * `ExecutionManagerService` (que decide QUANDO notificar, com base nas
 * transições de estado observadas), e este service apenas ARMAZENA e
 * EXPÕE a lista de notificações via Signal, para qualquer componente de
 * UI (toast, painel de notificações, badge no header, etc.) consumir.
 *
 * Exemplos de uso (chamados pelo ExecutionManagerService):
 *   - "✅ Job concluído"
 *   - "❌ Job falhou"
 *   - "⚠ Job demorando mais que o esperado"
 *   - "⚠ Artefato disponível para download"
 */
@Injectable({ providedIn: 'root' })
export class ExecutionNotificationService {
  private readonly _notifications = signal<ExecutionNotification[]>([]);

  readonly notifications = computed(() => this._notifications());
  readonly unread = computed(() => this._notifications().length);

  private notify(kind: ExecutionNotificationKind, message: string, executionId?: string): void {
    const notification: ExecutionNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      message,
      createdAt: new Date(),
      executionId,
    };

    this._notifications.update((current) => {
      const next = [notification, ...current];
      return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
    });
  }

  success(message: string, executionId?: string): void {
    this.notify('success', message, executionId);
  }

  error(message: string, executionId?: string): void {
    this.notify('error', message, executionId);
  }

  warning(message: string, executionId?: string): void {
    this.notify('warning', message, executionId);
  }

  info(message: string, executionId?: string): void {
    this.notify('info', message, executionId);
  }

  dismiss(id: string): void {
    this._notifications.update((current) => current.filter((n) => n.id !== id));
  }

  clear(): void {
    this._notifications.set([]);
  }
}
