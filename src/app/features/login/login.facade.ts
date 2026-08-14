import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/models/api-error.model';
import { LoggerService } from '../../core/logging/logger.service';

/**
 * Facade da feature Login. Isola o componente `Login` do AuthService,
 * concentrando estado (signals) e navegação pós-login, seguindo o mesmo
 * padrão adotado em `HomeFacade`.
 */
@Injectable({ providedIn: 'root' })
export class LoginFacade {
  private readonly _loading = signal(false);
  private readonly _errorMessage = signal<string | null>(null);

  readonly loading = computed(() => this._loading());
  readonly errorMessage = computed(() => this._errorMessage());

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly logger: LoggerService,
  ) {}

  submit(username: string, password: string): void {
    this._errorMessage.set(null);

    if (!username || !password) {
      this._errorMessage.set('Informe usuário e senha.');
      return;
    }

    this._loading.set(true);

    this.authService.login({ username, password }).subscribe({
      next: () => {
        this._loading.set(false);
        this.logger.info('Login realizado com sucesso');
        this.router.navigateByUrl('/');
      },
      error: (error: ApiError) => {
        this._loading.set(false);
        this.logger.error('Falha ao realizar login', error.correlationId, error);
        this._errorMessage.set(error.message ?? 'Usuário ou senha inválidos.');
      },
    });
  }
}
