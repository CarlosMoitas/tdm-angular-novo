import { env } from '../config/env';
import { tdmClient } from '../tdm/tdm.client';
import { AppError } from '../middleware/error.middleware';
import { HealthCheckResult } from './health.types';

/**
 * Health check enterprise: valida a cadeia completa necessária para o
 * Portal executar requests reais no Broadcom TDM, e não apenas se este
 * processo Node está de pé.
 *
 * Camadas verificadas, em ordem:
 *   1) gateway         → sempre 'UP' se chegamos a executar este código
 *   2) tdm              → TDM_BASE_URL configurada nesta instância
 *   3) authentication   → login real no TDM (via tdmClient.tdmLogin) obtido com sucesso
 *   4) readyForExecution → true somente se as 3 camadas acima estiverem 'UP'
 *
 * IMPORTANTE: reaproveita `tdmClient.tdmLogin()` (já usado nas submissões
 * reais) em vez de duplicar lógica de autenticação. Como o token é
 * cacheado por 10 minutos (ver tdm.client.ts), a maioria das chamadas a
 * este health check não gera login real no TDM — só quando o cache
 * expira, mantendo o custo de rede baixo mesmo com polling frequente.
 */
async function checkHealth(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();

  // Camada 1 — Gateway: se este código está executando, o processo está de pé.
  const gateway: HealthCheckResult['gateway'] = 'UP';

  // Camada 2 — TDM: a URL base precisa estar configurada nesta instância.
  const tdmUrlConfigured = Boolean(env.tdm.baseUrl);

  if (!tdmUrlConfigured) {
    return {
      gateway,
      tdm: 'DOWN',
      authentication: 'DOWN',
      readyForExecution: false,
      message: 'TDM_BASE_URL não configurada neste servidor.',
      timestamp,
    };
  }

  // Camada 3 — Authentication: tenta obter (ou reaproveitar do cache) um
  // token real do TDM. Só falha se as credenciais estiverem ausentes,
  // incorretas, ou se o TDM estiver inacessível/fora do ar.
  try {
    await tdmClient.tdmLogin();

    return {
      gateway,
      tdm: 'UP',
      authentication: 'UP',
      readyForExecution: true,
      message: 'Portal pronto para executar requests.',
      timestamp,
    };
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : 'Falha ao autenticar no Broadcom TDM.';

    return {
      gateway,
      tdm: 'DOWN',
      authentication: 'DOWN',
      readyForExecution: false,
      message,
      timestamp,
    };
  }
}

export const healthService = { checkHealth };
