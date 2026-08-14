import { Injectable, computed, signal } from '@angular/core';

/**
 * Controla o loading global da aplicação através de um contador de
 * requisições em andamento, permitindo múltiplas chamadas simultâneas
 * ao TDM sem que o overlay "pisque" (flicker) entre elas — o overlay só
 * desaparece quando TODAS as chamadas em curso são concluídas.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _activeRequests = signal(0);

  readonly isLoading = computed(() => this._activeRequests() > 0);

  show(): void {
    this._activeRequests.update((count) => count + 1);
  }

  hide(): void {
    this._activeRequests.update((count) => Math.max(0, count - 1));
  }
}
