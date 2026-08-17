# Observações Técnicas — Diferenças decisivas no payload manual do Débito Automático

## Contexto

Após múltiplas tentativas de correção do card 3, foi finalmente fornecido o payload manual que conclui com sucesso no Portal TDM para a rotina:

- **Débito Automático Data Request**
- `levelID: 3101`
- `configurationId: 845`

Esse payload trouxe a evidência comparativa mais importante para a causa real da falha.

---

## Payload manual bem-sucedido

Diferenças relevantes observadas no request manual que funciona:

- `dataSourceProfile: ""`
- `dataTargetProfile: ""`
- `globalSourceConnection: ""`
- `globalTargetConnection: ""`
- `p_agencia: "3995"`
- `p_conta: "71071"`
- `p_combo_contratante: "123456789"`
- `p_projeto_jira: "ENGPBIA-ENGENHARIA DE PLATAFORMA | BIA TECH"`
- `email: "carlosandre.moitas@bradesco.com.br"`

---

## Divergências do portal antes deste ajuste

O portal estava enviando valores diferentes, especialmente em:

### 1. Projeto Jira
Antes:
- `CPTDM-CORPORATIVO | TDM`

Manual funcional:
- `ENGPBIA-ENGENHARIA DE PLATAFORMA | BIA TECH`

### 2. E-mail
Antes:
- `carlos.andremoitas@emeal.nttdata.com`

Manual funcional:
- `carlosandre.moitas@bradesco.com.br`

### 3. Contratante
Antes:
- `999-NOVO CONTRATO`

Manual funcional:
- `123456789`

### 4. Conexões globais
Antes, em versões do payload do portal:
- `globalSourceConnection: "DB204P"`
- `globalTargetConnection: ""` ou `"DB204P"`

Manual funcional:
- `globalSourceConnection: ""`
- `globalTargetConnection: ""`

---

## Conclusão técnica

A nova evidência mostra que a falha do card 3 não era apenas estrutural na árvore de jobs, nem apenas de agência/conta.

O payload manual que realmente funciona difere em **valores de negócio relevantes**, especialmente:

- `p_combo_contratante`
- `p_projeto_jira`
- `email`

Entre esses campos, o mais suspeito para impacto direto no insert do publish é:

- `p_combo_contratante`

pois ele provavelmente participa da derivação de chave/relacionamento para a tabela:

- `TAUTRZ_DEB_AUTOM`

---

## Correção aplicada até este ponto

Arquivo alterado:
- `src/app/features/home/builders/shared-request-defaults.ts`

### Ajustes realizados

Antes:
```ts
export const WORKFLOW_PROJETO_JIRA = 'CPTDM-CORPORATIVO | TDM';
export const WORKFLOW_EMAIL = 'carlos.andremoitas@emeal.nttdata.com';
```

Depois:
```ts
export const WORKFLOW_PROJETO_JIRA = 'ENGPBIA-ENGENHARIA DE PLATAFORMA | BIA TECH';
export const WORKFLOW_EMAIL = 'carlosandre.moitas@bradesco.com.br';
```

---

## Ponto ainda aberto

Ainda permanece divergência importante em:

- `p_combo_contratante`

Portal atual:
- `999-NOVO CONTRATO`

Manual funcional:
- `123456789`

Esse campo tem alta probabilidade de ser a próxima causa real a ser corrigida, caso a falha persista.

---

## Resumo

### Problema
O card 3 continuava falhando com:
- `SQLCODE=-407`
- `SQLSTATE=23502`

### Nova evidência decisiva
O payload manual bem-sucedido do Portal TDM usa valores diferentes em campos críticos de negócio.

### Correção aplicada agora
Atualização dos defaults compartilhados para alinhar:
- `p_projeto_jira`
- `email`

### Próxima hipótese prioritária
Corrigir o valor de:
- `p_combo_contratante`

pois ele ainda difere do payload manual funcional.
