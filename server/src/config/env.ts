import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuração central de variáveis de ambiente deste servidor.
 * Nenhum outro arquivo deve ler `process.env` diretamente — sempre
 * através deste módulo, garantindo um único ponto de validação.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-secret-troque-em-producao',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },

  tdm: {
    baseUrl: process.env.TDM_BASE_URL ?? '',
    username: process.env.TDM_USERNAME ?? '',
    password: process.env.TDM_PASSWORD ?? '',
    bearerToken: process.env.TDM_BEARER_TOKEN ?? '',
    origin: process.env.TDM_ORIGIN || process.env.TDM_BASE_URL || '',
    referer:
      process.env.TDM_REFERER || `${process.env.TDM_ORIGIN || process.env.TDM_BASE_URL || ''}/`,
  },
};

export { required };
