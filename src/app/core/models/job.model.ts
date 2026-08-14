export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | string;

export interface JobStatusModel {
  jobId: string;
  status: JobStatus;
  message?: string;
  updatedAt?: Date;
}
