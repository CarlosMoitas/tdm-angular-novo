import { SubmitRequestDto } from '../../../core/api/dto/submit-request.dto';
import {
  DEFAULT_WORKFLOW_ENVIRONMENT,
  WorkflowEnvironment,
  getContasCorrentesEnvConfig,
} from './workflow-environment';
import { WORKFLOW_EMAIL, WORKFLOW_PROJETO_JIRA, WORKFLOW_USERNAME_FALLBACK } from './shared-request-defaults';

/**
 * Formulário preenchido pelo usuário na Home para o card
 * "Agendar Débito Automático" (cta-003) — primeira etapa do workflow
 * "Abertura de Contas" (rotina "Contas Correntes - PF").
 */
export interface AgendarDebitoAutomaticoFormData {
  /**
   * Ambiente escolhido pelo usuário (TI ou TU). Determina a configuração
   * técnica (configurationId) usada neste card e nos 2 seguintes
   * (Habilitar Conta MA e Débito Automático). Enquanto a UI não expõe o
   * seletor visual, usa `DEFAULT_WORKFLOW_ENVIRONMENT` ('TU').
   */
  environment?: WorkflowEnvironment;
  /**
   * Agência informada pelo usuário na tela (input do card). Usada tanto
   * no payload desta submissão quanto, posteriormente, no encadeamento
   * automático dos cards "Habilitar Conta MA" e "Débito Automático".
   */
  agency?: string;
  /**
   * Username do usuário autenticado no Portal (sessão/SSO). Enviado ao
   * TDM como `username` do job — reflete quem de fato está executando a
   * ação, e não um valor fixo.
   */
  username?: string;
}

const DEFAULT_AGENCY = '3995';

const DATA_DESIGN_PROJECT_ID = 2476;
const DATA_DESIGN_VERSION_ID = 2477;

const PUBLISH_JOB_LEVEL_ID = 3309;
const VTFNODE_ID = '11020';
const VTFNODE_NAME = '02 - Conta Corrente PF';

/**
 * Constrói o payload de submissão do card "Agendar Débito Automático"
 * (cta-003) no formato exigido pelo Gateway (POST
 * /gw/api/requests/submit-and-download), para a rotina "Contas Correntes
 * - PF Data Request".
 *
 * A configuração técnica (configurationId) varia por ambiente (TI/TU) —
 * ver `workflow-environment.ts`. O levelID e o dataDesign são os mesmos
 * em ambos os ambientes.
 *
 * IMPORTANTE:
 * para esta rotina o request só roda de forma estável quando o payload
 * mantém a conexão completa com `DB204P` tanto na origem quanto no alvo.
 * Ou seja, os campos abaixo NÃO devem ser esvaziados nesta etapa:
 * - `dataSourceProfile`
 * - `dataTargetProfile`
 * - `globalSourceConnection`
 * - `globalTargetConnection`
 *
 * Isso foi validado a partir de payload funcional já executado com
 * sucesso no fluxo antigo do portal.
 */
export function buildAgendarDebitoAutomaticoPayload(
  formData: AgendarDebitoAutomaticoFormData,
): SubmitRequestDto {
  const now = new Date();
  const environment = formData.environment ?? DEFAULT_WORKFLOW_ENVIRONMENT;
  const envConfig = getContasCorrentesEnvConfig(environment);

  return {
    jobPubParams: {
      scheduledDateTimeInMillisec: now.toISOString(),
      almjobs: [],
      rallyJobs: [],
      jobParams: [],
      publishJobs: [
        {
          batchEngineThread: 'ANY',
          dataSourceProfile: 'DB204P',
          dataTargetProfile: 'DB204P',
          description: '',
          jobTitle: 'Group Job',
          levelID: PUBLISH_JOB_LEVEL_ID,
          publishVariables: [
            {
              name: 'p_ambiente_gerar_conta',
              preResolveError: '',
              preResolveValue: '',
              value: envConfig.ambienteLabel,
            },
            {
              name: 'p_SegmentoContaCorretePF',
              preResolveError: '',
              preResolveValue: '',
              value: envConfig.segmentoContaCorretePF,
            },
            {
              name: 'p_agencia',
              preResolveError: '',
              preResolveValue: '',
              value: formData.agency || DEFAULT_AGENCY,
            },
            {
              name: 'p_cpf',
              preResolveError: '',
              preResolveValue: '',
              value: '0',
            },
            {
              name: 'p_qtdcontas_ger',
              preResolveError: '',
              preResolveValue: '',
              value: '1',
            },
            {
              name: 'p_projeto_jira',
              preResolveError: '',
              preResolveValue: '',
              value: WORKFLOW_PROJETO_JIRA,
            },
            {
              name: 'p_tp_disp',
              preResolveError: '',
              preResolveValue: '',
              value: 'SEM DISPOSITIVO',
            },
          ],
          seq: 1,
          vtfnodeDesc: VTFNODE_NAME,
          vtfnodeID: VTFNODE_ID,
          vtfnodeName: VTFNODE_NAME,
          iterations: 1,
          csvDelimiter: null,
          csvQuotationMarks: null,
          configurationId: envConfig.configurationId,
        },
      ],
      testMatches: [],
      exportJobs: [],
      scheduledDt: now.toISOString(),
      selfServiceEmailMandate: false,
      email: WORKFLOW_EMAIL,
      globalThreadName: 'ANY',
      scheduledDateTimeInMillis: now.getTime(),
      currentDay: now.getDate(),
      currentMonth: now.getMonth() + 1,
      currentYear: now.getFullYear(),
      globalSourceConnection: 'DB204P',
      globalTargetConnection: 'DB204P',
      jobSubmissionOrder: '0',
      jobTitle: 'Contas Correntes - PF Data Request',
      username: formData.username || WORKFLOW_USERNAME_FALLBACK,
    },
    dataDesign: {
      projectID: DATA_DESIGN_PROJECT_ID,
      versionID: DATA_DESIGN_VERSION_ID,
    },
    advancedToggleFlag: true,
  };
}
