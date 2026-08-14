import { Component, Input, computed } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { HealthFacade, NavbarConnectionStatus } from '../../../core/health/health.facade';

export type ConnectionStatus = NavbarConnectionStatus;

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  @Input() userName = '';

  /**
   * Status REAL da plataforma (Gateway + TDM + Autenticação), obtido via
   * `HealthFacade` — a Navbar apenas consome um estado já processado; ela
   * não executa validações, não conhece detalhes do TDM e não faz
   * chamadas HTTP diretamente (ver core/health/).
   */
  readonly connectionStatus = computed<ConnectionStatus>(() => this.healthFacade.connectionStatus());
  readonly healthMessage = computed(() => this.healthFacade.message());

  constructor(
    readonly themeService: ThemeService,
    private readonly healthFacade: HealthFacade,
  ) {}

  get connectionLabel(): string {
    switch (this.connectionStatus()) {
      case 'ready':
        return 'Gateway Online';
      case 'degraded':
        return 'Gateway Indisponível';
      default:
        return 'Verificando conexão...';
    }
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
