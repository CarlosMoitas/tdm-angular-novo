import { Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GatewayApiService } from '../api/gateway-api.service';
import { MOCK_CARDS, MOCK_CATALOGS } from '../api/mock/catalog.mock';
import { mapCardDtoToModel, mapCatalogDtoToModel } from '../api/mappers/catalog.mapper';
import { Catalog, CatalogCard } from '../models/catalog.model';
import { ExecuteCardRequestDto, ExecuteCardResponseDto } from '../api/dto/execute-card.dto';

/**
 * Business Service: contém a regra de negócio de "Catálogos e Cards do TDM".
 * Consome exclusivamente o GatewayApiService (nunca HttpClient diretamente)
 * e converte DTOs em Models de domínio através dos mappers.
 *
 * ATENÇÃO — contratos pendentes de validação:
 * Os métodos `getCatalogs`, `getCards` e `executeCard` do GatewayApiService
 * usam endpoints marcados como "pending" em `core/api/endpoints.ts`
 * (NÃO confirmados junto ao time do Gateway/TDM). Enquanto
 * `environment.useMockData` estiver true, este service retorna dados
 * mockados (mesmo formato de DTO) para permitir que a Home funcione
 * normalmente. Ao confirmar os contratos reais, ajustar `endpoints.ts` e
 * desativar a flag — nenhum outro código precisa mudar.
 *
 * Não deve conter lógica de apresentação (isso é responsabilidade da
 * Facade e dos componentes).
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private readonly gatewayApi: GatewayApiService) {}

  getCatalogs(): Observable<Catalog[]> {
    const source = environment.useMockData ? of(MOCK_CATALOGS) : this.gatewayApi.getCatalogs();
    return source.pipe(map((dtos) => dtos.map(mapCatalogDtoToModel)));
  }

  getCards(): Observable<CatalogCard[]> {
    const source = environment.useMockData ? of(MOCK_CARDS) : this.gatewayApi.getCards();
    return source.pipe(map((dtos) => dtos.map(mapCardDtoToModel)));
  }

  executeCard(request: ExecuteCardRequestDto): Observable<ExecuteCardResponseDto> {
    return this.gatewayApi.executeCard(request);
  }
}
