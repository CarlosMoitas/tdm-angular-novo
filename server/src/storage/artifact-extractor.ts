import AdmZip from 'adm-zip';

/**
 * Extrai Agência e Número de Conta a partir do artefato ZIP retornado pelo
 * TDM na execução da rotina "Contas Correntes - PF" (card Agendar Débito
 * Automático).
 *
 * O ZIP contém arquivos de log do workflow executado no TDM. Um deles
 * (Action_38_1_Workflow.log) registra a resposta da chamada que efetivamente
 * cria a conta corrente, contendo uma linha com "Agencia" e "Nova Conta".
 *
 * Essa informação alimenta o próximo passo do workflow (card "Habilitar
 * Conta MA"), que exige P_AGENCIA_MA e P_CONTA_MA.
 */
export interface ExtractedAccountInfo {
  found: boolean;
  agencia?: string;
  conta?: string;
  reason?: string;
}

const TARGET_LOG_SUFFIX = 'Action_38_1_Workflow.log';

export function extractAccountInfoFromZip(buffer: Buffer): ExtractedAccountInfo {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (error) {
    return { found: false, reason: `ZIP inválido: ${(error as Error).message}` };
  }

  const entries = zip.getEntries();
  const targetEntry = entries.find((entry) => entry.entryName.endsWith(TARGET_LOG_SUFFIX));

  if (!targetEntry) {
    return {
      found: false,
      reason: `Arquivo ${TARGET_LOG_SUFFIX} não encontrado dentro do ZIP.`,
    };
  }

  const raw = targetEntry.getData().toString('utf8');
  const lines = raw.split(/\r?\n/);

  const responseLine = lines
    .reverse()
    .find(
      (line) =>
        line.includes('response.Content:') && line.includes('Agencia') && line.includes('Nova Conta'),
    );

  if (!responseLine) {
    return {
      found: false,
      reason: 'Nenhuma linha com Agencia e Nova Conta foi encontrada no log.',
    };
  }

  const agenciaMatch = /"Agencia":"(\d+)"/.exec(responseLine);
  const contaMatch = /"Nova Conta":"(\d+)"/.exec(responseLine);

  return {
    found: Boolean(agenciaMatch && contaMatch),
    agencia: agenciaMatch?.[1],
    conta: contaMatch?.[1],
  };
}
