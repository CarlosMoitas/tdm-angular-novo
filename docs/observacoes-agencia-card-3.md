# Observações Técnicas — Agência incorreta propagada para os cards 2 e 3

## Contexto

Na análise da falha real do card **Débito Automático**, o log do TDM trouxe a evidência decisiva:

- `Insert into TAUTRZ_DEB_AUTOM failed`
- `SQLCODE=-407`
- `SQLSTATE=23502`

Esse erro em DB2 indica tentativa de insert com campo obrigatório nulo.

---

## Evidência observada

No payload persistido do card 3, a agência enviada era:

- `p_agencia: "448"`

Mas no primeiro card a agência informada pelo usuário e usada no contexto do workflow era:

- `3995`

Além disso, o card 1 havia extraído a conta do artefato `.zip`, e a aplicação estava montando o contexto compartilhado com esta lógica:

```ts
agencia: agencia || contaInfo.agencia || ''
```

ou seja:
- priorizava a agência digitada pelo usuário
- só usava a agência extraída do artefato como fallback

Durante a análise, ficou claro que isso podia manter uma agência não compatível com a conta efetivamente criada e extraída do artefato.

No caso observado, o payload do card 3 acabou indo com agência divergente da conta publicada, o que é compatível com falha de integridade no TDM/DB2.

---

## Causa raiz provável

Os cards 2 e 3 devem usar como fonte de verdade a dupla:

- agência extraída do artefato
- conta extraída do artefato

e não apenas a agência originalmente digitada no card 1.

Em workflows desse tipo, a agência da conta criada pode ser normalizada, derivada ou ajustada pelo próprio processamento do TDM. Se o portal continuar usando a agência digitada originalmente, pode montar combinações inválidas de:

- agência
- conta

Essa inconsistência é suficiente para causar falha de integridade no publish final.

---

## Correção aplicada

Arquivo alterado:
- `src/app/features/home/home.facade.ts`

### Antes

```ts
agencia: agencia || contaInfo.agencia || ''
```

### Depois

```ts
agencia: contaInfo.agencia || agencia || ''
```

---

## Objetivo do ajuste

Garantir que os cards encadeados:

- **Habilitar Conta MA**
- **Débito Automático**

usem prioritariamente a agência efetivamente extraída do artefato associado à conta criada.

---

## Impacto esperado

Com essa alteração:
- a combinação `agência + conta` enviada nos cards 2 e 3 fica mais consistente com o resultado real do card 1
- reduz a chance de o TDM receber chave relacional inválida ou combinação incompatível
- aumenta a aderência ao dado efetivamente gerado no ambiente

---

## Relação com o erro SQL -407

O log não expõe diretamente qual coluna veio nula, mas o contexto mostra que havia inconsistência de negócio no payload do card 3.

A correção foca no ponto mais provável de origem:
- propagação incorreta da agência no encadeamento do workflow

---

## Resumo

### Problema
Card 3 falhando com:
- `SQLCODE=-407`
- `SQLSTATE=23502`
- erro de integridade ao inserir em `TAUTRZ_DEB_AUTOM`

### Causa provável
Agência propagada para os cards 2 e 3 não estava priorizando a agência real extraída do artefato da conta criada.

### Correção
Ajuste na construção do `WorkflowContext` em:
- `src/app/features/home/home.facade.ts`

### Benefício
Os próximos cards passam a usar a agência mais confiável para a conta efetivamente criada no card 1.
