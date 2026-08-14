import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { correlationIdInterceptor } from './core/interceptors/correlation-id.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { retryInterceptor } from './core/interceptors/retry.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Ordem de execução: correlationId (rastreamento) → auth (injeta token) →
    // loading (mostra spinner) → retry (tenta novamente falhas transitórias
    // de GET) → error (normaliza a falha final, usando o mesmo correlationId)
    provideHttpClient(
      withInterceptors([
        correlationIdInterceptor,
        authInterceptor,
        loadingInterceptor,
        retryInterceptor,
        errorInterceptor,
      ]),
    )
  ]
};
