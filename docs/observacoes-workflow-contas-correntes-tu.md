# Observações Técnicas — Workflow "Contas Correntes - PF" no ambiente TU

## Objetivo

Registrar o comportamento observado no card **Contas Correntes - PF** do workflow **Abertura de Contas**, especificamente no ambiente **TU**, para consulta futura e eventual correção adicional.

---

## Contexto

Durante a execução do workflow pelo portal `tdm-angular-novo`, o primeiro card:

- **Contas Correntes - PF**

estava falhando com status:

- `Failed`

O erro era percebido no portal durante a etapa:

- `[1/3] Contas Correntes - PF (TU)`

---

## Evidência inicial observada

O payload persistido pelo backend para o job com falha mostrava a seguinte configuração principal:

- `levelID: 3309`
- `configurationId: 2982`
- `p_ambiente_gerar_conta: PDB204P - TU`
- `p_SegmentoContaCorretePF: 000-CLIENTE CLASSIC`
- `p_agencia: 3995`
- `p_cpf: 0`
- `p_qtdcontas_ger: 1`
- `p_tp_disp: SEM DISPOSITIVO`
- `dataSourceProfile: DB204P`
- `dataTargetProfile: DB204P`
- `globalSourceConnection: DB204P`
- `globalTargetConnection: DB204P`

---

## Log de erro relevante

Foi apresentado log do TDM/DB2 com falha na tabela:

- `SIT_CTA_CLI`

Erro observado:

- `DB2 SQL Error: SQLCODE=-904`
- `SQLSTATE=57011`
- `SQLERRMC=00C90097;00000200;BISDD000.BISDS001`

Leitura técnica:
- o TDM aceitava o request
- o workflow iniciava normalmente
- múltiplas tabelas eram publicadas com sucesso
- a falha acontecia durante o publish de `SIT_CTA_CLI`

Isso indicava possível problema operacional/interno no ambiente de dados, mas ainda sem excluir divergência de configuração entre o payload do portal e o payload manual usado no Portal TDM.

---

## Evidência comparativa decisiva

Foi fornecido um payload executado **manualmente direto no Portal TDM** com sucesso.

Esse payload bem-sucedido continha:

- `levelID: 3309`
- `configurationId: 2985`
- `p_ambiente_gerar_conta: PDB204P - TU`
- `p_SegmentoContaCorretePF: 000-CLIENTE CLASSIC`
- `p_agencia: 3995`
- `p_cpf: 0`
- `p_qtdcontas_ger: 1`
- `p_tp_disp: SEM DISPOSITIVO`

Diferenças relevantes em relação ao portal:
- `configurationId` manual: **2985**
- `configurationId` portal: **2982**

Além disso, no payload manual:
- `dataSourceProfile: ""`
- `dataTargetProfile: ""`
- `globalSourceConnection: ""`
- `globalTargetConnection: ""`

Enquanto no portal:
- `dataSourceProfile: "DB204P"`
- `dataTargetProfile: "DB204P"`
- `globalSourceConnection: "DB204P"`
- `globalTargetConnection: "DB204P"`

---

## Correção aplicada

Arquivo alterado:

- `src/app/features/home/builders/workflow-environment.ts`

Alteração aplicada para o ambiente `TU` no card **Contas Correntes - PF**:

```ts
configurationId: 2982
```

foi alterado para:

```ts
configurationId: 2985
```

---

## Interpretação atual

A divergência mais objetiva encontrada entre o payload manual bem-sucedido e o payload gerado pelo portal foi o `configurationId`.

Assim, a correção aplicada foi:

- alinhar o `configurationId` do ambiente `TU` ao valor observado no request manual funcional

---

## Ponto ainda aberto para investigação futura

Mesmo após identificar a divergência de `configurationId`, permanece registrada uma diferença adicional relevante:

### Portal atual envia:
- `dataSourceProfile: DB204P`
- `dataTargetProfile: DB204P`
- `globalSourceConnection: DB204P`
- `globalTargetConnection: DB204P`

### Payload manual bem-sucedido envia:
- `dataSourceProfile: ""`
- `dataTargetProfile: ""`
- `globalSourceConnection: ""`
- `globalTargetConnection: ""`

## Importante
Neste momento, **não foi aplicada alteração nesses 4 campos**, porque:

1. já existia evidência anterior de funcionamento usando `DB204P`
2. a divergência comprovada mais forte era o `configurationId`
3. alterar múltiplas dimensões simultaneamente dificultaria isolar a causa real

---

## Recomendação para futura análise, se a falha voltar

Se o problema reaparecer mesmo com `configurationId: 2985`, revisar comparativamente:

1. `dataSourceProfile`
2. `dataTargetProfile`
3. `globalSourceConnection`
4. `globalTargetConnection`

Comparar sempre com o payload que funciona no **Portal TDM manual**.

Possível hipótese futura:
- o `configurationId 2985` pode estar associado a uma execução que espera conexões vazias
- enquanto a configuração antiga `2982` podia operar com `DB204P`
- isso precisa ser validado empiricamente se houver nova falha

---

## Resumo executivo

### Problema
Falha do card **Contas Correntes - PF** no ambiente **TU** ao executar via portal.

### Divergência encontrada
O portal estava usando:

- `configurationId: 2982`

enquanto o request manual bem-sucedido no Portal TDM usava:

- `configurationId: 2985`

### Ação realizada
Foi ajustado o mapeamento do ambiente `TU` para usar:

- `configurationId: 2985`

### Ponto de atenção futuro
Se necessário, investigar também o impacto de:
- `dataSourceProfile`
- `dataTargetProfile`
- `globalSourceConnection`
- `globalTargetConnection`

---

## Arquivos relacionados

- `src/app/features/home/builders/workflow-environment.ts`
- `src/app/features/home/builders/agendar-debito-automatico.builder.ts`
- `server/src/tdm/tdm.service.ts`
- `server/storage/payloads/2568917.json`

---

## Observação final

Este documento registra uma correção orientada por evidência comparativa entre:

- payload gerado pelo portal
- payload manual funcional no Portal TDM

Ele deve ser usado como referência caso a rotina volte a falhar ou caso seja necessária nova calibração técnica do card 1 no ambiente TU.
