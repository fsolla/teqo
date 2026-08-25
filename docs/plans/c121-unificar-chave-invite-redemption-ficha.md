# Impl: C121 — unificar a chave de lock da redenção de convite com o lock de ficha

Status: implementado (GATE aprovou opção B + re-leitura dentro do lock + autofill)
Atualizado em: 2026-08-24
Issue: #C121 (débito registrado em `pnpm agent:register` pelo fechamento do C120)
Intenção: débito capturado no fechamento do C120 (ver `docs/plans/c120-race-append-telefone-ficha-impl.md` §Componentes, "Invite redemption")
Appetite restante: ~1 dia

## Leitura da intenção

- **Outcome:** o read-modify-write do profile na redenção de convite passa a
  serializar contra o **mesmo** lock de ficha do create-flow
  (`contact-ficha:<id>`, C120): redenção e create nunca mais perdem um telefone
  do outro quando resolvem a MESMA ficha.
- **O que NÃO negociar:** sem mudança de schema; sem tocar a semântica de
  reorder do primário da redenção (o RMW dele reordena por design); sem mexer
  no `invite-redemption-user:*` / `account-username:*` (locks de outra faixa).
- **O que reavaliar:** o lock de redenção hoje cobre a transação INTEIRA da
  redenção (`invite-redemption-contact:<id>`); trocar a chave mantém a mesma
  janela, só que alinhada ao create-flow.

## Abordagem recomendada

Trocar `invite-redemption-contact:<id>` → `contact-ficha:<id>` na redenção usando
`acquireContactFichaLock` (já existe em `contactPhoneLocks.ts` desde o C120). O
spec `tests/int/campaignInvite.int.spec.ts:799-898` ancora a chave antiga e deve
ser revalidado.

**Encontrado na exploração (decisão no GATE):** o create-flow do C120 adquire os
locks na ordem `phone-keys PRIMEIRO → contact-ficha POR ÚLTIMO`
(`contactIdentity.ts:58`,`:81`, re-lendo os phones DENTRO do lock de ficha). A
redenção de login hoje adquire o lock de contato/ficha PRIMEIRO
(`campaignInviteRedemption.ts:67`) e os phone/account-keys DEPOIS (`:201`).
`pg_advisory_xact_lock` é transaction-scoped, então o lock cobre a RMW do
contact (`:232`) — a premissa do plano ("mesma janela") se confirma. MAS, se eu
só renomear a chave (mantendo a ordem atual), redenção e create passam a
contender pela MESMA chave `contact-ficha:<id>` em ordem INVERSA → **novo
deadlock** sob a corrida (redenção segura ficha→phone; create segura
phone→ficha). Esse deadlock NÃO existe hoje (chaves diferentes).

**Opções consideradas:**

- **A — renomear a chave MANTENDO a ordem atual (literal do plano original):**
  1 call-site + revalidação do spec; passa no teste de ordem existente
  (`:872-901`, que exige o lock de contato ANTES de `invite-redemption-user`).
  CUSTO: introduz o deadlock acima sob a corrida rara. **(não recomendada após
  exploração)**
- **B — renomear a chave E realinhar a ordem ao C120 (recomendada):** mover a
  aquisição de `acquireContactFichaLock` para DEPOIS dos phone/account-locks
  (`:201`) e ANTES da RMW do contact (`:232`), removendo-a de
  `findReusableLeadershipAccount` (`:67`). Ficha passa a ser adquirida por
  ÚLTIMO, igual ao create → sem deadlock, mesma janela de proteção. CUSTO: o
  teste de ordem `:872-901` precisa ser reescrito para a nova ordem (a chave de
  ficha agora vem DEPOIS de `invite-redemption-user`).
- **C — manter chaves separadas (rejeitada):** é exatamente o gap que o C120
  abriu — dois locks de contato que não se serializam.

### Componentes / mudanças

- **`src/utilities/campaignInviteRedemption.ts`** — trocar a chave para
  `contact-ficha:<id>`; na opção B, mover a aquisição para depois de `:201`.
- **`src/utilities/campaignInviteRepository.ts:127-132`** — `acquireCampaignInviteRedemptionContactLock`
  (único caller: `:67`) é removida; o call-site passa a usar `acquireContactFichaLock`.
- **`tests/int/campaignInvite.int.spec.ts:799-898`** — `invite-redemption-contact:`
  → `contact-ficha:`; na opção B, reescrever `:872-901` para a nova ordem.
- **Migration:** sem migration. **Access/Consent:** n/a. **UI:** n/a.
- **Observação de escopo (GATE):** o path de AUTO-FILL (`redeemCampaignInviteAutofillRecord`,
  `:85-158`) hoje NÃO adquire nenhum lock de ficha — só phone-keys (`:126`). Ele
  não usa `invite-redemption-contact` e está FORA das linhas citadas no plano.
  Para fechar 100% a corrida de telefone entre redenção e create, o auto-fill
  também deveria adquirir `acquireContactFichaLock` (após `:126`, antes `:138`).
  Decisão de escopo no GATE.

## Fases verificáveis

1. Trocar a chave (2 arquivos) + revalidação do spec literal.
2. `pnpm test:int campaignInvite` + spec do C120 (`contactPhoneAppendRace`).
3. Gates: `pnpm gate:fast`; entrega com `pnpm push`.

## Já resolvido no simplify/critique (não reabrir)

- Documentação da dependência do C120 em `contactPhoneLocks.ts` (quem
  serializa o quê).
- Full-replace/reorder editors (supporter/contact/leadership/tombstones) —
  **Explicitamente fora** (decisão travada no C120; editores têm semântica de
  full-replace, lock não muda last-writer-wins).

## Rabbit holes / Não escopo

- Não unificar `invite-redemption-user:*` nem `account-username:*` (outra faixa
  de lock, outra finalidade).
- Não extrair helper de RMW (duplicação C120 ficou em 2 call sites — regra do
  repo: <3 não abstrai). **Gatilho de extração:** 3º call site do padrão
  "lock de ficha + re-read + append-faltantes" (se este C121 adotar o
  append-form na redenção, vira o próprio 3º call site — revisitar).
- Renomear `contactPhoneLocks.ts` → `contactLocks.ts`: somente SE este item já
  tocar o arquivo (fase cosmética opcional por último).

## Riscos e mitigação

- Spec ancora a chave literal → atualizar junto na mesma entrega (sem isso o
  PR falha com a asserção velha, nunca com falsos verdes).
- **Deadlock por ordem de lock (encontrado na exploração):** só renomear a
  chave mantendo a ordem atual cria corrida-deadlock com o create do C120
  (chaves opostas em `contact-ficha:<id>`). Mitigação: opção B (realinhar
  ordem ao C120). **Decisão no GATE.**
- Redenção é single-use (token linka uma conta); a coincidência com um
  create-append da mesma ficha é rara — mitigada pelo lock compartilhado.

## Aceite de engenharia

- [ ] Redenção e create-flow serializam a ficha com a MESMA chave
- [ ] Spec `campaignInvite.int.spec.ts` revalidado com a chave nova
- [ ] Sem migration/schema; Access/Consent intocados
- [ ] CI verde antes do merge (spec + gates)
