export interface ExecuteCardRequestDto {
  cardId: string;
  environment?: string;
}

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface ExecuteCardResponseDto {
  executionId: string;
  status: ExecutionStatus;
  startedAt: string;
}

export interface ExecutionStatusResponseDto {
  executionId: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  message?: string;
}
