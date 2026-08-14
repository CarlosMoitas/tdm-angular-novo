import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import https from 'https';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../logging/logger';

/**
 * Cliente HTTP responsável exclusivamente por falar com o Broadcom TDM.
 *
 * IMPORTANTE — fronteira de segurança:
 * Este é o ÚNICO ponto do sistema que conhece credenciais/token do TDM.
 * O Angular nunca tem acesso a estas credenciais nem a este módulo — ele
 * fala apenas com as rotas HTTP deste servidor.
 *
 * Replica os conceitos do gateway legado (login com cache, retry em
 * 401/403), mas como implementação nova e isolada.
 */
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutos

let cachedToken: string | null = null;
let cachedTokenAtMs = 0;

/**
 * Login TÉCNICO do servidor no TDM, usando as credenciais fixas
 * configuradas em `TDM_USERNAME`/`TDM_PASSWORD` (env). Usado para todas
 * as chamadas de submissão/consulta de jobs feitas pelo servidor em nome
 * do Portal — independente de qual usuário está logado no Angular.
 */
async function tdmLogin(options: { force?: boolean } = {}): Promise<string> {
  const now = Date.now();

  if (!options.force && cachedToken && now - cachedTokenAtMs < TOKEN_TTL_MS) {
    return cachedToken as string;
  }

  if (!options.force && env.tdm.bearerToken) {
    cachedToken = env.tdm.bearerToken;
    cachedTokenAtMs = now;
    return cachedToken;
  }

  if (!env.tdm.baseUrl || !env.tdm.username || !env.tdm.password) {
    throw new AppError(
      500,
      'Credenciais do Broadcom TDM não configuradas neste servidor (TDM_BASE_URL/TDM_USERNAME/TDM_PASSWORD).',
    );
  }

  const token = await performTdmLogin(env.tdm.username, env.tdm.password);
  cachedToken = token;
  cachedTokenAtMs = now;
  return token;
}

/**
 * Executa o login no TDM (`POST /TestDataManager/user/login`) com um
 * usuário/senha ARBITRÁRIOS — sem depender do cache técnico do servidor.
 *
 * Usado por `AuthService.login()` (opção 3 de autenticação corporativa):
 * a sessão do Portal passa a ser validada diretamente contra o Broadcom
 * TDM, reaproveitando as mesmas permissões de acesso/execução já
 * existentes no TDM Portal — sem precisar de LDAP/SSO corporativo
 * adicional. Lança `AppError(401, ...)` se as credenciais forem
 * rejeitadas pelo TDM.
 */
async function verifyTdmCredentials(username: string, password: string): Promise<void> {
  if (!env.tdm.baseUrl) {
    throw new AppError(500, 'TDM_BASE_URL não configurada neste servidor.');
  }

  await performTdmLogin(username, password);
}

async function performTdmLogin(username: string, password: string): Promise<string> {
  const url = `${env.tdm.baseUrl}/TestDataManager/user/login`;
  const response = await axios.post(url, null, {
    httpsAgent,
    headers: { Accept: 'application/json' },
    auth: { username, password },
    validateStatus: () => true,
  });

  if (response.status === 401 || response.status === 403) {
    throw new AppError(401, 'Usuário ou senha do TDM inválidos.', 'TDM_LOGIN_UNAUTHORIZED');
  }

  if (response.status < 200 || response.status >= 300) {
    throw new AppError(
      502,
      `Falha no login do TDM (status ${response.status}).`,
      'TDM_LOGIN_FAILED',
      response.data,
    );
  }

  const token = response.data?.token;
  if (!token) {
    throw new AppError(502, 'Login do TDM não retornou token.', 'TDM_LOGIN_NO_TOKEN');
  }

  return token;
}

/**
 * Executa uma requisição contra o TDM anexando o Bearer Token TÉCNICO do
 * servidor (`tdmLogin`), com um retry automático em caso de 401/403
 * (token expirado/invalidado).
 */
export async function tdmRequest<T = unknown>(
  config: AxiosRequestConfig,
  correlationId?: string,
): Promise<AxiosResponse<T>> {
  let token = await tdmLogin();

  const doRequest = (bearer: string) =>
    axios<T>({
      httpsAgent,
      validateStatus: () => true,
      ...config,
      headers: {
        Accept: 'application/json',
        ...(config.headers ?? {}),
        Authorization: `Bearer ${bearer}`,
      },
    });

  let response = await doRequest(token);

  if (response.status === 401 || response.status === 403) {
    logger.warn('Token do TDM expirado/invalidado; refazendo login.', correlationId);
    token = await tdmLogin({ force: true });
    response = await doRequest(token);
  }

  return response;
}

export const tdmClient = { tdmLogin, tdmRequest, verifyTdmCredentials };
