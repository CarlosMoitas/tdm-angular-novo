import { Injectable, computed } from '@angular/core';
import { HealthService } from './health.service';

export type NavbarConnectionStatus = 'checking' | 'ready' | 'degraded';

/**
 * Facade do módulo de health check enterprise. Isola completamente a
 * Navbar (e qualquer outro consumidor de UI) da lógica de verificação de
 * saúde da plataforma — a Navbar NÃO deve executar validações, conhecer
 * detalhes do TDM, nem fazer chamadas HTTP: ela apenas lê o estado já
 * processado exposto aqui.
 *
 * `connectionStatus` traduz o resultado bruto do health check em um
 * estado simples de apresentação:
 *   - 'checking'  → ainda não houve a primeira resposta do backend
 *   - 'ready'      → readyForExecution = true (Gateway + TDM + Auth OK)
 *   - 'degraded'   → qualquer camada DOWN (mesmo que o Gateway responda)
 */
@Injectable({ providedIn: 'root' })
export class HealthFacade {
  readonly health = computed(() => this.healthService.health());

  readonly connectionStatus = computed<NavbarConnectionStatus>(() => {
    if (!this.healthService.hasReceivedFirstResponse()) {
      return 'checking';
    }
    return this.healthService.health().readyForExecution ? 'ready' : 'degraded';
  });

  readonly message = computed(() => this.healthService.health().message);

  constructor(private readonly healthService: HealthService) {}
}
