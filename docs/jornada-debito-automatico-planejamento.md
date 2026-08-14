# Planejamento de Melhorias — Jornada "Débito Automático" (Workflow Encadeado)

**Documento:** Planejamento arquitetural
**Escopo:** Workflow "Abertura de Contas" (cards encadeados: Contas Correntes - PF → Habilitar Conta MA → Débito Automático)
**Status atual:** Funcional, validado contra o Broadcom TDM real, mas com acoplamentos e limitações que devem ser endereçados antes de escalar para novos workflows.

---

## 1. Contexto e Estado Atual

### 1.1. O que já funciona

O workflow encadeado de 3 etapas está implementado e validado ponta a ponta:

```
Card "Agendar Débito Automático" (cta-003)
  → 1) Contas Correntes - PF   (cria conta corrente, extrai agência/conta do .zip)
  → 2) Habilitar Conta MA      (usa agência/conta extraídas)
  → 3) Débito Automático        (usa a mesma agência/conta)
```

- Cada card possui um **builder isolado** (`agendar-debito-automatico.builder.ts`, `habilitar-conta-ma.builder.ts`, `debito-automatico.builder.ts`), responsável **apenas** por montar o payload exato daquele card.
- A **orquestração sequencial** (chamar 1 → esperar → chamar 2 com o resultado do 1 → chamar 3) está centralizada na `HomeFacade`.
- Existe suporte a **2 ambientes (TI/TU)** via `workflow-environment.ts`, com configuração técnica (levelID/configurationId/vtfnode) por ambiente.
- Existe um **painel de log em tempo real** (`workflowLog`) que mostra cada etapa, incluindo download do artefato `.zip` e extração da conta.
- A extração da conta do artefato é feita por uma rotina isolada no backend (`artifact-extractor.ts`), sem dependências externas (Python, ferramentas de shell) — 100% Node/TypeScript.

### 1.2. Limitações e acoplamentos identificados

| # | Problema | Impacto |
|---|---|---|
| 1 | A orquestração das 3 etapas está **hardcoded na `HomeFacade`** (métodos privados `executeAgendarDebitoAutomatico` → `executeHabilitarContaMa` → `executeDebitoAutomatico`, cada um chamando o próximo diretamente). | Não é reutilizável para outros workflows encadeados futuros; qualquer novo workflow de N etapas exigiria duplicar essa estrutura de "chamar e no `next` chamar o próximo". |
| 2 | O `WorkflowContext` (agência, conta, ambiente, projetoJira, username) é um **objeto interno único**, passado por parâmetro entre métodos privados da Facade. | Não há persistência do contexto — se o usuário navegar/recarregar a página no meio do workflow, todo o progresso e contexto são perdidos. |
| 3 | O card 1 (`cta-003`) está **fixo** ao workflow de 3 etapas — não há como o card ser reutilizado isoladamente (ex.: só gerar a conta, sem encadear o resto) nem como adicionar um 4º card sem alterar `HomeFacade`. |Baixa flexibilidade para produto evoluir a jornada (ex.: adicionar um passo de "Extrato" após o Débito Automático). |
| 4 | Cada builder tem seu **próprio `now = new Date()`** e monta `scheduledDateTimeInMillis`/`scheduledDt` de forma redundante. | Pequena duplicação, mas sintomática de falta de um "payload builder base" comum. |
| 5 | O CPF usado no card "Contas Correntes - PF" é **fixo (`"0"`)** — causa `TDMDuplicateKeyException` em reexecuções (já observado em produção de testes). | Bloqueia testes repetidos; não há UI para o usuário informar um CPF válido. |
| 6 | Não há **mecanismo de retry/retomada** caso uma etapa intermediária falhe por instabilidade transitória do TDM (hoje, se a etapa 2 falhar, o usuário precisa reiniciar do zero a etapa 1). | Baixa resiliência a instabilidades pontuais do TDM. |
| 7 | Não existe **modelo de dados formal para "workflow" como conceito de primeira classe** — hoje é uma sequência de chamadas de método, não uma entidade com estado persistível (`pending`, `running`, `completed`, `failed`, etapa atual, etc.). | Impede telas futuras de "histórico de execuções" ou "workflows em andamento". |
| 8 | O seletor de ambiente (TI/TU) já está implementado na arquitetura interna, mas **não exposto na UI** — hoje sempre usa TU por padrão. | Usuário não pode escolher TI mesmo que precise. |

---

## 2. Objetivo das Melhorias

Evoluir a arquitetura de "uma sequência de chamadas encadeadas manualmente" para um **motor de workflow genérico e reutilizável**, que:

1. Separe claramente **definição do workflow** (quais etapas, em que ordem, quais dados fluem entre elas) de **execução do workflow** (o motor que efetivamente dispara/aguarda/encadeia).
2. Permita adicionar/remover/reordenar etapas **sem alterar a Facade da Home**.
3. Persista o estado/contexto do workflow (mesmo que localmente, via `localStorage`/`sessionStorage`), permitindo retomar após um refresh acidental.
4. Exponha o seletor de ambiente (TI/TU) na UI.
5. Trate falhas de etapa com possibilidade de retry manual, sem perder o contexto já obtido (ex.: se a etapa 3 falhar, não precisar reexecutar a etapa 1).

---

## 3. Estrutura Proposta — Separação de Cards Encadeados

### 3.1. Novo conceito: `WorkflowDefinition`

Um workflow passa a ser **declarado como dado**, não como código imperativo:

```typescript
// src/app/features/home/workflows/abertura-de-contas.workflow.ts
export const ABERTURA_DE_CONTAS_WORKFLOW: WorkflowDefinition<AberturaContasContext> = {
  id: 'abertura-de-contas',
  triggerCardId: 'cta-003',
  steps: [
    {
      id: 'contas-correntes-pf',
      label: 'Contas Correntes - PF',
      buildPayload: buildAgendarDebitoAutomaticoPayload,
      onSuccess: (execution, context) => ({
        ...context,
        conta: execution.extractedContaInfo?.conta,
        agencia: context.agencia ?? execution.extractedContaInfo?.agencia,
      }),
    },
    {
      id: 'habilitar-conta-ma',
      label: 'Habilitar Conta MA',
      buildPayload: buildHabilitarContaMaPayload,
    },
    {
      id: 'debito-automatico',
      label: 'Débito Automático',
      buildPayload: buildDebitoAutomaticoPayload,
    },
  ],
};
```

### 3.2. Novo módulo: `WorkflowEngine` (genérico, reutilizável)

```
src/app/core/workflow/
├── workflow.model.ts        (WorkflowDefinition, WorkflowStep, WorkflowRunState)
├── workflow-engine.service.ts   (motor genérico: roda step[i], aplica onSuccess, avança para step[i+1])
└── workflow-log.model.ts    (já existe como WorkflowLogEntry — só migra para este módulo)
```

O `WorkflowEngineService` conhece **apenas o contrato genérico** (`WorkflowDefinition`), nunca payloads específicos de card. A `HomeFacade` passa a apenas:

```typescript
generateMass(cardId: string, formInput: Record<string, unknown>): void {
  const workflow = this.workflowRegistry.findByTriggerCard(cardId);
  if (workflow) {
    this.workflowEngine.run(workflow, formInput);
    return;
  }
  // fallback para cards simples (mock), como hoje
}
```

### 3.3. Persistência de contexto (leve, sem backend)

`WorkflowEngineService` grava o estado atual (`currentStepIndex`, `context`, `log`) em `sessionStorage` a cada transição de etapa. Ao recarregar a página, a `HomeFacade` detecta um workflow em andamento e oferece **"Retomar execução"** ou **"Descartar"**.

### 3.4. Retry por etapa

Cada `WorkflowStep` pode declarar `retryable: true`. Se uma etapa falhar, o motor mantém o `context` acumulado até aquele ponto e expõe um botão "Tentar etapa novamente" — sem reexecutar as etapas anteriores já concluídas com sucesso.

---

## 4. Estrutura de Diretórios Proposta (visão completa)

```
src/app/
├── core/
│   └── workflow/                          [NOVO]
│       ├── workflow.model.ts
│       ├── workflow-engine.service.ts
│       └── workflow-registry.service.ts   (mapeia triggerCardId → WorkflowDefinition)
│
└── features/home/
    ├── builders/                          [EXISTENTE — mantido como está]
    │   ├── agendar-debito-automatico.builder.ts
    │   ├── habilitar-conta-ma.builder.ts
    │   ├── debito-automatico.builder.ts
    │   ├── workflow-environment.ts
    │   └── shared-request-defaults.ts
    │
    ├── workflows/                         [NOVO]
    │   └── abertura-de-contas.workflow.ts (declaração das 3 etapas)
    │
    ├── home.facade.ts                     [SIMPLIFICADO — delega ao WorkflowEngine]
    ├── home.ts / home.html / home.scss
    └── components/
        └── workflow-log-panel/            [NOVO — extrai o painel de log do home.html]
```

### Justificativa da separação

- **`builders/`** continua com responsabilidade única de "montar payload de UM card" — nenhuma mudança necessária aqui.
- **`workflows/`** é o lugar novo onde se **declara a ordem e o fluxo de dados** entre cards — hoje isso está implícito no código da Facade.
- **`core/workflow/`** é o motor genérico, agnóstico de qual workflow está rodando — reutilizável para qualquer workflow futuro (ex.: um workflow de "Encerramento de Conta" com outras 4 etapas, sem duplicar lógica de orquestração).
- **`home.facade.ts`** deixa de conhecer a sequência de 3 etapas — apenas resolve "qual workflow corresponde a este card?" e delega ao motor.

---

## 5. Roadmap de Implementação (fases incrementais)

A migração NÃO precisa ser um "big bang" — pode ser feita em fases, cada uma entregando valor isolado e sem quebrar o workflow atual (que já está validado em produção de testes).

### Fase 1 — Extrair o painel de log para um componente próprio
- Criar `shared/components/workflow-log-panel/` (html/ts/scss), movendo o bloco `@if (workflowLog().length) { ... }` de `home.html` para lá.
- **Risco:** baixo. **Esforço:** pequeno. **Ganho:** `home.html` fica mais limpo; o painel se torna reutilizável para outros workflows futuros.

### Fase 2 — Modelar `WorkflowDefinition` e `WorkflowStep` (sem motor ainda)
- Criar `core/workflow/workflow.model.ts` com as interfaces.
- Criar `features/home/workflows/abertura-de-contas.workflow.ts`, apenas descrevendo os 3 steps com os builders já existentes (sem alterar a `HomeFacade` ainda).
- **Risco:** nenhum (código novo, não conectado). **Esforço:** pequeno. **Ganho:** documentação viva da estrutura do workflow, pronta para o motor da Fase 3.

### Fase 3 — Implementar o `WorkflowEngineService` genérico
- Implementar o motor com a mesma lógica hoje espalhada em `executeAgendarDebitoAutomatico`/`executeHabilitarContaMa`/`executeDebitoAutomatico`, mas de forma genérica (itera sobre `steps[]`).
- Migrar `HomeFacade.generateMass()` para delegar ao motor quando o `cardId` corresponder a um `triggerCardId` de algum workflow registrado.
- **Risco:** médio — é a mudança que realmente substitui a lógica atual. Precisa de testes de regressão manuais (reexecutar os 3 cards e confirmar mesmo comportamento observado hoje).
- **Ganho:** elimina a duplicação de "chamar e no sucesso chamar o próximo"; workflow passa a ser dado, não código imperativo.

### Fase 4 — Persistência de contexto (retomada após refresh)
- Adicionar ao `WorkflowEngineService` a gravação/leitura de estado via `sessionStorage`.
- Adicionar à Home um banner "Você tem um workflow em andamento — Retomar / Descartar".
- **Risco:** baixo-médio (cuidado com serialização de `Date`/tipos). **Ganho:** resiliência a fechamentos acidentais de aba/refresh.

### Fase 5 — Retry por etapa
- Adicionar `retryable: true` aos steps e um botão "Tentar novamente" no painel de log quando uma etapa falha, sem re-executar etapas já concluídas.
- **Risco:** médio (precisa garantir que o contexto acumulado das etapas anteriores seja preservado corretamente). **Ganho:** menos fricção em falhas transitórias do TDM (rede instável, timeout pontual).

### Fase 6 — Seletor de ambiente (TI/TU) na UI
- Adicionar ao card `cta-003` um seletor (radio/select) de ambiente, análogo ao já existente no card `cta-004` (`PDB204P - TU` / `PCM2AB - NOVO TI`).
- Conectar o valor selecionado ao parâmetro `workflowEnvironment` já suportado por `HomeFacade.generateMass()` (hoje só alimentado com o default `'TU'`).
- **Risco:** baixo — a arquitetura de builders já suporta ambos os ambientes; é puramente uma exposição de UI.
- **Ganho:** usuário pode de fato escolher TI, sem qualquer mudança de backend/builder.

### Fase 7 (opcional, fora do escopo imediato) — CPF dinâmico
- Avaliar com o time de negócio se o CPF pode vir de um campo de formulário, ou se deve ser gerado seguindo as regras do PSDC de cada ambiente (TI/TU), para eliminar o erro de chave duplicada em reexecuções de teste.
- **Risco:** alto — depende de regra de negócio externa ao portal (validação do CPF no PSDC do TDM). Requer alinhamento prévio antes de codificar.

---

## 6. Critérios de Aceite Sugeridos (por fase)

| Fase | Critério de aceite |
|---|---|
| 1 | Painel de log renderiza identicamente ao atual; nenhuma mudança visual perceptível ao usuário. |
| 2 | Nenhuma mudança de comportamento (código novo não conectado); build sem erros. |
| 3 | Reexecução completa do workflow atual (3 cards) produz o mesmo resultado observado hoje (mesmos logs, mesma sequência, mesmo tratamento de erro). |
| 4 | Fechar a aba no meio da etapa 2 e reabrir mostra o banner de retomada com o contexto correto (agência/conta já extraídas preservadas). |
| 5 | Simular falha manual na etapa 3 (ex.: payload inválido temporário) e confirmar que o retry não repete as etapas 1 e 2. |
| 6 | Selecionar "TI" na tela e confirmar (via log/network) que o payload do card 1 usa `configurationId: 2985` e ambiente `"PCM2AB - NOVO TI"`, propagando corretamente para os cards 2 e 3. |

---

## 7. Riscos Gerais e Mitigações

- **Risco de regressão silenciosa:** como o workflow já está validado contra o TDM real, qualquer refatoração da Fase 3 deve ser acompanhada de testes manuais completos (os mesmos realizados durante o desenvolvimento original: execução real com agência/CPF de teste, observando os logs).
- **Risco de complexidade prematura:** as Fases 4 e 5 (persistência/retry) só devem ser priorizadas se houver evidência de que usuários reais estão perdendo progresso por refresh acidental ou enfrentando falhas transitórias recorrentes — caso contrário, adiar.
- **Dependência de decisão de negócio (Fase 7):** não deve ser iniciada sem alinhamento prévio sobre a origem/regra do CPF de teste.

---

## 9. [PENDENTE — Requisito Registrado em 13/08/2026] Execução de Requests com a Identidade do Usuário Logado no TDM

**Status:** Registrado para implementação futura. NÃO implementado ainda.

### Contexto e problema atual

Hoje existem duas autenticações completamente independentes no sistema:

1. **Login do Portal** (`server/src/auth/auth.service.ts` → `AuthService.login()`): valida o usuário/senha digitados diretamente contra o Broadcom TDM (via `tdmClient.verifyTdmCredentials()`), mas essa validação é **descartável** — serve só como "portão de entrada" para emitir o JWT do Portal. O token do TDM obtido nessa chamada não é armazenado nem reaproveitado em nenhum lugar.

2. **Execução real de jobs no TDM** (`server/src/tdm/tdm.client.ts` → `tdmRequest()`, usado por TODAS as submissões/consultas/downloads): sempre autentica com uma **identidade técnica única e fixa**, configurada em `TDM_USERNAME`/`TDM_PASSWORD` no `server/.env` — hoje `m627529`/`26ntt004` — com token cacheado por 10 minutos (`TOKEN_TTL_MS`), **independentemente de qual usuário está logado no Portal**.

Consequência: quando um usuário diferente (com credenciais corporativas próprias e válidas no TDM Portal) fizer login, todos os requests que ele disparar continuarão sendo executados no TDM em nome da identidade técnica fixa (`m627529`), e não da identidade real desse usuário. Isso significa que o campo `createdBy` retornado pelo TDM, as permissões de acesso a Catalogs/Cards/Generators específicos de cada usuário, e qualquer auditoria baseada em "quem realmente executou" não refletem corretamente a pessoa logada.

### Requisito confirmado pelo usuário (Carlos André Moitas) em 13/08/2026

> "Guarde e registre que vamos precisar dessa mudança para usar o usuário e senha para outros usuários que também possuem credenciais no TDM e essas credenciais devem ser usadas na execução de requests para executar qualquer ação/cards/generator em nome desse usuário logado."

Ou seja: **toda execução de request no TDM (submissão de job, consulta de status, download de artefato) deve usar as credenciais do usuário efetivamente logado no Portal, não uma credencial técnica fixa e compartilhada.**

### Direção de implementação futura (não implementada, apenas registrada)

Para atender esse requisito, será necessário:

1. **Capturar e reter, durante a sessão do usuário no Portal, as credenciais necessárias para autenticar no TDM em nome dele** — duas abordagens possíveis:
   - **(a) Reter o Bearer Token do TDM obtido no momento do login** (já é obtido em `tdmClient.verifyTdmCredentials()`, hoje descartado) e associá-lo à sessão do usuário no servidor (ex.: mapa em memória `Map<jwtSub, tdmToken>`, ou armazenado dentro do próprio JWT do Portal de forma criptografada). Vantagem: não exige guardar a senha do usuário. Desvantagem: o token do TDM tem TTL próprio (hoje considerado 10 min pelo cache técnico) — pode expirar antes da sessão do Portal (8h), exigindo um mecanismo de refresh/reautenticação silenciosa.
   - **(b) Reter a senha do usuário temporariamente em memória do servidor durante a sessão**, para poder reautenticar no TDM a cada expiração de token. Desvantagem clara de segurança: aumenta a superfície de exposição de credenciais em texto claro em memória do processo, mesmo que temporariamente.
   - A abordagem (a) é a recomendada por ser mais aderente a boas práticas de segurança, mas exige investigar o TTL real do token de sessão do TDM (Broadcom) e implementar renovação transparente.

2. **Alterar `tdmClient.tdmRequest()` para aceitar/receber qual identidade usar** — hoje ele sempre chama `tdmLogin()` (credencial técnica fixa do `.env`). Precisará ser parametrizado para receber o token (ou credenciais) do usuário da requisição em curso, passado a partir do `authMiddleware`/`req.user` (que já carrega o JWT decodificado do Portal) até `tdm.service.ts` e `tdm.client.ts`.

3. **Definir o comportamento de fallback**: o que fazer se o token do usuário expirar no meio de uma submissão de job (que já vimos levar minutos)? Precisa haver uma estratégia de refresh sem interromper o acompanhamento assíncrono já implementado em `core/executions/` (ver seção de monitoramento de jobs).

4. **Avaliar se as credenciais fixas do `.env` (`TDM_USERNAME`/`TDM_PASSWORD`) devem ser mantidas como fallback** para operações que não dependem de um usuário específico (ex.: health check em `server/src/health/health.service.ts`, que hoje usa `tdmClient.tdmLogin()` para validar que "o Portal está pronto para executar requests" de forma genérica, sem estar ligado a nenhuma sessão de usuário).

### Impacto em código já existente (mapeamento preliminar, para quando for implementado)

- `server/src/tdm/tdm.client.ts` — `tdmRequest()` precisará de um parâmetro opcional de credencial/token de usuário.
- `server/src/tdm/tdm.service.ts` — `submitAndDownload()`, `getJobStatus()` precisarão propagar a identidade do usuário da requisição.
- `server/src/tdm/tdm.routes.ts` — já tem acesso a `req.user` (via `authMiddleware`) — precisará passar essa informação adiante.
- `server/src/auth/auth.service.ts` — `login()` precisará reter o token/credencial do TDM obtido, em vez de descartá-lo.
- `server/src/health/health.service.ts` — decidir se continua usando a credencial técnica fixa (mais provável, já que health check não representa uma ação de um usuário específico) ou se passa a exigir um usuário autenticado.

---

## 10. Resumo Executivo

O workflow atual funciona e já foi validado contra o ambiente real do TDM, mas sua lógica de encadeamento está **imperativa e acoplada** à `HomeFacade`. A proposta introduz um **motor de workflow genérico** (`core/workflow/`) e uma **camada declarativa** (`features/home/workflows/`) que descreve os cards encadeados como dados, não como código — preparando o portal para crescer com novos workflows (ex.: outros catálogos de "Abertura de Contas" ou processos totalmente diferentes) sem duplicar a lógica de orquestração a cada novo caso. A migração é incremental (7 fases), cada uma com risco e esforço independentes, permitindo priorização conforme necessidade do produto.
