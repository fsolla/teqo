---
id: D10
depends:
  - 596
serializes: []
priority: P3
model: composer-2.5
model-local: deepseek-v4-flash-high
---

# Escala/DRY pós-D9: auto-cura de leftovers de consent/supporter + ABBA do shared-write do lease de consent

Lote de engenharia triado pelo `capture-review-debts` da sessão D9 (#596). Só testes/helpers; zero `src/` e zero migration.

## F1 — Self-heal de renames órfãos de consent (expensive_lock, unicidade)

**Problema:** uma run abortada no meio de um fixture de rename (kill do worker, restart do Postgres, timeout em cascata) deixa a linha canônica renomeada (`temporarily-renamed-consent`, `chave-renomeada`, `chave-temporariamente-ausente`, `temporarily-unkeyed-<id>`) e o snapshot perdido. O run seguinte: o fixture snapshotta a key canônica como ausente, cria uma linha nova, e o rename do teste bate no **UNIQUE** (`Valor deve ser único`) — a poluição é **auto-sustentada** (observado na sessão D9: 1 restart do container → 2–3 falhas por run até a limpeza manual). Mesma classe: contatos/supporters órfãos de runs abortados causam o conflito transitório 'Esta pessoa já está cadastrada como apoiador neste município' (1/14 nos runs da sessão).

**Direção:** os fixtures de consent (`withMutableConsentFixture`/`withMissingInviteConsentFixture`) e o `campaignFixtures.cleanup()` reconhecem e removem renames órfãos das keys estáveis no início do fixture (limpeza determinística por lista explícita dos nomes temporários + padrão `temporarily-unkeyed-%`), e o cleanup de supporter faz o mesmo para contatos/supporters órfãos. A decisão exata (lista vs padrão vs re-snapshot por id) fica para o impl plan — o aceite é: uma run abortada nunca mais envenena o run seguinte.

## F2 — ABBA latente do shared-write no lease de consent (expensive_lock)

**Problema:** `withLeasedConsent` (e o `withInviteConsent` de `campaignInviteUi`) segura o lease **shared** enquanto a operation **escreve** linhas do domínio de invite (redeem/consume) — a escrita segura row locks de invite; um holder exclusivo de consent (fixtures de `campaignInvite`) que escreve invites segura os row locks e espera o exclusivo → **deadlock ABBA** (consent-shared ↔ invite-row) — observado na sessão D9: cascata de 43–45 timeouts sob 6 workers (o lease exclusivo da Onda0 alargou a superfície; o revert para shared mitigou, mas o ABBA pré-existente permanece latente). O `campaignSupporter:95` tem o mesmo padrão (janela shared + operation que faz upsert de contato).

**Direção:** operations escritoras não devem rodar sob lease **shared** de consent — ou o lease sobe para exclusivo quando a operation escreve (decisão por contrato: `withLeasedConsent` ganha variante para leitura vs escrita), ou as escritas saem do escopo do lease shared. A ordem canônica (consent → invite) e o FIFO do advisory lock devem ser auditados para eliminar o ciclo. Decisão no impl plan; o aceite é: a cascata de timeouts não reproduz sob 6 workers + carga.

## Fases verificáveis

1. **F1** — self-heal de renames; repro: plantar um rename órfão, rodar a suíte 2×, provar a auto-cura; gates.
2. **F2** — contrato de leitura/escrita do `withLeasedConsent`; repro: 6 arquivos da key sob carga ×N sem cascata; suíte completa.

## Rabbit holes / Não escopo

- Mecanismo de lease (advisory lock) — canônico, fora.
- Orçamento de 15s do vitest (documentado na `vitest.config.mts`) — fora (gatilho: recorrência de cascatas com pool ativo).
- 4ª key da Onda0 (`campanha-notificacoes-push`) sem lease — comentado; fora (gatilho: primeiro escritor do push key).

## Já resolvido no simplify/critique (não reabrir)

- Asserções de restore por snapshot do fixture (não leituras voláteis).
- Janela de `withMissingInviteConsentFixture` sob lease + re-verificação/re-delete do gap setup→janela.
- Down da Onda0 restaura ids originais; leases shared (revert do exclusivo).
- `ORDER BY id`/`sort: 'id'` nas leituras limit-1; core `withDatabaseLease`; `restoreConsentRows` compartilhado; `ensureInviteConsent` órfão removido.

## Explicitamente fora (com gatilho)

- **S3** — cascata de 15s sob carga extrema: gatilho = recorrência com pool ativo (medir antes de mexer no orçamento).
- **S6** — push key sem lease: gatilho = primeiro escritor da key.
- Poluição residual de contatos (702 linhas runID-scoped, inertes): coberta pela limpeza da F1.

## Aceite de engenharia

- [ ] Run abortado não envenena o run seguinte (F1)
- [ ] Cascata de timeouts não reproduz sob 6 workers (F2)
- [ ] Invariantes AGENTS/engineering-standards; só testes; sem migration
