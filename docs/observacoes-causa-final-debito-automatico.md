# Observações Técnicas — Causa final identificada no card "Débito Automático"

## Contexto

Após várias tentativas de ajuste no card 3, a evidência conclusiva veio da comparação entre:

- o payload automático montado pelo portal
- o payload manual executado com sucesso diretamente no Portal TDM

A comparação mostrou que o ponto decisivo não era apenas:
- status de job pai/filho
- agência propagada
- conexões globais
- projeto Jira
- e-mail
- contratante

O principal desvio funcional restante estava na **configuração técnica da rotina**.

---

## Evidência conclusiva

Payload manual bem-sucedido do Portal TDM:

```json
{
  "jobPubParams": {
    "publishJobs": [
      {
        "levelID": 3101,
        "configurationId": 2369,
        "vtfnodeID": "53470",
        "vtfnodeName": "Débito Automático Corrente Mobile e TF",
        "publishVariables": [
          { "name": "p_agencia", "value": "3995" },
          { "name": "p_conta", "value": "535021" },
          { "name": "p_combo_contratante", "value": "999-NOVO CONTRATO" },
          { "name": "p_projeto_jira", "value": "ENGPBIA-ENGENHARIA DE PLATAFORMA | BIA TECH" }
        ]
      }
    ],
    "globalSourceConnection": "",
    "globalTargetConnection": "",
    "email": "carlosandre.moitas@bradesco.com.br"
  }
}
```

---

## Divergência principal encontrada

No builder do portal, o card 3 estava usando:

- `configurationId: 845`

Mas o request manual funcional usa:

- `configurationId: 2369`

Essa diferença é crítica, porque o `configurationId` define a configuração técnica real do publish job no TDM.

Mesmo com:
- mesma rotina funcional
- mesmo `levelID`
- mesmo `vtfnode`
- mesmas variáveis de negócio

um `configurationId` divergente pode levar o TDM a:
- resolver mappings diferentes
- derivar colunas obrigatórias incorretamente
- montar insert incompatível com a tabela alvo
- disparar erro DB2 `SQLCODE=-407 / SQLSTATE=23502`

---

## Correção aplicada

Arquivo alterado:
- `src/app/features/home/builders/debito-automatico.builder.ts`

### Ajustes finais aplicados

1. `configurationId`
Antes:
```ts
configurationId: envConfig.configurationId
```

Depois:
```ts
configurationId: 2369
```

2. `p_combo_contratante`
Ajustado de volta para o valor que apareceu no payload manual funcional:
```ts
value: '999-NOVO CONTRATO'
```

3. Conexões globais
Mantidas alinhadas ao payload manual:
```ts
globalSourceConnection: ''
globalTargetConnection: ''
```

4. Campos obrigatórios do DTO
`csvDelimiter` e `csvQuotationMarks` foram mantidos como `null` para respeitar o tipo `PublishJobDto`.

---

## Causa raiz final

A causa mais provável da falha recorrente do card **Débito Automático** era o uso de **configurationId incorreto** no builder automático.

Isso explica por que:
- o payload parecia correto em vários campos
- o publish ainda falhava na `TAUTRZ_DEB_AUTOM`
- o request manual, com outra configuração técnica, funcionava

---

## Resumo

### Problema
Card 3 falhando com:
- `SQLCODE=-407`
- `SQLSTATE=23502`
- erro no insert em `TAUTRZ_DEB_AUTOM`

### Causa final identificada
Uso de `configurationId` diferente do payload manual funcional.

### Correção aplicada
No arquivo:
- `src/app/features/home/builders/debito-automatico.builder.ts`

Ajustes:
- `configurationId: 2369`
- `p_combo_contratante: '999-NOVO CONTRATO'`
- `globalSourceConnection: ''`
- `globalTargetConnection: ''`

### Benefício esperado
O payload automático do card 3 agora replica de forma muito mais fiel a configuração técnica do request manual que já foi validado com sucesso no Portal TDM.
