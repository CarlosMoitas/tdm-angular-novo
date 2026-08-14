/**
 * Contrato de POST /gw/auth/login.
 * Este é o login do PORTAL (usuário corporativo do Angular) — nunca as
 * credenciais do Broadcom TDM, que são conhecidas apenas pelo servidor.
 */
export interface LoginRequestDto {
  username: string;
  password: string;
}
