# Impl: C243 — Seção da busca por selfie na homepage pública

Status: aprovado (decisão do dono na sessão, 2026-10-01)
Atualizado em: 2026-10-01
Issue: — (worktree `work/43`, sem claim)
Intenção: docs/plans/busca-selfie-secao-home.md
Design UI (gate): docs/plans/busca-selfie-secao-home-ui-design.html
Appetite restante: herdado (~0,5–1 dia eng) — uma seção condicional na home, sem engine.

## Leitura da intenção

- **Outcome:** visitante descobre a busca na home e chega a `/fotos/encontre`; fechada, a seção não aparece (sem CTA morto).
- **O que NÃO negociar:** sem captura/engine na home; sem promessa de "todas as fotos"/score; mobile-first; nada de fotos do acervo renderizadas na home; gate só com reads cacheados.

## Abordagem recomendada

**Opções consideradas (gate):** A) gating por `photoAlbum` cacheado (published + flag) + `hasPublishedArchivePhotos()` (também cacheado); B) leitura live dos Consents para o gate (mais exato, quebra a estaticidade/ISR da home).
**Recomendação:** **A** — a home mantém os reads cacheados; flag desligada já esconde a seção, e a combinação flag ligada + Consent ausente (misconfiguração) cai no estado fechado honesto da página de destino, nunca em 404 (a página `/fotos/encontre` existe nesse caso).
**Rejeitadas:** **B** porque uma leitura live de Consent por request transformaria a homepage (hoje estática com ISR por tags) em dinâmica sem ganho de segurança material — o servidor da busca é o gate real.

### Componentes / mudanças

- **`src/components/fotos/SelfieSearchHomeSection.tsx`** (novo): porta classe-a-classe de `docs/plans/busca-selfie-secao-home-ui-design.html`; título, explicação curta (selfie não sai do aparelho; acervo aprovado; saída do índice) e CTAs (`Encontre você nas fotos` → `/fotos/encontre`; link secundário `Ver o álbum` → `/fotos`).
- **`src/app/(frontend)/(home)/page.tsx`**: somar `photoAlbum` (via `getCachedGlobal`) ao `Promise.all`; renderizar a seção quando `published !== false && selfieSearchEnabled === true && showFotos` (mesmo `showFotos` já lido de `hasPublishedArchivePhotos`).
- **`src/components/fotos/SelfieSearchEntry.tsx`** (C242, ajuste de copy): atualizar o texto do escopo B quando o design estendido definir os literais.
- **Testes:** e2e da home (seção ausente com flag off/álbum fechado; presente com flag on + fotos aprovadas; CTA leva à página da busca) no spec existente de fotos/selfie ou no de frontend, seguindo o manifest curado; unit de gating se extrair predicado puro.
- **Docs:** changelog conjunto C242/C243; `AGENTS-public.md` ganha a seção.

## Checklist

- [ ] Design hi-fi aprovado (agente `designer`) gravado no disco
- [ ] Componente + composição na home + gating
- [ ] Copy da entrada `/fotos` alinhada ao escopo B
- [ ] Testes (unit/e2e) e manifest
- [ ] Docs/changelog
