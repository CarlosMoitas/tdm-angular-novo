/**
 * Contrato de resposta de POST /gw/auth/login.
 */
export interface AuthenticatedUserDto {
  id: string;
  username: string;
  name?: string;
  roles: string[];
}

export interface LoginResponseDto {
  token: string;
  expiresAt: string;
  user: AuthenticatedUserDto;
}
