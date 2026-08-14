import { LoginResponseDto } from '../dto/login-response.dto';
import { AuthenticatedUser, LoginResponse } from '../../models/auth.model';

export function mapLoginResponseDtoToLoginResponse(dto: LoginResponseDto): LoginResponse {
  return {
    token: dto.token,
    expiresAt: dto.expiresAt,
    user: mapAuthenticatedUserDto(dto.user),
  };
}

function mapAuthenticatedUserDto(dto: LoginResponseDto['user']): AuthenticatedUser {
  return {
    id: dto.id,
    username: dto.username,
    name: dto.name,
    roles: dto.roles,
  };
}
