# Impl: Múltiplos telefones por pessoa

Status: aprovado
Atualizado em: 2026-08-11
Issue: #626
Intenção: docs/plans/multiplos-telefones-por-pessoa.md
Appetite restante: ~1–2 dias eng (intenção); sem cortes de aceite

## Leitura da intenção

- **Outcome:** toda pessoa (liderança, apoiador, dobradinha, assessor) tem N telefones na ficha; listas mostram 1 (o principal); ficha mostra todos; WhatsApp/convite/import usam o principal; busca por telefone acha por qualquer número; guardrail C111 (números compartilhados entre pessoas) preservado.
- **O que NÃO negociar:** ordem = prioridade sem flag explícita; sem rótulos/tipos de telefone; import CSV com uma coluna; login da liderança continua o `username` (não muda); dedupe dentro da MESMA ficha bloqueia salvar; **UI pública intocada** — formulários de petição/WhatsApp (e o componente `PhoneInput`) não mudam; a mudança de dados entra só no mapeamento server-side das ações públicas.
- **O que reavaliar:** a hipótese da intenção listava `src/lib/phone.ts`, view models e import — ok; mas **assessor** tem camada extra (o telefone mora em `campaignUser.phone`, espelhado na ficha) e **`Contact.phone` é lido pelo site público** (petição/WhatsApp) e por export — a intenção não citava esses dois.

## Abordagem recomendada

```mermaid
flowchart LR
  C[Contact] -->|array field| P[phones: {value}[]]
  P -->|primary| H[primaryPhoneOf]
  H --> VM[view models / listas / wa.me / convite]
  W[formulários criação/edição] -->|PhonesFieldEditor| P
  S[busca/import/findOrCreate] -->|where phones.value| P
```

**Opções consideradas:** A | B | C
**Recomendação:** A — array field Payload `phones` com subcampo `value` na `Contact`, removendo `phone` (fonte única). Payload onde com `'phones.value': { equals/contains }` resolve busca/dedupe com JOIN nativo, `_order` preserva ordem = prioridade, e o admin UI ganha a edição de graça.
**Rejeitadas:**

- B — `jsonb phones: string[]` (custom/JSON): perde query/index Payload; `supporterListSqlFilters` e `supporterImportBulk` teriam que viver de SQL cru e a busca Payload (supporter filters, pickers) ficaria sem where nativo. Pior contrato para o caso de uso mais comum.
- C — collection join `contactPhone`: entidade demais para um campo sem rótulos/tipos; clareza zero de "principal" (teria `_order` escondido do mesmo jeito); admin group extra.
- D — manter `phone` + `phones` desnormalizados: duas fontes de verdade sincronizando em N write paths; rejeitado por invariante (uma fonte).

### Componentes / mudanças

- **`phones`** (`src/collections/Contact.ts`): array field `phones` (label "Telefones", subcampo `value` text 11 dígitos, `required: false`); remove o campo `phone`. `beforeValidate` da collection normaliza cada item (`normalizeBrazilianPhone` / regex 11 dígitos), filtra vazios, rejeita inválido com `BRAZILIAN_PHONE_INVALID_MESSAGE` e rejeita **duplicado dentro da ficha** (nova copy: `BRAZILIAN_PHONE_DUPLICATE_MESSAGE` = "Telefone repetido na ficha.").
- **Migration** `add_contact_phones_array`: tabela gerada `contact_phones` (\_parent_id, \_order, value) + backfill manual `INSERT ... SELECT id, phone, 0 FROM contact WHERE phone IS NOT NULL` + `DROP COLUMN contact.phone` (derruba `contact_phone_idx` junto) + índice manual `contact_phones (value)` (Payload não indexa subcampo de array; o equals/in da busca precisa).
- **`primaryPhoneOf`** (`src/lib/phone.ts`): `phones[0]?.value ?? null` — o único tradutor array→principal. Todos os readers de lista/ficha passam por ele (view models `leadershipData`, `stateDeputyData`, `peopleData`, `supporterViewModels`, `leaderContactsPageData`, `campaignInvitePageData`, `activityViewModels`, home search, `MunicipalityDossier`, `ContactCombobox`, `wizardLeadershipContract`).
- **`setContactPhones`** (nova utility `src/utilities/contactPhones.ts`): read-modify-write transacional do array (usada pelas actions de edição inline "seta principal preservando o resto" e pelos editors de ficha); `normalizeContactPhones` (pure, compartilhada com o hook e com o zod).
- **`PhonesFieldEditor`** (novo componente `src/components/campaign/shared/PhonesFieldEditor.tsx`): inputs mascarados repetíveis (reusa `FormattedInput` + `formatBrazilianPhoneInput`), remover por linha, "+ Adicionar telefone", setas ↑/↓ de reordenação (ordem = prioridade; sem arrasto — anti-goal). Serializa `phones` repetido no FormData (padrão `repeatedRelationshipFormValues`; novo `repeatedPhoneFormValues` em `src/lib/formData.ts`).
- **Schemas** (`src/lib/schemas/`): **`contactSchema` permanece com `phone`** (só o público usa — petição/WhatsApp); as ações públicas mapeiam `phone → phones: [{ value }]` ao gravar a `Contact` (UI e zod públicos intocados). Nos schemas de campanha: `leadershipCreateSchema`/`wizard`/`supporter`/`leaderSupporter`/`invite` trocam `phone` por `phones` (array, min 1 nos fluxos que exigiam); `contactFieldUpdateSchema`: branch `field: 'phone'` passa a significar "escrever principal preservando o resto" e novo branch `field: 'phones'` (array completo) para os editors de ficha.
- **Access / Consent:** nenhum (campo interno de `Contact`; sem Consent novo).
- **UI:** Impeccable B — formulários de criação/edição + ficha + listas existentes; shape→craft→critique→polish no editor compartilhado; shells e células inline existentes (`CampaignInlineEditableCell`) permanecem para as listas (mostram o principal, editam o principal).

## Fases verificáveis

1. **Tracer schema+server** — campo array + hook + migration (backfill+drop+índice) + `primaryPhoneOf` + `findOrCreateContactByPhone` via `phones.value` + view models trocando para o principal + ações públicas mapeando `phone → phones[0]` (sem tocar UI/zod públicos) + `signatureExport` + seed/fixtures. **Spike aqui:** confirmar semântica do `where: { 'phones.value': { equals/contains } }` em Payload 3.82 (int spec) — se falhar, fallback é JOIN cru nos poucos sites Payload-where.
2. **Write paths** — zod/schemas das 5 superfícies + actions (leadership create/wizard/inline, supporter create/tombstone LGPD, stateDeputy inline, leaderSupporter, convite redemption, sync `CampaignUser` (append se faltar), import CSV preview+bulk) + where de busca (`supporterListFilters`, `supporterListSqlFilters`, pickers de atividade, combobox).
3. **UI** — `PhonesFieldEditor` + forms de criação (LeadershipForm, SupporterForm, LeaderContactForm, WizardLeadershipForm) + fichas (LeadershipContactSection, StateDeputyContactSection, "Dados de contato" do apoiador com editor novo, assessor ganha seção "Telefones" na ficha) + células inline inalteradas na lista.
4. **Gates** — unit (primaryPhoneOf, normalize/dedupe, schemas, formData) + int (multi-telefone nas 5 superfícies, dedupe bloqueia, principal preservado no inline, import, convite, busca por qualquer número, tombstone substitui TODOS os telefones, sync append) + `pnpm gate:fast` + `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Não adicionar busca por telefone nas listas que hoje só buscam por nome (lideranças, dobradinhas, pessoas, assessores) — o aceite é "a busca por telefone encontra por qualquer número" onde busca por telefone existe (apoiadores, pickers); adicionar nas outras é item futuro se a mesa pedir. **Gatilho de revisitação:** mesa perguntar "por que não acho a liderança pelo número na lista de lideranças".
- Sem cap de quantidade de telefones; sem flag "principal"; sem arrasto (setas são suficientes para trocar prioridade).
- `campaignUser.phone` permanece campo único da conta (canal de contato/login); não vira array.
- Sem espelho ficha→conta (conta continua espelhando UNICAMENTE via sync existente conta→ficha, agora append).

## Riscos e mitigação

- **Payload onde em subcampo de array** (`'phones.value'`): spike na Fase 1 com int spec; fallback JOIN cru documentado nos poucos sites.
- **Migration destrutiva em prod (PII real):** backfill roda ANTES do drop no mesmo migration; `migrate:status` local + revisão do SQL no checklist de deploy.
- **Churn de testes** (muitos specs leem `contact.phone`): helper de fixture `createContact` continua aceitando `phone` e mapeia internamente para `phones` — maioria dos specs int fica intocada; asserts com `where: { phone }` viram `where: { 'phones.value': … }`.
- **Race do sync conta→ficha (append)**: sem transação garantida no hook; se o append colidir com edição concorrente, o dedupe fail-closed rejeita o save da conta (raro, mensagem clara).
- **Inline edit de lista** apagar principal: "limpar o campo" remove o index 0 (o resto sobe); nunca zera os demais.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (N telefones, lista=principal, ficha=todos, wa.me/convite/import=principal, busca por qualquer, C111 preservado, dedupe interno)
- [ ] Invariantes AGENTS/engineering-standards (fonte única em `Contact`; transação+req nas escritas multi-collection; copy pt-BR; identificadores inglês)
- [ ] Testes de domínio previstos (unit/int) onde access/write paths mudam — acima
