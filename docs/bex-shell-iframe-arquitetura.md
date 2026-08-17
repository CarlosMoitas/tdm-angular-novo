# Documentação Técnica — Avaliação do Portal TDM para hospedagem no BEX via Shell/Iframe

## 1. Objetivo

Este documento descreve a arquitetura atual do projeto `tdm-angular-novo`, seus componentes, dependências, fluxo operacional e pontos de atenção para avaliação de hospedagem no **BEX**, utilizando modelo de **shell/iframe**.

O objetivo é permitir que os engenheiros responsáveis pela análise do BEX entendam:

- como o portal funciona hoje
- quais serviços compõem a solução
- quais integrações externas são necessárias
- quais responsabilidades estão no frontend e no backend
- quais adaptações são esperadas para um cenário de hospedagem via shell/iframe
- quais riscos e decisões técnicas precisam ser consideradas

---

## 2. Visão geral da solução

A solução atual é composta por:

1. **Frontend Angular**
   - projeto principal `tdm-angular-novo`
   - responsável pela interface do usuário, orquestração da jornada e montagem dos payloads dos workflows

2. **Backend Node/Express dedicado**
   - diretório `server/`
   - responsável pela autenticação do portal e pela integração segura com o Broadcom TDM

3. **Broadcom TDM**
   - serviço externo corporativo
   - responsável pela execução real dos requests, jobs e geração de artifacts

4. **Script Python independente de teste**
   - arquivo `tdm_workflow_test.py`
   - executa os 3 cards diretamente contra o TDM, sem frontend e sem backend local
   - criado apenas para validação técnica isolada
   - não faz parte da arquitetura oficial do portal

---

## 3. Arquitetura lógica atual

```text
Usuário
  ↓
Frontend Angular (porta 4200 em dev)
  ↓
Proxy /gw/*
  ↓
Backend Node/Express dedicado (porta 3000 em dev)
  ↓
Broadcom TDM
```

### 3.1 Fluxo resumido
- o usuário acessa o portal Angular
- o Angular autentica o usuário no backend do portal
- o Angular envia requests para endpoints `/gw/*`
- o backend do portal protege as rotas e centraliza a comunicação com o TDM
- o backend submete jobs no TDM, consulta status, baixa artifacts e processa respostas
- o resultado volta ao frontend

---

## 4. Frontend Angular

## 4.1 Responsabilidades
O frontend é responsável por:

- login do usuário no portal
- exibição dos cards e jornadas
- captura de inputs do usuário
- montagem dos payloads dos workflows
- exibição de progresso, estados e retornos
- orquestração visual da jornada de execução

## 4.2 Estrutura funcional observada
Principais áreas do frontend:

- `src/app/features/home/`
  - tela principal dos cards
  - fachada de orquestração
  - builders dos payloads

- `src/app/features/login/`
  - fluxo de autenticação do portal

- `src/app/core/services/`
  - serviços de autenticação
  - catálogo
  - execução
  - jobs
  - loading
  - theme

- `src/app/core/interceptors/`
  - auth interceptor
  - correlation id interceptor
  - error interceptor
  - loading interceptor
  - retry interceptor

- `src/app/shared/components/`
  - navbar
  - loading overlay
  - cards reutilizáveis

## 4.3 Cards principais do workflow analisado
A jornada analisada contém 3 cards executados em sequência:

1. **Contas Correntes - PF**
2. **Habilitar Conta MA**
3. **Débito Automático**

Esses 3 cards formam um fluxo encadeado, em que a saída do primeiro alimenta os demais.

---

## 5. Backend Node/Express dedicado

## 5.1 Objetivo
O backend em `server/` foi criado como gateway dedicado do portal. Ele não reaproveita código do projeto legado e é a fronteira segura entre o Angular e o Broadcom TDM.

## 5.2 Responsabilidades
O backend atual executa as seguintes funções:

### Autenticação do portal
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Integração com TDM
- `POST /api/requests/submit-and-download`
- `GET /api/jobs/:jobId/status`

### Observabilidade
- correlation id
- logging
- tratamento padronizado de erro

### Processamento de artifact
- baixa o ZIP retornado pelo TDM
- lê o conteúdo em memória
- extrai `Agencia` e `Nova Conta` quando aplicável
- devolve os dados relevantes ao frontend

## 5.3 Fronteira de segurança
A principal decisão arquitetural atual é:

```text
Angular → JWT do Portal → Backend dedicado
Backend dedicado → credenciais/token do TDM → Broadcom TDM
```

Consequência:
- o Angular **não conhece** credenciais técnicas do TDM
- o backend é o único ponto com acesso a:
  - `TDM_BASE_URL`
  - `TDM_USERNAME`
  - `TDM_PASSWORD`
  - `TDM_BEARER_TOKEN`

Isso é especialmente importante para avaliação do cenário BEX.

---

## 6. Integração com o Broadcom TDM

## 6.1 Operações principais identificadas
Com base na implementação atual, o backend interage com o TDM nos seguintes endpoints:

### Login técnico no TDM
- `POST /TestDataManager/user/login`

### Submissão de request
- `POST /TDMDataFlowService/api/ca/v1/requests`

### Consulta de status de job
- `GET /TDMJobService/api/ca/v1/jobs/{jobId}`

### Download de artifact
- `POST /TDMJobService/api/ca/v1/jobs/{jobId}/actions/downloadArtifact`

## 6.2 Comportamento técnico atual
- token do TDM é cacheado no backend
- existe retry automático para 401/403
- requests enviam headers como `Origin`, `Referer` e `X-Requested-With`
- o backend realiza polling até conclusão
- ao final, baixa o artifact e processa o ZIP

---

## 7. Workflow de negócio analisado

## 7.1 Sequência dos 3 cards

### Card 1 — Contas Correntes - PF
Responsável por:
- criar conta corrente
- gerar artifact ZIP
- retornar dados operacionais que alimentam as próximas etapas

Payload inclui, entre outros:
- agência
- ambiente
- projeto Jira
- parâmetros fixos do fluxo

Saída relevante:
- `Agencia`
- `Nova Conta`

Essas informações são extraídas do artifact ZIP.

### Card 2 — Habilitar Conta MA
Depende de:
- agência vinda do card 1
- conta vinda do card 1
- projeto Jira propagado

### Card 3 — Débito Automático
Depende de:
- agência resultante da primeira etapa
- conta gerada na primeira etapa
- projeto Jira propagado
- parâmetros fixos de negócio do fluxo de débito automático

## 7.2 Encadeamento
O fluxo é dependente de estado e não pode ser tratado como 3 execuções isoladas sem contexto.

```text
Card 1 gera conta
  ↓
Artifact ZIP é baixado
  ↓
Agência/Conta são extraídas
  ↓
Card 2 usa conta/agência
  ↓
Card 3 usa conta/agência
```

---

## 8. Extração de artifact

## 8.1 Implementação atual
A extração acontece no backend, no módulo:

- `server/src/storage/artifact-extractor.ts`

## 8.2 Regra atual
O backend:
- abre o ZIP em memória
- localiza o arquivo `Action_38_1_Workflow.log`
- procura a última linha com:
  - `response.Content:`
  - `Agencia`
  - `Nova Conta`
- extrai:
  - `Agencia`
  - `Nova Conta`

## 8.3 Implicação para BEX
Caso a arquitetura mude, essa responsabilidade precisa continuar existindo em algum lugar:

- backend dedicado
- serviço intermediário corporativo
- ou outro componente server-side

Essa responsabilidade **não deve migrar para o shell BEX** se houver restrições de segurança ou de processamento.

---

## 9. Ambientes e configurações

## 9.1 Ambientes suportados
Atualmente a solução considera:

- `TU`
- `TI`

## 9.2 Configuração técnica por ambiente
O projeto já possui mapeamento explícito para:
- `configurationId`
- `levelID`
- `vtfnodeID`
- `vtfnodeName`
- labels de ambiente
- data design de cada rotina

Arquivo principal:
- `src/app/features/home/builders/workflow-environment.ts`

## 9.3 Observação
A UI atualmente trabalha com ambiente padrão `TU`, mas a estrutura já suporta `TI`.

---

## 10. Modo atual de execução local

## 10.1 Serviços locais
Em desenvolvimento local, a solução roda com:

- **Frontend Angular**
  - porta `4200`

- **Backend Node/Express**
  - porta `3000`

## 10.2 Proxy
O Angular usa `proxy.conf.json` para redirecionar:

- `/gw/*` → `http://localhost:3000/*`

Isso simplifica chamadas no frontend e evita problemas de CORS no cenário local.

---

## 11. Avaliação para hospedagem no BEX via shell/iframe

## 11.1 Cenário esperado
No modelo shell/iframe, o portal Angular tende a ser carregado dentro de uma casca/container maior do BEX.

Nesse cenário, os engenheiros devem avaliar:

- como o iframe hospedará o frontend
- como o frontend acessará o backend dedicado
- como cookies, tokens e headers serão tratados
- como a autenticação corporativa se integrará ao shell
- quais restrições de rede, CSP e CORS existirão

## 11.2 Recomendação arquitetural
A recomendação técnica mais segura é **manter a separação atual**:

- BEX/shell/iframe hospeda o **frontend**
- integração com TDM continua em um **backend dedicado**

Ou seja:

```text
BEX Shell
  ↓
Iframe com Angular
  ↓
Backend dedicado do portal
  ↓
Broadcom TDM
```

## 11.3 Motivos para manter backend dedicado
Essa abordagem preserva:

- sigilo das credenciais técnicas do TDM
- controle de autenticação
- retry e cache de token
- polling de jobs
- download de artifact
- extração de ZIP
- tratamento padronizado de erro
- logging e correlation id

Se o frontend no iframe chamasse o TDM diretamente, haveria riscos relevantes:
- exposição de credenciais/tokens
- dificuldade com CORS/CSP
- maior acoplamento do shell ao TDM
- perda da fronteira de segurança existente

---

## 12. Pontos de atenção para avaliação no BEX

## 12.1 Segurança
Avaliar:
- política de cookies/tokens dentro de iframe
- SameSite
- storage permitido
- headers de autenticação
- isolamento entre shell e app embarcado

## 12.2 CORS / CSP
Avaliar:
- se o frontend hospedado no iframe poderá chamar o backend dedicado
- necessidade de allowlist de domínios
- políticas de `frame-ancestors`
- políticas de `connect-src`

## 12.3 Rede corporativa
Avaliar:
- conectividade do backend com o TDM
- DNS/rotas
- proxy corporativo
- certificados
- TLS e aceitação de certificados internos

## 12.4 Observabilidade
Avaliar:
- como correlation id será propagado a partir do shell
- onde logs do iframe e do backend serão centralizados
- como os times irão rastrear um request fim a fim

## 12.5 Autenticação
Avaliar:
- se o login continuará no backend do portal
- se haverá integração do shell com SSO
- se o shell repassará contexto de identidade para o app embarcado
- se o backend continuará emitindo o JWT próprio do portal

## 12.6 Persistência e storage
Hoje:
- payloads podem ser persistidos para auditoria
- artifact ZIP é processado em memória
- o backend foi desenhado considerando cenário com restrição de disco

Isso é aderente ao contexto de shell/iframe e deve ser preservado.

---

## 13. Riscos de uma abordagem sem backend dedicado

Se houver tentativa de colocar a integração do TDM diretamente no frontend/iframe, os principais riscos são:

1. exposição de credenciais técnicas do TDM
2. exposição de bearer token em browser
3. dependência direta de CORS entre navegador e TDM
4. dificuldade de retry controlado
5. polling de longa duração no cliente
6. download/processamento de artifact no browser
7. maior dificuldade de auditoria e rastreabilidade
8. maior fragilidade operacional

Do ponto de vista arquitetural, essa abordagem não é a recomendada.

---

## 14. Script Python independente criado para testes

Foi criado um script na raiz do projeto:

- `tdm_workflow_test.py`

Objetivo:
- validar o fluxo diretamente contra o TDM
- executar os 3 cards sem frontend e sem backend local
- testar autenticação direta, polling e download de artifact

Importante:
- esse script **não faz parte da solução oficial**
- ele foi criado apenas para testes isolados
- ele **não substitui** a arquitetura recomendada para produção/BEX

Seu uso é útil para:
- troubleshooting
- validação de payload
- comparação entre comportamento via portal e comportamento direto no TDM

---

## 15. Recomendação final para análise do BEX

## 15.1 Arquitetura recomendada
Para publicação do projeto via BEX shell/iframe, a recomendação é:

- hospedar o **frontend Angular** dentro do shell/iframe
- manter o **backend dedicado** como camada obrigatória de integração
- manter o **Broadcom TDM** como dependência externa acessada apenas pelo backend

## 15.2 Benefícios
Essa abordagem:
- preserva a arquitetura já implementada
- reduz impacto no código atual
- mantém segurança das credenciais
- facilita observabilidade
- reduz acoplamento com o shell
- mantém o fluxo encadeado e o processamento de artifacts do lado servidor

## 15.3 Conclusão
O projeto está mais aderente ao cenário BEX quando tratado como:

- **frontend embarcado via iframe**
- **backend dedicado separado**
- **integração com TDM isolada no backend**

Essa é a topologia que melhor preserva segurança, governança e operacionalização da solução.

---

## 16. Resumo executivo

### Componentes
- Angular frontend
- Node/Express backend dedicado
- Broadcom TDM
- script Python independente de teste

### Portas locais em dev
- frontend: `4200`
- backend: `3000`

### Dependência externa
- Broadcom TDM

### Responsabilidade crítica do backend
- autenticação
- token/c credenciais do TDM
- submit
- polling
- download de artifact
- extração de conta/agência

### Recomendação para o BEX
- **manter backend dedicado**
- **não expor TDM diretamente ao frontend no iframe**
- **usar shell/iframe apenas como container do Angular**

---

## 17. Arquivos relevantes para análise técnica

### Frontend
- `src/app/features/home/home.facade.ts`
- `src/app/features/home/builders/agendar-debito-automatico.builder.ts`
- `src/app/features/home/builders/habilitar-conta-ma.builder.ts`
- `src/app/features/home/builders/debito-automatico.builder.ts`
- `src/app/features/home/builders/workflow-environment.ts`
- `src/app/core/services/auth.service.ts`
- `src/app/core/services/execution.service.ts`
- `src/app/core/services/job.service.ts`
- `src/app/core/api/gateway-api.service.ts`
- `proxy.conf.json`

### Backend
- `server/README.md`
- `server/src/tdm/tdm.client.ts`
- `server/src/tdm/tdm.service.ts`
- `server/src/tdm/tdm.routes.ts`
- `server/src/auth/auth.routes.ts`
- `server/src/auth/auth.service.ts`
- `server/src/config/env.ts`
- `server/src/storage/artifact-extractor.ts`

### Script de teste independente
- `tdm_workflow_test.py`

---

## 18. Mensagem final para o time avaliador

Este projeto já foi estruturado de forma compatível com uma abordagem de hospedagem em shell/iframe, desde que o BEX seja usado como camada de hospedagem do frontend e **não** como substituto da camada backend dedicada.

A análise técnica deve focar principalmente em:
- segurança de autenticação
- política de iframe
- conectividade entre shell, frontend e backend
- observabilidade fim a fim
- preservação da fronteira segura entre frontend e TDM
