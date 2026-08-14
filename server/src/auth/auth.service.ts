import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { tdmClient } from '../tdm/tdm.client';
import { AuthenticatedUser, JwtPayload, LoginRequest, LoginResponse } from './auth.types';

/**
 * Autenticação corporativa do Portal.
 *
 * IMPORTANTE — decisão arquitetural (opção 3 adotada):
 * O login do Portal NÃO usa uma base de usuários própria — ele valida o
 * usuário/senha digitados DIRETAMENTE contra o Broadcom TDM (mesma rotina
 * usada pelo `tdmClient`), reaproveitando as permissões de acesso e
 * execução já existentes no TDM Portal. Isso evita duplicar uma base de
 * credenciais e integrar um provedor de identidade corporativo adicional
 * (LDAP/SSO), aproveitando que o próprio TDM já expõe autenticação via
 * Basic Auth em `/TestDataManager/user/login`.
 *
 * O JWT emitido aqui é EXCLUSIVAMENTE a sessão do Portal (nunca contém o
 * token do TDM) — ele apenas certifica que o usuário passou pela
 * validação de credenciais do TDM no momento do login.
 */
export class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const { username, password } = request;

    if (!username || !password) {
      throw new AppError(400, 'Informe usuário e senha.');
    }

    // Valida as credenciais diretamente contra o Broadcom TDM. Lança
    // AppError(401, ...) automaticamente se forem rejeitadas.
    await tdmClient.verifyTdmCredentials(username, password);

    const user: AuthenticatedUser = {
      id: username,
      username,
      roles: ['user'],
    };

    const token = this.issueToken(user);

    return {
      token,
      expiresAt: this.resolveExpiresAt(),
      user,
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, env.jwt.secret) as JwtPayload;
    } catch {
      throw new AppError(401, 'Sessão inválida ou expirada.');
    }
  }

  private issueToken(user: AuthenticatedUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      name: user.name,
      roles: user.roles,
    };

    const options: SignOptions = { expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'] };
    return jwt.sign(payload, env.jwt.secret, options);
  }

  private resolveExpiresAt(): string {
    const durationMs = this.parseExpiresInToMs(env.jwt.expiresIn);
    return new Date(Date.now() + durationMs).toISOString();
  }

  private parseExpiresInToMs(expiresIn: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn.trim());
    if (!match) {
      return 8 * 60 * 60 * 1000; // fallback: 8h
    }

    const value = Number(match[1]);
    const unit = match[2];
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * unitMs[unit];
  }
}

export const authService = new AuthService();
