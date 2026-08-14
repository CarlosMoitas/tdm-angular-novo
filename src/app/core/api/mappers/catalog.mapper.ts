import { CatalogResponseDto } from '../dto/catalog-response.dto';
import { CardResponseDto } from '../dto/card-response.dto';
import { Catalog, CatalogCard } from '../../models/catalog.model';

/**
 * Mappers isolam o domínio da aplicação do formato exato retornado pela API do TDM.
 * Caso o gateway/TDM altere um nome de campo, apenas este arquivo precisa ser ajustado.
 */
export function mapCatalogDtoToModel(dto: CatalogResponseDto): Catalog {
  return {
    id: dto.id,
    label: dto.name,
  };
}

export function mapCardDtoToModel(dto: CardResponseDto): CatalogCard {
  return {
    id: dto.id,
    title: dto.title,
    project: dto.project,
    catalogId: dto.catalogId,
    environments: dto.environments,
    requiresAgencyInput: dto.requiresAgencyInput,
  };
}
