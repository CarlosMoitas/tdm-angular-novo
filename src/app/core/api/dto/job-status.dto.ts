/**
 * Contrato CONFIRMADO: GET /gw/api/jobs/:jobId/status
 */
export type JobStatusValue = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | string;

export interface JobStatusDto {
  jobId: string;
  status: JobStatusValue;
  message?: string;
  updatedAt?: string;
}
