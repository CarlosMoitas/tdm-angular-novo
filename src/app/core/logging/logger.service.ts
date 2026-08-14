import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Serviço de observabilidade centralizado.
 *
 * Em produção os logs de debug/info são silenciados automaticamente,
 * mantendo o console limpo. Erros e warnings continuam sendo emitidos
 * (podem futuramente ser encaminhados para uma ferramenta de APM/Sentry).
 *
 * Todos os métodos aceitam um `correlationId` opcional, permitindo
 * correlacionar um log do frontend com o mesmo request rastreado no
 * Gateway/TDM (ver correlation-id.interceptor.ts).
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isProduction = environment.production;

  debug(message: string, correlationId?: string, ...args: unknown[]): void {
    if (!this.isProduction) {
      console.debug(`[DEBUG]${this.tag(correlationId)} ${message}`, ...args);
    }
  }

  info(message: string, correlationId?: string, ...args: unknown[]): void {
    if (!this.isProduction) {
      console.info(`[INFO]${this.tag(correlationId)} ${message}`, ...args);
    }
  }

  warn(message: string, correlationId?: string, ...args: unknown[]): void {
    console.warn(`[WARN]${this.tag(correlationId)} ${message}`, ...args);
  }

  error(message: string, correlationId?: string, ...args: unknown[]): void {
    console.error(`[ERROR]${this.tag(correlationId)} ${message}`, ...args);
  }

  private tag(correlationId?: string): string {
    return correlationId ? ` [cid:${correlationId}]` : '';
  }
}
