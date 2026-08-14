/**
 * DTOs representam o contrato EXATO retornado pela API do Broadcom TDM
 * (através do gateway /gw). Não devem ser usados diretamente pelos
 * componentes — sempre passam por um mapper antes de virar um Model
 * de domínio (ver core/models).
 *
 * Isso isola a aplicação de mudanças no payload da API: se o TDM alterar
 * um nome de campo, apenas o DTO e o mapper precisam ser ajustados.
 */
export interface CatalogResponseDto {
  id: string;
  name: string;
}
