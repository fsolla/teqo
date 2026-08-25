# Impl: Ratchet de bypass endurecido (P6-1)

Status: aprovado
Atualizado em: 2026-08-25
Issue: —
Intenção: docs/plans/entrega-engenharia-p6.md
Appetite restante: herdado (guarda classe 3, spec única — entrega S)

## Leitura da intenção

- **Outcome:** Comentário de módulo (header) não zera mais o arquivo — bypass só conta como documentado com comentário per-site; arquivos novos entram pinados na contagem atual; zero mudança de runtime.
- **O que NÃO negociar:** nenhuma mudança de comportamento, sem migration, sem dependências novas; o ratchet continua só-diminui (pins = contagem medida hoje, nunca arredondada para baixo).
- **O que reavaliar:** a premissa "arquivos novos invisíveis" — medida: a invisibilidade vem do header rule, não do mapa; o walk já cobre todo `src/` e `pinnedUndocumented.get(path) ?? 0` já faz arquivo sem pin com N indocumentados falhar. O bug é o header zerar a contagem.

## Abordagem recomendada

**Opções consideradas:** A | B | C
**Recomendação:** A — remover o zero-by-header em `countUndocumented` (mantendo a janela de 10 linhas per-site) e pinar os arquivos recém-visíveis na contagem medida. Delta mínimo que satisfaz (a)/(b)/(c).
**Rejeitadas:** B — apertar para "comentário contíguo imediatamente acima": rederrata ~64 arquivos, exige SUBIR pins de ~30 arquivos já pinados, violando o espírito só-diminui. C — migrar o pin map para snapshot JSON commitado: cerimônia nova sem ganho.

### Componentes / mudanças

- **`countUndocumented`** (`tests/unit/codebaseConventions.unit.spec.ts:691-704`): deletar o cálculo de `header` (linha 693) e a condição `!header.includes('bypass')` (linha 701). Documentado ⇔ `context` (10 linhas acima) contém "bypass". Atualizar a prosa do describe.
- **`pinnedUndocumented`** (648-689): adicionar pins P6-1 (comentário "P6-1 baseline"), valores = contagem per-site medida na fase 1 (o RED da fase 1 é a medição — colar os números que o RED reportar). Os pins existentes NÃO mudam se per-site == pin atual.
- **Migration:** sem migration. **Access/Consent:** nenhuma — guard-only. **UI:** N/A.

## Fases verificáveis

1. **Hardening do contador** — remover o header rule + atualizar a prosa; rodar o spec: `pnpm test:unit -- codebaseConventions` (bare). Esperado: RED nos arquivos recém-visíveis (`N undocumented (pin: 0)`). Negative check opcional: criar `src/utilities/__bypassProbe.ts` com 1 `overrideAccess: true` sem comentário → spec falha → deletar o probe.
2. **Pinning** — adicionar os pins medidos na fase 1; spec GREEN.
3. **Gates** — `pnpm gate:fast`; push via `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- **Comentários per-site nos piores arquivos** (`personDelete.ts`, `notification/*`, `Consent.ts`, `loadNamesByIds.ts`) — FORA de escopo deste pass; os pins os cobrem e o ratchet bloqueia crescimento.
- Apertar a janela para comentário contíguo (Opção B); re-justificar bypasses; mexer no `localApiOverrideAccessConventions.unit.spec.ts`.

## Riscos e mitigação

- Contagem medida pelo RED da fase 1 (não estimativa); nenhum pin abaixo do medido — fase 2 confere GREEN.
- O probe negativo é temporário e deletado na mesma fase.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (guard hardening, runtime intocado)
- [x] Invariantes AGENTS/engineering-standards (sem migration, sem deps, sem twin)
- [x] Testes de domínio: a spec É o teste — RED sem hardening (fase 1), GREEN com (fase 2)

Self-score decision-quality: 5/5
