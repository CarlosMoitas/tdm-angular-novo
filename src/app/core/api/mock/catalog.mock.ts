import { CatalogResponseDto } from '../dto/catalog-response.dto';
import { CardResponseDto } from '../dto/card-response.dto';

/**
 * Dados mockados no MESMO formato de DTO retornado pela API real do TDM.
 * Usados apenas enquanto `environment.useMockData` estiver true — permite
 * desenvolver a Home sem depender do gateway/TDM já estar disponível.
 */
export const MOCK_CATALOGS: CatalogResponseDto[] = [
  { id: 'abertura-contas', name: 'Abertura de Contas' },
  { id: 'emprestimos', name: 'Empréstimos' },
  { id: 'cartoes', name: 'Cartões' },
  { id: 'cadastro', name: 'Cadastro' },
];

export const MOCK_CARDS: CardResponseDto[] = [
  {
    id: 'cta-001',
    title: 'Débito Automático',
    project: 'Contas',
    catalogId: 'abertura-contas',
  },
  {
    id: 'cta-002',
    title: 'Extrato de Contas Correntes',
    project: 'Contas',
    catalogId: 'abertura-contas',
  },
  {
    id: 'cta-003',
    title: 'Agendar Débito Automático',
    project: 'Abertura de Contas',
    catalogId: 'abertura-contas',
    requiresAgencyInput: true,
  },
  {
    id: 'cta-004',
    title: 'Agendar Débito Automático',
    project: 'Abertura de Contas',
    catalogId: 'abertura-contas',
    environments: [
      { label: 'PDB204P - TU', value: 'PDB204P - TU' },
      { label: 'PCM2AB - NOVO TI', value: 'PCM2AB - NOVO TI' },
    ],
  },
];
