# B170 — Follow-up B169: contrato do colapso de chips + shift único no load SSR

Status: rascunho
Atualizado em: 2026-08-08
Issue: #441
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — engenharia (teste de contrato + resíduo de first-paint), sem mudança de superfície
Appetite: ~0,5–1 dia eng
Responsável: —

## Intenção

Follow-up do B169 (#425, entregue). Duas lacunas registradas na triage de débitos daquela entrega, na mesma superfície (`RelationChipCell` / listas de chips de `/campanha`):

1. **Contrato do colapso sem teste** — nenhum spec cobre "Ver mais…"/"Ver menos"/`visibleChipCount` parcial com layout real (specs atuais usam `measureOverflow: false` ou colapsam para 1 chip). A mudança de timing do B169 (medição em `useLayoutEffect`) não tem regressão unitária do comportamento de colapso.
2. **Shift único no load SSR** — `useLayoutEffect` elimina a onda de LayoutShift nas navegações client-side (caso dominante), mas o carregamento inicial (SSR) ainda pinta o estado medindo (todos os chips, clamp `max-h-18`, ~1122px) antes da hidratação e só então colapsa (~682px) — um LayoutShift único pré-hidratação.

## Objetivo e aceite

- F1: um spec unitário pinando o contrato do colapso (recolher para N chips/3 linhas, "Ver mais…" expande, "Ver menos" recolhe) com `getBoundingClientRect` stubado para múltiplos chips.
- F2: avaliar e, se possível, eliminar o shift único do load SSR, **sem** reintroduzir a estimativa de largura por label (razão da rejeição na entrega B169: o dono mede layout real de propósito).
- Sem mudança de layout, regra de colapso (3 linhas), dados, access ou schema.

## Direção no codebase

- F1: `tests/unit/` — spec que renderiza `RelationChipCell` (ou wrapper) com > N chips e `Element.prototype.getBoundingClientRect` stubado (precedente: stubs de `scrollIntoView`/`ResizeObserver` nos specs existentes).
- F2: `src/components/campaign/shared/RelationChipCell.tsx` — única alternativa ao `useLayoutEffect` atual seria o servidor conhecer o slice antes da paint; caminho barato a investigar primeiro: garantir que o estado SSR inicial use o clamp de 3 linhas de forma **estável** (sem ondulação por célula), não a estimativa de largura.

## Rabbit holes / Não escopo

- Redesign das células de chips ou da tabela (anti-goal já travado).
- Outras fontes de deslocamento de layout na shell (sidebar, Sollinha, agenda).
- Migrations, dados, access.

## Dependências

- `depends: [425]` — destrava quando o B169 flipar done (Issue #441 nasceu blocked; `pnpm agent:ready -- --issue 441` após o plano chegar a main).

## Questões em aberto

- O shift único do load (0,13–0,26) é aceitável em produção? Se sim, F2 vira só o teste de contrato e o shift documentado no CHANGELOG (com medição). Validar com medição no browser; sem evidência de impacto, F2 é defer.
