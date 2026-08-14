import { SubmitResponseDto } from '../dto/submit-response.dto';
import { Execution } from '../../models/execution.model';

export function mapSubmitResponseDtoToExecution(dto: SubmitResponseDto): Execution {
  return {
    success: dto.success,
    requestedJobId: dto.requestedJobId !== undefined ? String(dto.requestedJobId) : undefined,
    childJobId: dto.childJobId !== undefined ? String(dto.childJobId) : undefined,
    effectiveJobId: dto.effectiveJobId !== undefined ? String(dto.effectiveJobId) : undefined,
    parentStatus: dto.parentStatus,
    childStatus: dto.childStatus,
    sizeBytes: dto.sizeBytes,
    message: dto.message,
    extractedContaInfo: dto.extractedContaInfo,
  };
}
