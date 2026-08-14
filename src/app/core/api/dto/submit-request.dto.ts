/**
 * Contrato CONFIRMADO: payload de POST /gw/api/requests/submit-and-download
 *
 * Estrutura exigida pelo Gateway para submissão de uma requisição TDM.
 * Os arrays vazios obrigatórios (almjobs, rallyJobs, jobParams, testMatches,
 * exportJobs) fazem parte do contrato aceito pelo Gateway e devem sempre
 * existir no payload, mesmo vazios.
 */
export interface PublishVariableDto {
  name: string;
  preResolveError: string;
  preResolveValue: string;
  value: string;
}

export interface PublishJobDto {
  batchEngineThread: string;
  dataSourceProfile: string;
  dataTargetProfile: string;
  description: string;
  jobTitle: string;
  levelID: number;
  publishVariables: PublishVariableDto[];
  seq: number;
  vtfnodeDesc: string;
  vtfnodeID: string;
  vtfnodeName: string;
  iterations: number;
  csvDelimiter: string | null;
  csvQuotationMarks: string | null;
  configurationId: number;
}

export interface JobPubParamsDto {
  scheduledDateTimeInMillisec: string;
  almjobs: unknown[];
  rallyJobs: unknown[];
  jobParams: unknown[];
  publishJobs: PublishJobDto[];
  testMatches: unknown[];
  exportJobs: unknown[];
  scheduledDt: string;
  selfServiceEmailMandate: boolean;
  email: string;
  globalThreadName: string;
  scheduledDateTimeInMillis: number;
  currentDay: number;
  currentMonth: number;
  currentYear: number;
  globalSourceConnection: string;
  globalTargetConnection: string;
  jobSubmissionOrder: string;
  jobTitle: string;
  username: string;
}

export interface DataDesignDto {
  projectID: number;
  versionID: number;
}

export interface SubmitRequestDto {
  jobPubParams: JobPubParamsDto;
  dataDesign: DataDesignDto;
  advancedToggleFlag: boolean;
}
