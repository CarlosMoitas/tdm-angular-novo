import { SubmitRequestDto } from '../../../core/api/dto/submit-request.dto';
import {
  DEFAULT_WORKFLOW_ENVIRONMENT,
  WorkflowEnvironment,
  getHabilitarContaMaEnvConfig,
} from './workflow-environment';
import {
  WORKFLOW_EMAIL,
  WORKFLOW_PROJETO_JIRA,
  WORKFLOW_USERNAME_FALLBACK,
} from './shared-request-defaults';

/**
 * Dados necessários para montar o payload do card "Habilitar Conta MA",
 * segunda etapa do workflow de Abertura de Contas.
 *
 * A agência/projetoJira usadas aqui devem ser as MESMAS informadas/geradas
 * no primeiro card ("Contas Correntes - PF"), e a conta deve ser a
 * extraída do artefato .zip retornado por ele — nunca digitada pelo
 * usuário. O ambiente (TI/TU) também é o mesmo escolhido no primeiro card,
 * pois determina a configuração técnica (levelID/configurationId/vtfnode)
 * correta desta rotina no TDM.
 */
export interface HabilitarContaMaFormData {
  agencia: string;
  conta: string;
  environment?: WorkflowEnvironment;
  projetoJira?: string;
  username?: string;
}

const DATA_DESIGN_PROJECT_ID = 3862;
const DATA_DESIGN_VERSION_ID = 3863;

const DEFAULT_PROJETO_JIRA = WORKFLOW_PROJETO_JIRA;

/**
 * Constrói o payload de submissão do card "Habilitar Conta MA" no formato
 * exigido pelo Gateway (POST /gw/api/requests/submit-and-download).
 *
 * A configuração técnica (levelID, configurationId, vtfnodeID/Name) varia
 * por ambiente (TI/TU) — ver `workflow-environment.ts`.
 */
export function buildHabilitarContaMaPayload(formData: HabilitarContaMaFormData): SubmitRequestDto {
  const now = new Date();
  const environment = formData.environment ?? DEFAULT_WORKFLOW_ENVIRONMENT;
  const envConfig = getHabilitarContaMaEnvConfig(environment);

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
          levelID: envConfig.levelID,
          publishVariables: [
            {
              name: 'P_AGENCIA_MA',
              preResolveError: '',
              preResolveValue: '',
              value: formData.agencia,
            },
            {
              name: 'P_CONTA_MA',
              preResolveError: '',
              preResolveValue: '',
              value: formData.conta,
            },
            {
              name: 'p_projeto_jira',
              preResolveError: '',
              preResolveValue: '',
              value: formData.projetoJira || DEFAULT_PROJETO_JIRA,
            },
          ],
          seq: 1,
          vtfnodeDesc: envConfig.vtfnodeName,
          vtfnodeID: envConfig.vtfnodeID,
          vtfnodeName: envConfig.vtfnodeName,
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
      globalTargetConnection: '',
      jobSubmissionOrder: '0',
      jobTitle: 'Habilitar Conta MA Data Request',
      username: formData.username || WORKFLOW_USERNAME_FALLBACK,
    },
    dataDesign: {
      projectID: DATA_DESIGN_PROJECT_ID,
      versionID: DATA_DESIGN_VERSION_ID,
    },
    advancedToggleFlag: true,
  };
}
