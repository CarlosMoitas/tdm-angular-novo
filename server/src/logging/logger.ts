/**
 * Logger padronizado do servidor. Todos os logs registram o
 * `correlationId` (quando disponível) para permitir rastreamento
 * ponta a ponta com o Angular e com o TDM.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function tag(correlationId?: string): string {
  return correlationId ? ` [cid:${correlationId}]` : '';
}

function write(level: LogLevel, message: string, correlationId?: string, meta?: unknown): void {
  const prefix = `[${level.toUpperCase()}]${tag(correlationId)}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (meta !== undefined) {
    fn(prefix, message, meta);
  } else {
    fn(prefix, message);
  }
}

export const logger = {
  debug: (message: string, correlationId?: string, meta?: unknown) =>
    write('debug', message, correlationId, meta),
  info: (message: string, correlationId?: string, meta?: unknown) =>
    write('info', message, correlationId, meta),
  warn: (message: string, correlationId?: string, meta?: unknown) =>
    write('warn', message, correlationId, meta),
  error: (message: string, correlationId?: string, meta?: unknown) =>
    write('error', message, correlationId, meta),
};
