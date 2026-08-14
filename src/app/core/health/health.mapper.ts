import { HealthStatusResponseDto } from './health.dto';
import { GatewayHealth } from './health.model';

export function mapHealthStatusDtoToModel(dto: HealthStatusResponseDto): GatewayHealth {
  return {
    gateway: dto.gateway,
    tdm: dto.tdm,
    authentication: dto.authentication,
    readyForExecution: dto.readyForExecution,
    message: dto.message,
    timestamp: dto.timestamp,
  };
}
