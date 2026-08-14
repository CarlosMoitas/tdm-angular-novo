/**
 * Contratos de autenticação corporativa deste servidor.
 *
 * IMPORTANTE — fronteira de segurança:
 * Este é o login do PORTAL (usuário corporativo do Angular), e é
 * completamente independente das credenciais do Broadcom TDM
 * (ver server/src/tdm). O JWT emitido aqui nunca contém o token do TDM.
 */
export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  name?: string;
  roles: string[];
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: AuthenticatedUser;
}

/** Payload assinado dentro do JWT emitido por este servidor. */
export interface JwtPayload {
  sub: string;
  username: string;
  name?: string;
  roles: string[];
}
