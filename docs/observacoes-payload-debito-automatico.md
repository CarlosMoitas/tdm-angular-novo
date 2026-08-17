# Observações Técnicas — Ajuste de payload do card "Débito Automático"

## Contexto

Após a correção anterior na lógica de interpretação de job pai/filhos, o último card do workflow:

- **Débito Automático (TU)**

continuou apresentando falha real no TDM para o job:

- `2569035`

Com evidência do próprio TDM:
- `Task State: Failed`

Isso mostrou que, neste caso, não era apenas falso negativo de polling no gateway.

---

## Evidência observada

Payload persistido do job `2569035`:

- arquivo: `server/storage/payloads/2569035.json`

Trecho relevante antes do ajuste:

```json
{
  "publishJobs": [
    {
      "dataSourceProfile": "DB204P",
      "dataTargetProfile": ""
    }
  ],
  "globalSourceConnection": "DB204P",
  "globalTargetConnection": "DB204P"
}
```

---

## Comparação com o padrão dos outros cards

### Card 2 — Habilitar Conta MA
Builder já utilizava:
- `dataSourceProfile: ""`
- `dataTargetProfile: ""`
- `globalSourceConnection: "DB204P"`
- `globalTargetConnection: ""`

### Card 3 — Débito Automático
Antes do ajuste, utilizava:
- `dataSourceProfile: "DB204P"`
- `dataTargetProfile: ""`
- `globalSourceConnection: "DB204P"`
- `globalTargetConnection: "DB204P"`

Ou seja, o card 3 estava inconsistente com o padrão de conexão mais compatível com rotinas intermediárias/finais do workflow.

---

## Hipótese técnica

O último card aparentemente não espera conexão alvo preenchida e também pode não esperar `dataSourceProfile` explícito no publish job.

A combinação anterior pode estar levando o TDM a interpretar incorretamente a configuração técnica da rotina:

- `dataSourceProfile: "DB204P"`
- `globalTargetConnection: "DB204P"`

Principalmente porque:
- o job falhou de fato no TDM
- a montagem do payload mostrava assimetria em relação ao card 2
- o card 3 é uma rotina de publish com configuração própria (`configurationId: 845`)

---

## Correção aplicada

Arquivo alterado:
- `src/app/features/home/builders/debito-automatico.builder.ts`

### Alterações

Antes:
```ts
dataSourceProfile: 'DB204P',
dataTargetProfile: '',
globalSourceConnection: 'DB204P',
globalTargetConnection: 'DB204P',
```

Depois:
```ts
dataSourceProfile: '',
dataTargetProfile: '',
globalSourceConnection: 'DB204P',
globalTargetConnection: '',
```

---

## Objetivo do ajuste

Alinhar o card 3 ao padrão de conexão mais coerente com:
- o card 2
- a semântica de rotina final do workflow
- a evidência de que o TDM estava falhando de fato com o payload anterior

---

## Impacto esperado

Com essa alteração:
- o payload do card **Débito Automático** deixa de enviar target connection preenchida indevidamente
- o `publishJob` deixa de forçar `dataSourceProfile` no nível local
- aumenta a aderência ao padrão que já vinha sendo aceito em outros steps

---

## Resumo

### Problema
O card 3 falhava de fato no TDM (`Task State: Failed`).

### Causa provável
Montagem inadequada dos campos de conexão no payload do Débito Automático.

### Correção
Ajuste em:
- `dataSourceProfile`
- `globalTargetConnection`

### Arquivo
- `src/app/features/home/builders/debito-automatico.builder.ts`
