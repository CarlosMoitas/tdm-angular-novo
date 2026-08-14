import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { GatewayApiService } from '../api/gateway-api.service';
import { mapSubmitResponseDtoToExecution } from '../api/mappers/execution.mapper';
import { SubmitRequestDto } from '../api/dto/submit-request.dto';
import { Execution } from '../models/execution.model';
import { LoggerService } from '../logging/logger.service';

/**
 * Business Service responsável por EXECUTAR requests TDM via Gateway.
 *
 * Fluxo:
 *   ExecutionService → GatewayApiService → POST /gw/api/requests/submit-and-download
 *
 * Esta é a única porta de entrada para submissão de requests TDM. A
 * HomeFacade (e futuramente as facades de `executions/`, `jobs/`,
 * `history/`) consomem exclusivamente este service — nunca o
 * GatewayApiService diretamente, e nunca HttpClient.
 *
 * O Correlation ID de cada requisição já é anexado automaticamente pelo
 * `correlationIdInterceptor` (header X-Correlation-Id) e propagado pelo
 * `ErrorInterceptor` em caso de falha (ver ApiError.correlationId) — este
 * service não precisa gerenciá-lo manualmente, apenas registrar os logs
 * de negócio da submissão.
 *
 * Preparado para suportar cadeias de execução (Request 1 → Request 2 →
 * Request 3): cada chamada a `execute()` é independente e retorna um
 * `Execution`, que pode futuramente alimentar o payload da próxima etapa
 * de um `WorkflowExecution` (ver core/models/workflow.model.ts).
 */
@Injectable({ providedIn: 'root' })
export class ExecutionService {
  constructor(
    private readonly gatewayApi: GatewayApiService,
    private readonly logger: LoggerService,
  ) {}

  execute(payload: SubmitRequestDto): Observable<Execution> {
    this.logger.debug('Submetendo request ao Gateway TDM', undefined, payload);

    return this.gatewayApi.submitAndDownload(payload).pipe(
      tap({
        next: (response) => this.logger.info('Job retornado pelo Gateway', undefined, response),
      }),
      map(mapSubmitResponseDtoToExecution),
    );
  }
}
