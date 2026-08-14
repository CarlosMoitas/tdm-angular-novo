export interface CatalogEnvironmentOption {
  label: string;
  value: string;
}

export interface CatalogCard {
  id: string;
  title: string;
  project: string;
  catalogId: string;
  environments?: CatalogEnvironmentOption[];
  /**
   * Quando true, a Home exibe um campo de texto "Agência" no card,
   * permitindo que o usuário informe a agência a ser usada no payload
   * de submissão (em vez de um valor fixo no builder).
   */
  requiresAgencyInput?: boolean;
}

export interface Catalog {
  id: string;
  label: string;
}
