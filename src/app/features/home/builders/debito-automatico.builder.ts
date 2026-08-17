import { SubmitRequestDto } from '../../../core/api/dto/submit-request.dto';
import {
  DEFAULT_WORKFLOW_ENVIRONMENT,
  WorkflowEnvironment,
  getDebitoAutomaticoEnvConfig,
} from './workflow-environment';
import {
  WORKFLOW_EMAIL,
  WORKFLOW_PROJETO_JIRA,
  WORKFLOW_USERNAME_FALLBACK,
} from './shared-request-defaults';

/**
 * Dados necessários para montar o payload do card "Débito Automático"
 * (levelID 3101), terceira e última etapa do workflow de Abertura de Contas.
 *
 * Agência, projetoJira e ambiente devem vir do resultado da PRIMEIRA etapa
 * (card "Agendar Débito Automático" → rotina "Contas Correntes - PF"):
 * - `agencia`: a mesma informada pelo usuário na tela do primeiro card.
 * - `conta`: extraída do artefato .zip retornado pelo TDM na primeira etapa.
 * - `environment`/`projetoJira`: mesmos escolhidos/gerados no primeiro card.
 *
 * A configuração técnica desta rotina é a MESMA em ambos os ambientes
 * (TI/TU) — ver `workflow-environment.ts` — mas o parâmetro é mantido
 * para consistência arquitetural com os demais builders do workflow.
 */
export interface DebitoAutomaticoFormData {
  agencia: string;
  conta: string;
  environment?: WorkflowEnvironment;
  projetoJira?: string;
  username?: string;
}

const DATA_DESIGN_PROJECT_ID = 2346;
const DATA_DESIGN_VERSION_ID = 2351;

const PUBLISH_JOB_LEVEL_ID = 3101;
const VTFNODE_ID = '53470';
const VTFNODE_NAME = 'Débito Automático Corrente Mobile e TF';

const DEFAULT_PROJETO_JIRA = WORKFLOW_PROJETO_JIRA;

/**
 * Constrói o payload de submissão do card "Débito Automático" no formato
 * exigido pelo Gateway (POST /gw/api/requests/submit-and-download).
 */
export function buildDebitoAutomaticoPayload(formData: DebitoAutomaticoFormData): SubmitRequestDto {
  const now = new Date();
  const environment = formData.environment ?? DEFAULT_WORKFLOW_ENVIRONMENT;
  const envConfig = getDebitoAutomaticoEnvConfig(environment);

  return {
    jobPubParams: {
      scheduledDateTimeInMillisec: now.toISOString(),
      almjobs: [],
      rallyJobs: [],
      jobParams: [],
      publishJobs: [
        {
          batchEngineThread: 'ANY',
          dataSourceProfile: '',
          dataTargetProfile: '',
          description: '',
          jobTitle: 'Group Job',
          levelID: PUBLISH_JOB_LEVEL_ID,
          publishVariables: [
            {
              name: 'p_combo_ctpo_crtl_db_uf',
              preResolveError: '',
              preResolveValue: '',
              value: '01-SP                                      ',
            },
            {
              name: 'p_combo_ctpo_crtl_db',
              preResolveError: '',
              preResolveValue: '',
              value: '001-Energia Elétrica                   ',
            },
            {
              name: 'p_combo_empresa',
              preResolveError: '',
              preResolveValue: '',
              value: '2269651-0000000906-CETRIL/SP                                - 01237               ',
            },
            {
              name: 'p_agencia',
              preResolveError: '',
              preResolveValue: '',
              value: formData.agencia,
            },
            {
              name: 'p_conta',
              preResolveError: '',
              preResolveValue: '',
              value: formData.conta,
            },
            {
              name: 'p_combo_contratante',
              preResolveError: '',
              preResolveValue: '',
              value: '999-NOVO CONTRATO',
            },
            {
              name: 'p_qntd',
              preResolveError: '',
              preResolveValue: '',
              value: '1',
            },
            {
              name: 'p_projeto_jira',
              preResolveError: '',
              preResolveValue: '',
              value: formData.projetoJira || DEFAULT_PROJETO_JIRA,
            },
          ],
          seq: 1,
          vtfnodeDesc: VTFNODE_NAME,
          vtfnodeID: VTFNODE_ID,
          vtfnodeName: VTFNODE_NAME,
          iterations: 1,
          csvDelimiter: null,
          csvQuotationMarks: null,
          configurationId: 2369,
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
      globalSourceConnection: '',
      globalTargetConnection: '',
      jobSubmissionOrder: '0',
      jobTitle: 'Débito Automático Data Request',
      username: formData.username || WORKFLOW_USERNAME_FALLBACK,
    },
    dataDesign: {
      projectID: DATA_DESIGN_PROJECT_ID,
      versionID: DATA_DESIGN_VERSION_ID,
    },
    advancedToggleFlag: true,
  };
}
