# Mapa mental da arquitetura (Pass 2 — W3)

Status: **entregue** (Pass 2, 2026-07-25)
Atualizado em: 2026-07-25
Item pai: [IMPROVE-CODE-QUALITY-PLAN.md](../IMPROVE-CODE-QUALITY-PLAN.md) — Pass 2, W3 (depois de W1/W2)
Appetite: ~1 dia; docs-only

## Objetivo

Um humano ou agente novo se orienta no repo em minutos, sem arqueologia de git/AGENTS.md. Dois artefatos:

**1. `docs/ARCHITECTURE.md`** — o documento de arquitetura canônico:

- Contexto de sistema: um app Next + Payload, três route groups (`(frontend)` público, `(payload)` admin, `(campaign)` interno), duas barreiras de auth independentes (cookie `payload-token` vs `campaign-token`).
- Mapa de camadas + dependency rule como aplicada: `lib/` (puro, client-safe) ← `utilities/` (Payload/Next, `server-only` quando server-bound) ← `components/` ← `app/`; módulos de contrato para atravessar a fronteira client (padrão `municipalityMapContract`).
- Fluxo de dados: collections → access helpers (`utilities/access/*`) → loaders (`*Data.ts`, `select`ed view models) → RSC → ilhas client.
- Escada de caching (React `cache()` → `unstable_cache`+tag → artefato commitado) com os exemplos reais.
- Modelo RBAC da campanha (coordinator/candidate/advisor/leader; assimetria de pledge; lockdown do leader).
- Bounded contexts + glossário de linguagem ubíqua (W2): Município (unidade operacional ≠ município IBGE), Liderança, pledge `declaredVotes` vs `estimatedVotes`, Demanda, Plano, Apoiador, Dobradinha, termos da conta-da-cadeira (meta, cobertura, teto do campo, captura), contexts do site público (posts/tags/petições/consent).
- Decision log: todas as decisões do Pass 2 (D1–D6) + as decisões estruturais herdadas (transações multi-collection, consent fail-closed, migrations only).
- Cross-links para PRODUCT/DESIGN/CUSTOMER/research para o "porquê" — sem duplicar conteúdo.

**2. `.agents/rules/codebase-map.mdc`** — mapa navegacional compacto (~150 linhas), always-applied, criado com o skill `create-rule`: onde vive cada coisa, como achar o dono de uma feature, convenção de manutenção ("atualizado no mesmo PR que move coisas").

## Regras

- ARCHITECTURE.md descreve o estado **pós-W1/W2** (por isso roda depois).
- AGENTS.md continua sendo o guia operacional (setup, seeds, deploy); ARCHITECTURE.md é o mapa conceitual — sem sobreposição de conteúdo, com links cruzados.

## Impacto no roadmap

Nenhum item bloqueado. Todo item futuro (e todo agente) se beneficia.
