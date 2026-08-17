/**
 * Valores compartilhados entre os builders do workflow "Abertura de Contas"
 * (Contas Correntes - PF → Habilitar Conta MA → Débito Automático).
 *
 * Centralizados aqui para evitar duplicação/drift entre os 3 payloads —
 * qualquer ajuste (ex.: e-mail do solicitante, projeto Jira) deve ser feito
 * em um único lugar.
 */
export const WORKFLOW_PROJETO_JIRA = 'ENGPBIA-ENGENHARIA DE PLATAFORMA | BIA TECH';
export const WORKFLOW_EMAIL = 'carlosandre.moitas@bradesco.com.br';
/**
 * Fallback usado apenas quando não há usuário autenticado disponível
 * (ex.: chamadas diretas fora do fluxo normal da Home). Em uso normal, o
 * `username` de cada payload deve vir do usuário logado (SSO/sessão do
 * Portal), nunca deste valor fixo — ver `HomeFacade`.
 */
export const WORKFLOW_USERNAME_FALLBACK = 'm627529';
