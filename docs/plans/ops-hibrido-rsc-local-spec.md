# Ops híbrido RSC/local — spec-mãe e critérios

Status: rascunho
Atualizado em: 2026-08-01
Issue: #164
Priority: P1
Model: cursor-grok-4.5-high
Impeccable: B — sync chrome + dual-path em superfícies staff existentes
Appetite: ~1 dia eng (só docs + decisões)
Responsável: —

## Premissas

1. Snapshot cobre o grafo operacional de staff; `supporter` fora (LGPD/volume) no v1.
2. Writes actuais são “último write ganha”; CAS muda semântica **só quando `baseUpdatedAt`/`baseEstimatedAt` é enviado** — call sites antigos continuam iguais.
3. Persistence OPFS/WA-SQLite pode falhar em iOS antigo — fallback IndexedDB obrigatório.
4. Sync full-only v1; deletes podem ficar no mirror até ao próximo full sync.
5. Leader sem mirror de ops (lockdown actual).
6. `OPS_HYBRID` compile-time env; sem rollout/cohort/kill switch.

→ Corrija agora ou sigo com estas.

## Objetivos

- Com `OPS_HYBRID=1`, abrir `/campanha` sincroniza o snapshot completo de ops para o device; chrome mostra “Actualizado”.
- Offline: detalhe de município + listas unificadas renderizam do mirror; regiões online-only mostram estado honesto.
- Writes (estimativas → municipality → leadership/activity/demand) funcionam offline via outbox + CAS, sem perda após reload.
- CI sem `OPS_HYBRID` idêntica a `main`.

## Dados → decisão → apresentação

Dados: N/A — infra de sincronização; chrome mostra só estado.

## Contexto

Ops em prod medidas em 2026-08-01: campanha ~4 MB vs TSE ~128 MB (não sincronizar). Dor do coordenador: estrada com LTE intermitente; WhatsApp/planilha competem (`docs/CUSTOMER.md` — Little Hire). PWA actual só shell ([`src/utilities/campaignPwa.ts`](src/utilities/campaignPwa.ts)).

## Decisões travadas

- **Graceful degradation + mirror completo.** Online RSC; offline Local. **Rejeitado:** SPA/Preact; sync engine externo (Electric/PowerSync/Zero) no v1.
- **Transporte GET `/campanha/api/ops-sync`.** Route handler, não Server Action — mede latência/tamanho. **Rejeitado:** POST sem payload; Server Action.
- **Full-only + tombstones fora.** Deletes esperam próximo full sync. **Rejeitado:** delta por `updatedAt` sem tombstones (rows fantasmas).
- **CAS por doc (`updatedAt`/`estimatedAt`).** Conflito = toast + escolha “Manter o meu / Usar o novo”. **Rejeitado:** LWW por relógio do client; “server sempre ganha” silencioso.
- **OH12 consome `opsListRegistry` (projecto CL).** **Rejeitado:** listas Local escritas à mão por domínio.
- **Tracer = estimativas antes do mirror completo (OH6 paralelo).** **Rejeitado:** mirror primeiro (atraso no feedback da dor real).
- **Persistência OPFS primeiro, fallback IDB.** **Rejeitado:** só OPFS (iOS antigo falha); só localStorage (limite/estrutura).
- **Leader sem mirror.** **Rejeitado:** slice supporter no mirror (escopo novo, LGPD).

## Escopo do snapshot (travado)

Inclui: `municipality`, `leadership` (+rels resumidos), `vote_pledge`, `activity` (lista), `state_deputy`, `organization`, `campaign_demand`, `campaign_goals`, `municipality_update` (últimos 50 por município).
Fora: TSE/`election_*`, geometries, media blobs, `supporter`, site público, `/admin`, contacts completos (só campos necessários às views piloto).

## Boundaries Teqo

- **Always:** sync com `getCampaignUser()` + `overrideAccess: false`; outbox com toast (Sonner); pin int access; SW nunca cacheia RSC.
- **Ask first:** dependency nova (TanStack); mexer em `campaignPwa.ts`; alterar zod de actions existentes.
- **Never:** sync TSE; mirror `supporter` v1; Consent por ID hardcoded; tocar Neon de prod; cachear Flight.

## Critérios de aceite do projecto

1. Sem `OPS_HYBRID`: CI idêntica a `main` (e2e existentes).
2. Com env, online: GET `ops-sync` 200 com snapshot; chrome “Actualizado”.
3. Airplane: detalhe no mirror renderiza via Local; regiões online-only com estado honesto.
4. Write offline → pending → online → aplica ou conflict UI; outbox sobrevive reload.
5. Advisor nunca recebe municípios fora da carteira; leader sem mirror.
6. `pnpm gate:fast` + specs novos verdes.

## Dependência entre projectos

- **Dura:** Lista Unificada Campanha — OH8 depende de **CL3**; OH12 depende de **CL8** (registry estável).
- **Paralelas OK:** OH1–OH7 com CL1–CL3.

## Referências

- [`src/utilities/campaignPwa.ts`](src/utilities/campaignPwa.ts)
- [`src/app/(campaign)/campanha/actions/votePledge.ts`](<src/app/(campaign)/campanha/actions/votePledge.ts>)
- [`docs/CUSTOMER.md`](docs/CUSTOMER.md) — Little Hire, canal de verdade WhatsApp
- AGENTS.md — Campaign auth, PWA, access, TSE artifact
