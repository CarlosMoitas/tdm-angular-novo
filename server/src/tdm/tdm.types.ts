/**
 * Contratos de integração com o Broadcom TDM.
 * Espelham (sem copiar código) os conceitos usados no gateway legado:
 * login com cache de token, submissão de request, status de job e
 * download de artefato.
 */
export interface PublishJobPayload {
  levelID: number;
  vtfnodeID: string;
  publishVariables: unknown[];
  dataSourceProfile: string;
  dataTargetProfile: string;
}

export interface SubmitRequestPayload {
  jobPubParams: {
    publishJobs: PublishJobPayload[];
    globalSourceConnection: string;
    globalTargetConnection: string;
    jobTitle: string;
  };
  dataDesign: {
    projectID: number;
    versionID: number;
  };
  publishVariables: unknown[];
  advancedToggleFlag: boolean;
  almjobs: unknown[];
  rallyJobs: unknown[];
  jobParams: unknown[];
  testMatches: unknown[];
  exportJobs: unknown[];
}

export interface SubmitResponse {
  jobId?: number;
  id?: number;
  data?: { jobId?: number; id?: number };
  [key: string]: unknown;
}

export interface TdmJob {
  jobId?: number;
  status?: string;
  statusMessage?: string;
  runningStatus?: string;
  type?: string;
  artifactLocation?: string;
  jobs?: TdmJob[];
  [key: string]: unknown;
}
