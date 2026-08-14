import { Router } from 'express';
import { tdmService } from './tdm.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { SubmitRequestPayload } from './tdm.types';

export const tdmRouter = Router();

/**
 * Todas as rotas de integração com o TDM exigem sessão válida do Portal
 * (JWT emitido por este servidor) — ver `authMiddleware`.
 */
tdmRouter.use(authMiddleware);

tdmRouter.post('/requests/submit-and-download', async (req, res, next) => {
  try {
    const payload = req.body as SubmitRequestPayload;
    const result = await tdmService.submitAndDownload(payload, req.correlationId);

    // Responde em JSON (contrato esperado pelo Angular — SubmitResponseDto).
    // O artefato ZIP é processado inteiramente em memória por este
    // servidor (baixado do TDM, lido e descartado) — NÃO é gravado em
    // disco nem enviado no corpo desta resposta. Apenas o resultado da
    // extração (extractedContaInfo) e o tamanho em bytes são retornados.
    res.json({
      success: true,
      requestedJobId: result.requestedJobId,
      childJobId: result.childJobId,
      effectiveJobId: result.effectiveJobId,
      parentStatus: result.parentStatus,
      childStatus: result.childStatus,
      sizeBytes: result.artifact.sizeBytes,
      extractedContaInfo: result.extractedContaInfo,
    });
  } catch (error) {
    next(error);
  }
});

tdmRouter.get('/jobs/:jobId/status', async (req, res, next) => {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isFinite(jobId)) {
      throw new AppError(400, 'jobId inválido.');
    }

    const result = await tdmService.getJobStatus(jobId, req.correlationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
