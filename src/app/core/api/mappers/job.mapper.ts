import { JobStatusDto } from '../dto/job-status.dto';
import { JobStatusModel } from '../../models/job.model';

export function mapJobStatusDtoToModel(dto: JobStatusDto): JobStatusModel {
  return {
    jobId: dto.jobId,
    status: dto.status,
    message: dto.message,
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
  };
}
