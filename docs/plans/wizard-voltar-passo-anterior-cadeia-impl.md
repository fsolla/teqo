# Impl: Wizard — Voltar = passo imediatamente anterior (também na cadeia)

Status: aprovado
Atualizado em: 2026-08-02
Issue: #289
Intenção: docs/plans/wizard-voltar-passo-anterior-cadeia.md
Appetite restante: ~0,25d (helper + 4 call sites + unit)

## Leitura da intenção

- **Outcome:** Voltar no header do wizard navega ao passo imediatamente anterior — busca de município, elo anterior na cadeia B98, ou sub-passo do mesmo fluxo.
- **O que NÃO negociar:** matriz B98 existente; sub-passos intra-fluxo (nota/corpo) continuam com Voltar local; sem migration.
- **O que reavaliar:** hipótese de tocar só `page.tsx` — os `previousHref` vivem nos componentes de passo; corrigir no dono `wizardActionChain` + call sites.

## Abordagem recomendada

```mermaid
flowchart LR
  Step["Passo wizard"] --> Prev["wizardChainPreviousHref"]
  Prev --> Seq["wizardChainSessionSteps(entry)"]
  Seq --> Href["wizardHrefForChainStep / busca município"]
```

**Opções consideradas:**

- A) Helper simétrico a `wizardChainContinueHref` em `wizardActionChain.ts`
- B) Prop `previousHref` calculada só em `page.tsx`
- C) Histórico em `sessionStorage`

**Recomendação:** **A** — mesma fonte de verdade B98; componentes já recebem `entryAction` + `municipalitySlug`.

**Rejeitadas:** B (page não conhece sub-modos); C (frágil, fora do padrão URL).

### Componentes / mudanças

- **`wizardChainSessionSteps` / `previousWizardChainStep` / `wizardChainPreviousHref`** (`src/lib/wizardActionChain.ts`): sequência `[entry, ...wizardChainAfter(entry)]`; índice 0 → busca município; senão `wizardHrefForChainStep` do elo anterior.
- **Passos raiz:** `WizardExpectedVotesStep`, `WizardTrendChoiceStep`, `WizardSignalTypeStep`, `WizardLeadershipStep` — trocar `previousHref` hardcoded.
- **Inalterados:** `WizardTrendNoteStep`, `WizardSignalBodyStep` (sub-passos); `WizardMunicipalitySearchStep` (entry).
- **Migration:** sem migration.
- **Testes:** estender `wizardActionChain.unit.spec.ts`.

## Fases verificáveis

1. Helper + unit pins
2. Call sites nos quatro passos raiz
3. `pnpm gate:fast`; `pnpm push`

## Rabbit holes / Não escopo

- Voltar dentro do formulário de liderança (grid ↔ form) — `onCancel` já cobre.
- `register-demand` fora da cadeia B98.

## Aceite de engenharia

- [x] Aceite de produto da intenção coberto
- [x] Invariantes AGENTS/engineering-standards
- [x] Testes unit em `wizardActionChain`
