import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { GatewayApiService } from '../api/gateway-api.service';
import { mapLoginResponseDtoToLoginResponse } from '../api/mappers/auth.mapper';
import { AuthenticatedUser, LoginRequest, LoginResponse } from '../models/auth.model';

const TOKEN_KEY = 'tdm_access_token';
const USER_KEY = 'tdm_authenticated_user';

/**
 * Sessão do PORTAL (usuário corporativo do Angular).
 *
 * IMPORTANTE — fronteira de segurança:
 * O token gerenciado aqui é a SESSÃO DO PORTAL (JWT emitido por este
 * projeto, via `POST /gw/auth/login`, servido pelo servidor próprio em
 * `server/`), NUNCA uma credencial do Broadcom TDM em si. O Angular não
 * conhece, não armazena e não envia usuário/senha/token do TDM — essa
 * responsabilidade é inteiramente do servidor (`server/src/tdm`).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _user = signal<AuthenticatedUser | null>(this.restoreUser());

  readonly token = computed(() => this._token());
  readonly user = computed(() => this._user());
  readonly isAuthenticated = computed(() => !!this._token());

  constructor(private readonly gatewayApi: GatewayApiService) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.gatewayApi.login(credentials).pipe(
      map(mapLoginResponseDtoToLoginResponse),
      tap((response) => this.setSession(response)),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  getToken(): string | null {
    return this._token();
  }

  private setSession(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this._token.set(response.token);
    this._user.set(response.user);
  }

  private restoreUser(): AuthenticatedUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthenticatedUser;
    } catch {
      return null;
    }
  }
}
