import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GATEWAY_ENDPOINTS } from './endpoints';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { CatalogResponseDto } from './dto/catalog-response.dto';
import { CardResponseDto } from './dto/card-response.dto';
import {
  ExecuteCardRequestDto,
  ExecuteCardResponseDto,
  ExecutionStatusResponseDto,
} from './dto/execute-card.dto';
import { SubmitRequestDto } from './dto/submit-request.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { JobStatusDto } from './dto/job-status.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { HealthStatusResponseDto } from '../health/health.dto';

/**
 * Headers obrigatórios exigidos pelo Gateway do Portal TDM na submissão de
 * requests (POST /gw/api/requests/submit-and-download).
 */
const SUBMIT_REQUEST_HEADERS = new HttpHeaders({
  'Content-Type': 'application/json',
  'X-Requested-With': 'portal-tdm2',
});

/**
 * Camada exclusiva de comunicação HTTP com o Gateway do Portal TDM (/gw).
 *
 * IMPORTANTE — fronteira arquitetural:
 * O Angular NUNCA se comunica diretamente com o Broadcom TDM. Toda a
 * comunicação passa pelo Gateway corporativo, que é o único responsável
 * por conhecer credenciais, tokens e URLs internas do TDM.
 *
 * Responsabilidade única desta classe: montar e disparar requisições HTTP
 * para o Gateway, retornando sempre DTOs (formato bruto da resposta).
 * NÃO deve conter regra de negócio, mapeamento para Models de domínio,
 * nem tratamento de estado de UI — isso é responsabilidade dos Business
 * Services e das Facades.
 *
 * Qualquer novo endpoint deve ser adicionado primeiro em `endpoints.ts`
 * e então exposto aqui como um método dedicado.
 */
@Injectable({ providedIn: 'root' })
export class GatewayApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  // ---------------------------------------------------------------------
  // Contratos CONFIRMADOS com o Gateway
  // ---------------------------------------------------------------------

  /**
   * GET /gw/health — health check do Gateway.
   * Marcado com SKIP_LOADING pois é consumido em polling (ver HealthService)
   * e não deve acionar o overlay de loading global.
   */
  health(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.baseUrl}${GATEWAY_ENDPOINTS.health()}`, {
      context: new HttpContext().set(SKIP_LOADING, true),
    });
  }

  /**
   * GET /gw/health/status — health check enterprise (Gateway + TDM +
   * Autenticação), consumido pelo módulo `core/health`. Marcado com
   * SKIP_LOADING pelo mesmo motivo do `health()` acima: é consumido em
   * polling e não deve acionar o overlay de loading global.
   */
  healthStatus(): Observable<HealthStatusResponseDto> {
    return this.http.get<HealthStatusResponseDto>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.healthStatus()}`,
      { context: new HttpContext().set(SKIP_LOADING, true) },
    );
  }

  /** POST /gw/auth/login — autenticação corporativa do Portal. */
  login(request: LoginRequestDto): Observable<LoginResponseDto> {
    return this.http.post<LoginResponseDto>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.auth.login()}`,
      request,
    );
  }

  /** POST /gw/auth/logout */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}${GATEWAY_ENDPOINTS.auth.logout()}`, null);
  }

  /**
   * POST /gw/api/requests/submit-and-download
   * Requer headers `Content-Type: application/json` e
   * `X-Requested-With: portal-tdm2`, exigidos pelo Gateway do Portal TDM.
   */
  submitAndDownload(request: SubmitRequestDto): Observable<SubmitResponseDto> {
    return this.http.post<SubmitResponseDto>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.requests.submitAndDownload()}`,
      request,
      { headers: SUBMIT_REQUEST_HEADERS },
    );
  }

  /** GET /gw/api/jobs/:jobId/status */
  getJobStatus(jobId: string): Observable<JobStatusDto> {
    return this.http.get<JobStatusDto>(`${this.baseUrl}${GATEWAY_ENDPOINTS.jobs.status(jobId)}`);
  }

  /** POST /gw/api/debug/requests-raw */
  submitRawDebugRequest(payload: unknown): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.debug.requestsRaw()}`,
      payload,
    );
  }

  // ---------------------------------------------------------------------
  // Contratos PENDENTES DE VALIDAÇÃO (ver endpoints.ts)
  // Mantidos apenas para não quebrar a Home enquanto o mock estiver ativo
  // (environment.useMockData = true). NÃO usar em produção sem confirmar
  // o contrato real junto ao time do Gateway/TDM.
  // ---------------------------------------------------------------------

  getCatalogs(): Observable<CatalogResponseDto[]> {
    return this.http.get<CatalogResponseDto[]>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.pending.catalogs.list()}`,
    );
  }

  getCards(): Observable<CardResponseDto[]> {
    return this.http.get<CardResponseDto[]>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.pending.cards.list()}`,
    );
  }

  executeCard(request: ExecuteCardRequestDto): Observable<ExecuteCardResponseDto> {
    return this.http.post<ExecuteCardResponseDto>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.pending.cards.execute(request.cardId)}`,
      request,
    );
  }

  getExecutionStatus(executionId: string): Observable<ExecutionStatusResponseDto> {
    return this.http.get<ExecutionStatusResponseDto>(
      `${this.baseUrl}${GATEWAY_ENDPOINTS.pending.cards.executionStatus(executionId)}`,
    );
  }
}
