import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { GatewayApiService } from '../api/gateway-api.service';
import { mapJobStatusDtoToModel } from '../api/mappers/job.mapper';
import { JobStatusModel } from '../models/job.model';

/**
 * Business Service para acompanhamento de status de jobs assíncronos no
 * Gateway.
 *
 * Endpoint CONFIRMADO:
 * - GET  /gw/api/jobs/:jobId/status
 *
 * IMPORTANTE: não existe (e não deve ser reintroduzido) um método de
 * download do artefato .zip do job. O artefato é baixado, lido e
 * descartado inteiramente em memória pelo servidor (ver
 * server/src/tdm/tdm.service.ts e storage.service.ts) — nunca é enviado
 * ao Angular nem gravado em disco, pois quando este projeto for hospedado
 * no BEX (via shell/iframe) não haverá espaço em disco disponível/
 * permitido para gravação de arquivos.
 *
 * A submissão de requests (POST /gw/api/requests/submit-and-download) é
 * responsabilidade do `ExecutionService` (core/services/execution.service.ts).
 *
 * Ainda sem UI consumindo este service — infraestrutura preparada para as
 * futuras features `jobs/` e `history/`.
 */
@Injectable({ providedIn: 'root' })
export class JobService {
  constructor(private readonly gatewayApi: GatewayApiService) {}

  getStatus(jobId: string): Observable<JobStatusModel> {
    return this.gatewayApi.getJobStatus(jobId).pipe(map(mapJobStatusDtoToModel));
  }
}
