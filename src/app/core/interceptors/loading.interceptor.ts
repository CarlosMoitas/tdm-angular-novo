import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/**
 * Permite marcar requisições de background (ex.: health check em polling)
 * para que NÃO acionem o overlay de loading global.
 * Uso: `this.http.get(url, { context: new HttpContext().set(SKIP_LOADING, true) })`
 */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

/**
 * Incrementa/decrementa o contador global de loading a cada requisição HTTP,
 * dispensando cada Facade/Service de controlar manualmente um spinner.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADING)) {
    return next(req);
  }

  const loadingService = inject(LoadingService);

  loadingService.show();

  return next(req).pipe(finalize(() => loadingService.hide()));
};
