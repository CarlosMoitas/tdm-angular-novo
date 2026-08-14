import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Subscription, catchError, interval, of, startWith, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { GatewayApiService } from '../api/gateway-api.service';
import { mapHealthStatusDtoToModel } from './health.mapper';
import { GatewayHealth } from './health.model';

const POLL_INTERVAL_MS = 60_000; // 1 minuto — o token do TDM é cacheado por
// 10 min no backend, então a maioria destas chamadas não gera login real.

const OFFLINE_HEALTH: GatewayHealth = {
  gateway: 'DOWN',
  tdm: 'DOWN',
  authentication: 'DOWN',
  readyForExecution: false,
  message: 'Não foi possível consultar o status da plataforma.',
  timestamp: new Date().toISOString(),
};

const CHECKING_HEALTH: GatewayHealth = {
  gateway: 'DOWN',
  tdm: 'DOWN',
  authentication: 'DOWN',
  readyForExecution: false,
  message: 'Verificando status da plataforma...',
  timestamp: new Date().toISOString(),
};

/**
 * Mantém o health check ENTERPRISE da plataforma atualizado via Signals,
 * com polling leve (1x por minuto) e verificação imediata na
 * inicialização.
 *
 * Diferente do antigo `core/services/health.service.ts` (que só verificava
 * se o processo do Gateway respondia HTTP), este serviço consulta
 * GET /gw/health/status, que valida a cadeia completa: Gateway → TDM →
 * Autenticação — respondendo à pergunta real do usuário: "posso executar
 * um card agora?" (`readyForExecution`).
 *
 * Consumido exclusivamente pela `HealthFacade` — nenhum componente de UI
 * (Navbar, etc.) deve injetar este serviço diretamente.
 */
@Injectable({ providedIn: 'root' })
export class HealthService implements OnDestroy {
  private readonly _health = signal<GatewayHealth>(CHECKING_HEALTH);
  private readonly _hasReceivedFirstResponse = signal(false);

  readonly health = computed(() => this._health());
  readonly hasReceivedFirstResponse = computed(() => this._hasReceivedFirstResponse());

  private readonly subscription: Subscription;

  constructor(private readonly gatewayApi: GatewayApiService) {
    this.subscription = interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.gatewayApi.healthStatus().pipe(
            map((dto) => mapHealthStatusDtoToModel(dto)),
            catchError(() => of(OFFLINE_HEALTH)),
          ),
        ),
      )
      .subscribe((result) => {
        this._health.set(result);
        this._hasReceivedFirstResponse.set(true);
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
