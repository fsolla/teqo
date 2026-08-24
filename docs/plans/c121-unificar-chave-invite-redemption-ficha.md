# Impl: C121 — unificar a chave de lock da redenção de convite com o lock de ficha

Status: rascunho
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

Trocar `invite-redemption-contact:<id>` → `contact-ficha:<id>` na redenção
(`campaignInviteRepository.ts:127-132` / `campaignInviteRedemption.ts:66-145`),
usando `acquireContactFichaLock`. O lock já está em `contactPhoneLocks.ts` desde
o C120; aqui é só o call-site novo + revalidar as asserções **literais** do
spec `tests/int/campaignInvite.int.spec.ts:799-898` (que ancora a chave antiga).

**Opções consideradas:**
- **A — reusar `acquireContactFichaLock` trocando a chave (recomendada):** 1
  call-site + revalidação do spec; alinha com o C120.
- **B — manter chaves separadas e documentar (rejeitada):** é exatamente o gap
  que o C120 abriu — dois locks de entidade de contato que não se serializam.
- **Rejeitadas além:** nenhuma (sem alternativa de mecanismo; a semântica de
  advisory lock é a mesma já aceita no C120).

### Componentes / mudanças

- **`src/utilities/campaignInviteRedemption.ts`** — trocar a chave para
  `contact-ficha:<id>`.
- **`src/utilities/campaignInviteRepository.ts:127-132`** — a public key skin de
  `<id>` (semântica atual) aponta para `contact-ficha:<id>`.
- **`tests/int/campaignInvite.int.spec.ts:799-898`** — espera literal da chave
  atualizada.
- **Migration:** sem migration. **Access/Consent:** n/a. **UI:** n/a.

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
- Redenção é single-use (token linka uma conta); a coincidência com um
  create-append da mesma ficha é rara — mitigada pelo lock compartilhado.

## Aceite de engenharia

- [ ] Redenção e create-flow serializam a ficha com a MESMA chave
- [ ] Spec `campaignInvite.int.spec.ts` revalidado com a chave nova
- [ ] Sem migration/schema; Access/Consent intocados
- [ ] CI verde antes do merge (spec + gates)