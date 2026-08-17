import { env } from '../config/env';
import { tdmRequest } from './tdm.client';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../logging/logger';
import { savePayload } from '../storage/storage.service';
import { extractAccountInfoFromZip, ExtractedAccountInfo } from '../storage/artifact-extractor';
import { SubmitRequestPayload, SubmitResponse, TdmJob } from './tdm.types';

function normalizeStatus(status?: string): string {
  return String(status ?? '').trim().toLowerCase();
}

function isCompleted(status?: string): boolean {
  return normalizeStatus(status) === 'completed';
}

function extractJobId(response: SubmitResponse): number | null {
  const jobId = response.jobId ?? response.id ?? response.data?.jobId ?? response.data?.id;
  return jobId != null ? Number(jobId) : null;
}

function isTerminalStatus(status?: string): boolean {
  return ['completed', 'failed', 'cancelled', 'canceled'].includes(normalizeStatus(status));
}

function pickDownloadableChildJob(job: TdmJob): TdmJob | null {
  const children = Array.isArray(job.jobs) ? job.jobs : [];

  return (
    children.find(
      (child) =>
        String(child.type ?? '').toUpperCase() === 'PUBLISH' &&
        isCompleted(child.status) &&
        child.artifactLocation,
    ) ??
    children.find(
      (child) => String(child.type ?? '').toUpperCase() === 'PUBLISH' && isCompleted(child.status),
    ) ??
    children.find((child) => isCompleted(child.status) && child.artifactLocation) ??
    children.find((child) => isCompleted(child.status)) ??
    null
  );
}

async function fetchJobDetails(jobId: number, correlationId?: string): Promise<TdmJob> {
  const url = `${env.tdm.baseUrl}/TDMJobService/api/ca/v1/jobs/${jobId}`;
  const response = await tdmRequest<TdmJob>({ method: 'GET', url }, correlationId);

  if (response.status < 200 || response.status >= 300) {
    throw new AppError(502, `TDM retornou erro ao consultar o job ${jobId}.`, 'TDM_JOB_STATUS_FAILED');
  }

  return response.data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJobCompletion(
  jobId: number,
  correlationId?: string,
  options: { maxAttempts?: number; delayMs?: number } = {},
): Promise<{ parentJob: TdmJob; childJob: TdmJob | null }> {
  const maxAttempts = options.maxAttempts ?? 24;
  const delayMs = options.delayMs ?? 5000;

  let lastParentJob: TdmJob | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const parentJob = await fetchJobDetails(jobId, correlationId);
      lastParentJob = parentJob;
      lastError = null;

      const childJob = pickDownloadableChildJob(parentJob);

      if (isCompleted(parentJob.status) && (!childJob || isCompleted(childJob.status))) {
        return { parentJob, childJob };
      }

      if (
        isCompleted(parentJob.status) &&
        Array.isArray(parentJob.jobs) &&
        parentJob.jobs.length > 0 &&
        parentJob.jobs.every((child) => isTerminalStatus(child.status))
      ) {
        const completedChild = pickDownloadableChildJob(parentJob);

        if (completedChild) {
          logger.warn(
            `Job pai ${jobId} concluído sem marcar filho selecionado como concluído, mas existe child completed terminal. Assumindo sucesso pelo child job.`,
            correlationId,
            {
              parentStatus: parentJob.status,
              childStatuses: parentJob.jobs.map((child) => ({
                jobId: child.jobId,
                status: child.status,
                type: child.type,
              })),
              selectedChildJobId: completedChild.jobId,
            },
          );

          return { parentJob, childJob: completedChild };
        }
      }

      if (['failed', 'cancelled', 'canceled'].includes(normalizeStatus(parentJob.status))) {
        throw new AppError(
          502,
          `O job ${jobId} terminou com status ${parentJob.status}.`,
          'TDM_JOB_FAILED',
          parentJob,
        );
      }
    } catch (error) {
      // Falha DEFINITIVA (status failed/cancelled) deve interromper imediatamente.
      if (error instanceof AppError && error.code === 'TDM_JOB_FAILED') {
        throw error;
      }

      // Falha TRANSITÓRIA ao consultar o status (ex.: instabilidade momentânea
      // do TDM) não deve abortar o polling — apenas registra e tenta de novo.
      lastError = error;
      logger.warn(
        `Falha transitória ao consultar status do job ${jobId} (tentativa ${attempt}/${maxAttempts}). Tentando novamente.`,
        correlationId,
        error,
      );
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new AppError(
    504,
    `Timeout aguardando a conclusão do job ${jobId}.`,
    'TDM_JOB_TIMEOUT',
    lastParentJob,
  );
}

async function downloadArtifact(
  jobId: number,
  correlationId?: string,
): Promise<{ buffer: Buffer; sizeBytes: number }> {
  const url = `${env.tdm.baseUrl}/TDMJobService/api/ca/v1/jobs/${jobId}/actions/downloadArtifact`;
  const response = await tdmRequest<ArrayBuffer>(
    {
      method: 'POST',
      url,
      headers: { Accept: 'application/octet-stream, application/zip, */*' },
      responseType: 'arraybuffer',
    },
    correlationId,
  );

  if (response.status < 200 || response.status >= 300) {
    throw new AppError(502, `TDM retornou erro ao baixar o artefato do job ${jobId}.`, 'TDM_DOWNLOAD_FAILED');
  }

  const buffer = Buffer.from(response.data);
  return { buffer, sizeBytes: buffer.length };
}

async function submitAndDownload(
  payload: SubmitRequestPayload,
  correlationId?: string,
): Promise<{
  requestedJobId: number;
  childJobId: number | null;
  effectiveJobId: number;
  parentStatus?: string;
  childStatus?: string;
  artifact: { buffer: Buffer; sizeBytes: number };
  extractedContaInfo: ExtractedAccountInfo;
}> {
  const url = `${env.tdm.baseUrl}/TDMDataFlowService/api/ca/v1/requests`;

  const submitResponse = await tdmRequest<SubmitResponse>(
    {
      method: 'POST',
      url,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        Origin: env.tdm.origin,
        Referer: env.tdm.referer,
        'X-Requested-With': 'tdm-angular-novo',
      },
    },
    correlationId,
  );

  if (submitResponse.status < 200 || submitResponse.status >= 300) {
    throw new AppError(
      502,
      'TDM retornou erro ao executar o request.',
      'TDM_SUBMIT_FAILED',
      submitResponse.data,
    );
  }

  const requestedJobId = extractJobId(submitResponse.data);
  if (!requestedJobId) {
    throw new AppError(502, 'TDM não retornou jobId após a submissão.', 'TDM_SUBMIT_NO_JOB_ID');
  }

  logger.info('Request submetido ao TDM', correlationId, { requestedJobId });

  // Persiste o payload exato enviado, indexado pelo jobId — útil para
  // auditoria e para reproduzir a submissão futuramente.
  savePayload(requestedJobId, payload);

  const { parentJob, childJob } = await waitForJobCompletion(requestedJobId, correlationId);
  const effectiveJobId = childJob?.jobId ? Number(childJob.jobId) : requestedJobId;

  const artifact = await downloadArtifact(effectiveJobId, correlationId);

  // O artefato é lido e processado inteiramente em memória — NÃO é
  // gravado em disco neste servidor (ver storage.service.ts). Isso é
  // intencional: quando hospedado no BEX (shell/iframe), não haverá
  // espaço em disco disponível/permitido para gravação de arquivos.

  // Tenta extrair Agência/Conta do artefato — só terá sucesso para a
  // rotina "Contas Correntes - PF" (Agendar Débito Automático), que gera
  // uma conta nova. Para outras rotinas, retorna found:false silenciosamente.
  const extractedContaInfo = extractAccountInfoFromZip(artifact.buffer);
  if (extractedContaInfo.found) {
    logger.info('Conta extraída do artefato', correlationId, extractedContaInfo);
  }

  return {
    requestedJobId,
    childJobId: childJob?.jobId ? Number(childJob.jobId) : null,
    effectiveJobId,
    parentStatus: parentJob.status,
    childStatus: childJob?.status,
    artifact,
    extractedContaInfo,
  };
}

async function getJobStatus(jobId: number, correlationId?: string) {
  const job = await fetchJobDetails(jobId, correlationId);
  const childJob = pickDownloadableChildJob(job);

  return {
    jobId,
    completed: isCompleted(job.status),
    childJobId: childJob?.jobId ? Number(childJob.jobId) : null,
    childCompleted: childJob ? isCompleted(childJob.status) : false,
    data: job,
  };
}

export const tdmService = {
  submitAndDownload,
  getJobStatus,
};
