# Observações Técnicas — Card 3 "Débito Automático" e classificação de job filho

## Contexto

Durante a execução do workflow de 3 cards, o último card:

- **Débito Automático (TU)**

era exibido no portal como:

- `O job #### terminou com status Failed`

Entretanto, ao consultar o request diretamente no Portal TDM, o processamento aparecia como:

- `Completed`

Isso indica divergência entre:
- a forma como o TDM apresenta a execução no portal oficial
- a forma como o nosso gateway interpreta o estado final do job

---

## Sintoma observado

No fluxo do portal:
- `[3/3] Débito Automático (TU): enviando request ao Gateway...`
- em seguida:
  - `erro — O job 2569035 terminou com status Failed.`

Mas a execução correspondente no Portal TDM constava como concluída.

---

## Evidência inspecionada

Payload persistido do job:
- `server/storage/payloads/2569035.json`

Características relevantes:
- `jobTitle: "Débito Automático Data Request"`
- `levelID: 3101`
- `configurationId: 845`

---

## Hipótese técnica

O TDM pode retornar um **job pai** com coleção de **jobs filhos**, e o nosso gateway estava usando uma lógica mais rígida para concluir sucesso:

- sucesso apenas quando:
  - `parent.status === Completed`
  - e o child selecionado também estivesse `Completed`

Se o job pai viesse com estrutura inconsistente, por exemplo:
- pai `Completed`
- algum child terminal diverso
- child correto `Completed`
- ou child selecionável concluído apesar de outro filho marcar estado divergente

o gateway poderia interpretar incorretamente como falha, mesmo quando o Portal TDM tratava o request como concluído.

---

## Correção aplicada

Arquivo alterado:
- `server/src/tdm/tdm.service.ts`

### Ajuste realizado

Foi adicionada a função:

```ts
function isTerminalStatus(status?: string): boolean {
  return ['completed', 'failed', 'cancelled', 'canceled'].includes(normalizeStatus(status));
}
```

E a lógica de polling passou a aceitar um caso adicional:

- se o **job pai estiver Completed**
- e **todos os filhos estiverem em estado terminal**
- e existir **ao menos um child job selecionável completed**

então o gateway:
- registra um `warn`
- assume sucesso com base no child job completed
- prossegue com o download do artifact usando esse child

---

## Objetivo da correção

Evitar falso negativo no card 3 quando:
- o TDM concluir efetivamente o request
- o Portal TDM exibir `Completed`
- mas a estrutura interna do job pai/filhos vier inconsistente ou ambígua para o nosso polling

---

## Impacto esperado

Com essa mudança:
- o último card deixa de falhar em cenários onde existe child job completed utilizável
- o gateway continua rejeitando falha real quando o job pai de fato termina em:
  - `Failed`
  - `Cancelled`
  - `Canceled`

---

## Segurança da alteração

A correção foi feita de forma conservadora:
- não alterou payload do card 3
- não alterou autenticação
- não alterou builders
- não alterou download de artifact
- apenas tornou a interpretação do estado final mais aderente ao comportamento observado no Portal TDM

---

## Observação adicional

Permanece útil, em caso de nova divergência futura, registrar o JSON completo retornado por:

- `GET /TDMJobService/api/ca/v1/jobs/{jobId}`

para comparar:
- `parent.status`
- lista de `jobs[]`
- `type`
- `artifactLocation`
- child realmente usado pelo Portal TDM

---

## Resumo

### Problema
O card 3 podia ser marcado como `Failed` no portal mesmo quando o Portal TDM mostrava `Completed`.

### Causa provável
Interpretação excessivamente rígida da árvore de jobs pai/filhos no polling do gateway.

### Correção
Ajuste no `server/src/tdm/tdm.service.ts` para aceitar sucesso quando:
- pai está `Completed`
- filhos estão em estado terminal
- existe child completed utilizável

### Benefício
Reduz falso negativo no fechamento do workflow de 3 cards.
