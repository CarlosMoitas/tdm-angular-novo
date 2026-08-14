/**
 * Catálogo de "Node Configuration" do TDM, usado para resolver o
 * `vtfnodeID`/`vtfnodeDesc` a partir do código inicial selecionado no
 * formulário (ex.: "02 - Conta Corrente PF" → vtfnodeID "11020").
 *
 * Regra: o código numérico inicial (antes do " - ") é usado para localizar
 * a entrada correspondente na tabela de nodes do TDM. Novas opções devem
 * ser adicionadas aqui conforme confirmadas com o time do Gateway/TDM.
 */
export interface NodeConfiguration {
  vtfnodeDesc: string;
  vtfnodeName: string;
  vtfnodeID: string;
}

const NODE_CONFIGURATIONS: Record<string, NodeConfiguration> = {
  '02': {
    vtfnodeDesc: '02 - Conta Corrente PF',
    vtfnodeName: 'Conta Corrente PF',
    vtfnodeID: '11020',
  },
};

export const DEFAULT_NODE_CODE = '02';

/**
 * Resolve a configuração de node a partir do código inicial (ex.: "02").
 * Caso o código não seja reconhecido, retorna o node default
 * ("02 - Conta Corrente PF"), evitando quebrar a submissão por falta de
 * configuração.
 */
export function resolveNodeConfiguration(nodeCode: string = DEFAULT_NODE_CODE): NodeConfiguration {
  const code = extractNodeCode(nodeCode);
  return NODE_CONFIGURATIONS[code] ?? NODE_CONFIGURATIONS[DEFAULT_NODE_CODE];
}

/** Extrai o código inicial de uma string como "02 - Conta Corrente PF" → "02". */
function extractNodeCode(value: string): string {
  return value.split('-')[0]?.trim() ?? value.trim();
}
