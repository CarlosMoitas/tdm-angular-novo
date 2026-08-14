/**
 * Centraliza todos os caminhos de API consumidos através do Gateway (/gw)
 * do Portal TDM Broadcom.
 *
 * IMPORTANTE:
 * O Angular consome EXCLUSIVAMENTE o Gateway. Nenhuma URL, credencial ou
 * token do Broadcom TDM em si deve existir neste projeto — o Gateway é o
 * único responsável por essa comunicação.
 *
 * Nenhum outro arquivo do projeto deve concatenar strings de rota
 * manualmente — qualquer novo endpoint deve ser adicionado aqui primeiro.
 */
export const GATEWAY_ENDPOINTS = {
  // -----------------------------------------------------------------------
  // CONTRATOS CONFIRMADOS com o Gateway (validados com o time responsável)
  // -----------------------------------------------------------------------
  health: () => '/health',
  healthStatus: () => '/health/status',

  auth: {
    login: () => '/auth/login',
    logout: () => '/auth/logout',
    me: () => '/auth/me',
  },

  requests: {
    submitAndDownload: () => '/api/requests/submit-and-download',
  },

  jobs: {
    status: (jobId: string) => `/api/jobs/${jobId}/status`,
  },

  debug: {
    requestsRaw: () => '/api/debug/requests-raw',
  },

  // -----------------------------------------------------------------------
  // CONTRATOS PENDENTES DE VALIDAÇÃO
  //
  // Os endpoints abaixo NÃO foram confirmados com o time do Gateway/TDM.
  // Foram assumidos para viabilizar o desenvolvimento da Home com dados
  // mockados (ver core/api/mock). NÃO utilizar em produção
  // (environment.useMockData = false) sem validar o contrato real.
  // -----------------------------------------------------------------------
  pending: {
    catalogs: {
      list: () => '/catalogs',
    },
    cards: {
      list: () => '/cards',
      byCatalog: (catalogId: string) => `/catalogs/${catalogId}/cards`,
      execute: (cardId: string) => `/cards/${cardId}/execute`,
      executionStatus: (executionId: string) => `/executions/${executionId}`,
    },
  },
} as const;
