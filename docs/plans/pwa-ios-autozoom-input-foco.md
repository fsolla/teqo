# PWA iOS: foco na omnibox de filtros aplica auto-zoom que não volta

Status: planejado (blocked — plano aguardando merge em main)
Atualizado em: 2026-08-09
Issue: #501
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (bug fix; restaura o comportamento esperado, sem redesenho)
Canvas UI: N/A — sem UI nova
Appetite: ~0,5–1 dia eng
Responsável: —

## Intenção

No PWA `/campanha` no iPhone: ao tocar na omnibox de filtros (ex. lista de Municípios), o Safari aproxima a tela no input; ao terminar de digitar, a tela fica nessa perspectiva aproximada, com as laterais do app cortadas — o usuário precisa perceber e desfazer o zoom na mão.

Causa conhecida e documentada: o Safari iOS aplica auto-zoom em qualquer input com font-size renderizado menor que 16px ao focar, e no PWA standalone nem sempre restaura a escala ao fechar o teclado. A omnibox das listas usa `text-sm` (14px) — abaixo do limiar. O mesmo vale para outros inputs do app (login, formulários, wizard), que podem reproduzir o mesmo comportamento.

## Persona e fluxo

- **Persona / contexto:** staff da campanha (coordinator/advisor) no campo, filtrando listas (`/campanha/municipios`, `/campanha/apoiadores`, `/campanha/liderancas`, etc.) no iPhone.
- **Job principal:** filtrar e seguir trabalhando, sem o app "desarrumar" a tela.
- **Fluxo desejado:** toca na omnibox → teclado abre → digita e escolhe filtro → teclado fecha → tela exatamente como estava, na mesma escala.
- **Anti-goals de produto:** não é redesenho da omnibox; não é "subir o texto para 16px no desktop".

## Objetivo e aceite

- Tocar na omnibox (e em qualquer input do PWA: login, filtros, formulários, wizard) não provoca zoom automático no iPhone.
- Após fechar o teclado, a página permanece na escala original — sem corte de laterais, sem "desfazer zoom" manual.
- No desktop e em telas maiores, a aparência dos inputs continua como hoje (a fonte maior vale só onde o trigger do iOS existe).
- Nenhuma mudança de layout/visual além do tamanho de fonte dos campos no mobile, quando necessária.

## Dados (intenção)

- **Vou apresentar dados?** Não — bug de interação; verificação visual no aparelho.
- **Decisões desbloqueadas:** nenhuma para o produto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `CampaignListOmnibox` (`src/components/campaign/shared/CampaignListOmnibox.tsx` — input `text-sm`; chassis compartilhado por todas as listas: `MunicipalityFilters`, `SupporterFilters`, `LeadershipFilters`, `TerritoryFilters`, `StateDeputyFilters`, `OrganizationFilters`, `CampaignUpdatesFilters`, `ActivityFilters`…); demais inputs dos formulários de `/campanha` (login, wizard de liderança, modais de criação) — o trigger é o mesmo, então o fix provavelmente é uma regra única para inputs do PWA no touch/mobile, não um ajuste campo a campo.
- **Precedente a olhar:** fixos externos documentados (West-Wind, t3code PR #1652, BookStack #5935) — padrão `16px no mobile, tamanho original no desktop` (`sm:` override) ou regra global de inputs.
- **Risco de acoplamento:** a omnibox é usada por ~8 listas com o mesmo chassis — mudança no componente compartilhado cobre todas de uma vez; não duplicar o fix por lista.

## Dependências

- Nenhuma dura. Suave: reduz a frequência do B182 (zoom preso) ao eliminar o trigger — podem ser executados em qualquer ordem.

## Fora de escopo

- Redesenho da omnibox ou das listas.
- Corrigir o estado "zoom preso" em si quando ele vier de outras fontes (isso é o B182).
- Inputs do site público (fora do PWA `/campanha`), salvo se reproduzirem e for trivial.

## Rabbit holes de produto

- **Caçar todos os inputs do app um a um.** O trigger é sistêmico (regra do iOS por font-size), então fix pontual por componente vira whack-a-mole. **Corte neste item:** regra única para inputs do PWA no mobile + verificação amostral (omnibox, login, um formulário), não inventário exaustivo.
- **Virar debate de acessibilidade de zoom global.** `maximum-scale=1` global resolve mas degrada; aqui a regra de 16px é suficiente e não bloqueia nada. **Corte:** sem política de escala global neste item (se precisar, vive no B182 como fallback).

## Questões em aberto (produto)

- ~~Aplicar 16px em todos os inputs ou só na omnibox?~~ **Decidido no gate (2026-08-09): todos de uma vez** — regra única para inputs do PWA no mobile/PWA (inclui `contenteditable`/select), cobrindo omnibox, login, formulários e wizard com o mesmo trigger.
- **O texto dos campos ficar maior no iPhone é aceitável?** **Opções:** A) sim, 16px é padrão de leitura em mobile; B) compensar visualmente com layout. **Recomendação:** A — 16px é o tamanho de input padrão no iOS; mudança perceptível mas coerente. _(assumido — validar com produto)_

## Referências

- GitHub Issue #501
- Pesquisa externa (reaproveitável pelo executor):
  - West-Wind (2023) — "Preventing iOS Textbox Auto Zooming": limiar 16px + `maximum-scale` seletivo como fallback
  - t3code PR #1652 — padrão `text-base` no mobile com `sm:` override para desktop
  - BookStack #5935 — zoom preso no PWA iOS ao editar texto; lista de workarounds
  - dev.to (cederhook, 2026-07) — contexto do viewport standalone preso pós-teclado (parente do B182)
- Código: `src/components/campaign/shared/CampaignListOmnibox.tsx` (input `text-sm`, linha ~225), formulários em `src/app/(campaign)/campanha/(app)/…` e `src/components/campaign/<domínio>/…`
