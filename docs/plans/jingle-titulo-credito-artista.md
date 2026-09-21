# Card de jingle — título completo e crédito "(feat. …)" visível (S26)

Status: rascunho
Atualizado em: 2026-09-21
Issue: #1240
Priority: P2
Impeccable: B — encaixe fino no card de jingle existente (home + `/jingles`), sem redesenhar a seção
Design UI: docs/plans/jingle-titulo-credito-artista-ui-design.html
Appetite: ~0,5 dia eng; um outcome verificável — o título não corta e o crédito do artista aparece no card
Responsável: —

## Intenção

Os jingles oficiais são de Jorge Solla 1313 **com** artistas convidados, e o card não conta isso. Em produção o título chega como `Jorge Solla 1313 (feat. Felipe Forrozeiro)`, mas o card impõe uma única linha com reticências e o nome do parceiro some: lê-se `Jorge Solla 1313 (fe…`. O mesmo acontece com Nagib Barroso e É O MT. Crédito de artista é reconhecimento devido a quem fez a música — e é informação de escolha: o militante procura e repassa "o jingle do fulano".

A decisão é de layout, não de dado: nenhum título publicado será reescrito. O `(feat. …)` passa a viver numa linha própria, em corpo menor, abaixo do título-base, que pode ocupar até duas linhas. O crédito não pode sumir em estado nenhum — parado ou tocando, na home ou em `/jingles` — e o card é o mesmo nos dois lugares.

## Persona e fluxo

- **Persona / contexto:** visitante/militante no celular, chegando pela home ou por `/jingles` (link no WhatsApp, busca); de perto, a assessoria que ouve e repassa o material.
- **Job principal:** identificar de relance o jingle e o artista que participa, sem que o nome do parceiro fique escondido atrás de reticências.
- **Fluxo desejado:** vê o card → lê o título completo (até 2 linhas) e, abaixo, o crédito `feat. <artista>` em corpo menor → toca/pausa (crédito continua lá) → baixa o MP3 com o nome de hoje.
- **Anti-goals de produto:** não vira ficha técnica nem discografia; não muda capa, áudio, slug, ordem, published ou download; não redesenha a seção de som nem o player da rádio (irmã S25); não cria dado novo de artista.

### Esboço de fluxo (B)

```text
[card na home ou /jingles]
→ título-base completo (até 2 linhas, sem esconder o crédito)
→ linha "feat. <artista>" em corpo menor — visível parado e tocando
→ play/pausa (um por vez) → Baixar MP3 (nome do arquivo inalterado)
```

### Design UI (B)

- Design UI (gate): `docs/plans/jingle-titulo-credito-artista-ui-design.html`
- Cenas exigidas: card a 390 (mobile) e 1280 (desktop), parado e tocando, com os 3 títulos reais; e o caso extremo de título-base longo (2+ linhas) provando que o crédito nunca é cortado. O artefato é a fonte de verdade do port; o tamanho exato da fonte do título-base e a cor de apoio do crédito ficam no design.

## Objetivo e aceite

- O título-base de cada jingle aparece por inteiro em até 2 linhas (nada de reticências antes do crédito), na home e em `/jingles`.
- O crédito `feat. <artista>` aparece sempre numa linha própria, em corpo menor e cor de apoio, nos estados parado e tocando, nas duas superfícies.
- O crédito nunca recebe `truncate`; se o título-base for longo, ele quebra — o crédito permanece legível.
- Os 3 títulos reais de produção ficam legíveis de ponta a ponta, com o artista creditado.
- Aria-labels continuam com o título completo (crédito incluso) no play/pausar, no progresso e no download; a linha do crédito é conteúdo real, não decoração.
- Nada do dado muda: títulos, capas, áudio, slug, ordem, published e o nome do arquivo baixado seguem exatamente como estão.
- Jingle sem `(feat. …)` (ex.: `Axé`) continua com o layout de hoje, agora sem truncamento.

## Dados (intenção)

- **Vou apresentar dados?** Não — N/A: esta fatia não apresenta métrica, agregado nem decisão de dados; o que se lê é o título já publicado.
- **Decisões desbloqueadas:** nenhuma — nenhum ator decide algo a partir de dado novo.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: nada de telemetria nova nem de superfície de dados; sem PII/Consent.

## Dados da decisão (literais)

- ID `S26`; slug `jingle-titulo-credito-artista`; tipo `feature`; Priority `P2`; Impeccable `B`.
- Design UI (gate): `docs/plans/jingle-titulo-credito-artista-ui-design.html`.
- Títulos reais em produção (verificados em `/jingles` de jorgesolla1313.com.br, 2026-09-21): `Jorge Solla 1313 (feat. Felipe Forrozeiro)`, `Jorge Solla 1313 (feat. Nagib Barroso)`, `Jorge Solla 1313 (feat. É O MT)`.
- Defeito literal: o card corta o título em 1 linha com `truncate` e o `(feat. …)` não aparece.
- Regra literal de exibição: separar o segmento `(feat. …)` do título **apenas na exibição** — o segmento vira a linha de crédito, o restante é o título-base; sem segmento, o card fica como hoje.
- Aria-labels preservam o título completo: `Tocar/Pausar jingle <título completo>`, `Progresso do jingle <título completo>`, `Baixar <título completo> em MP3`.
- Download inalterado (deriva do slug): `jorge-solla-1313-jingle-axe.mp3`, `jorge-solla-1313-jingle-forro.mp3`, `jorge-solla-1313-jingle-pagodao.mp3`.
- Sem schema/migration; sem editar conteúdo em produção; o mesmo card serve home (até 3 jingles) e `/jingles`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/jingles/JingleCards.tsx` — dono do card (heading `:191-193`, bloco play+texto `:178-203`, estados `:194-201`, aria-labels `:184/:208/:237`); `src/lib/jingle.ts` é a casa natural de uma função pura de quebra título/crédito (`toJingleViewModel` `:57-75`), se o executor preferir derivar no view model.
- **Precedente a olhar:** planos S21 `docs/plans/jingles-site-publico.md` (dono do card) e S22 `docs/plans/jingles-radio-homepage.md`; testes que pinam título/aria — `tests/unit/jingle.unit.spec.ts`, `tests/unit/jinglePlayer.unit.spec.tsx`, `tests/unit/jingleHomeSection.unit.spec.tsx`; e2e `tests/e2e/frontendJingles.e2e.spec.ts`.
- **Risco de acoplamento:** o card é único para home e `/jingles` (`JingleHomeSection.tsx:81` passa `headingLevel="h4"`) — corrigir no dono, sem twin; a home segue estática; não tocar no player da rádio (S25) nem no schema/`Jingle.ts`; grid `:143` e filename truncado `:242` ficam como estão.

## Dependências

- Nenhuma (S21/S22/S24 entregues; S25 é irmã, não pré-requisito).

## Fora de escopo

- Campo/relação de artista ou `feat` na collection `Jingle` — migration + reedição dos 3 registros (alternativa registrada; gatilho de revisita em Questões).
- Renomear/encurtar títulos, ou mexer em capa, áudio, slug, ordem e published no admin/produção.
- Redesenhar a seção de som, o grid de jingles ou o player da rádio (S25).
- Metadata/OG de `/jingles` (`page.tsx:56-57` usa título fixo) — não muda.
- Ajustar a descrição do campo `title` no admin (`Jingle.ts:48-50`, hoje "Nome curto … (ex.: Axé)") — curadoria futura, se a revisita do campo estruturado acontecer.

## Rabbit holes de produto

- **"Já que dá para separar, cria o campo do artista".** Se alguém "só completar": migration + curadoria dos títulos + risco de divergência entre título e campo. **Corte neste item:** layout apenas, extração na exibição; sucessor só com o gatilho de filtrar/ordenar por artista.
- **"Reescreve os títulos no admin para o card caber".** Se alguém "só completar": edita conteúdo publicado e mexe no que já foi distribuído. **Corte neste item:** não se toca no dado; quem se ajusta é o layout.
- **"Redesenha a seção para caber título grande".** Se alguém "só completar": vira reabertura do S21/S22/S24 e da home. **Corte neste item:** encaixe fino no card; grid, capa e player ficam.
- **"Aproveita e melhora a tipografia da seção inteira".** Se alguém "só completar": reabre o design das seções anteriores. **Corte neste item:** mudam só o heading do card e a linha de crédito.

## Questões em aberto (produto)

- **O crédito mora no título ou vira campo estruturado?** **Opções:** A) extrair `(feat. …)` na exibição, sem schema (recomendado) | B) campo `feat`/artista na collection com migration + reedição dos 3 títulos | C) manter tudo no título e só reduzir a fonte. **Recomendação:** A — resolve crédito e corte sem tocar em dado publicado; B fica como sucessora **se** surgir necessidade de filtrar/ordenar por artista ou de títulos curtos por ritmo (Axé/Forró/Pagodão), com gatilho explícito; C não garante que o crédito apareça. _(assumido — validar com produto no gate)_
- **A linha do crédito mantém os parênteses do título?** **Opções:** A) `(feat. Felipe Forrozeiro)` literal | B) `feat. Felipe Forrozeiro` sem parênteses, já que a linha própria sinaliza o crédito. **Recomendação:** B — mais limpo na segunda linha; o texto integral continua nos aria-labels. _(assumido — validar no gate, o design decide o rótulo final)_
- **Título sem crédito muda de layout?** **Opções:** sim (padronizar as duas linhas) | não (só sem truncar). **Recomendação:** não — ausência de `(feat. …)` não inventa linha nem muda o card de hoje; só deixa de cortar. _(assumido — validar no gate)_

## Referências

- Issue irmã S25 (player da rádio) — não é dependência; esta fatia não toca no player.
- Design UI (gate): `docs/plans/jingle-titulo-credito-artista-ui-design.html`.
- `src/components/jingles/JingleCards.tsx` — dono do card (heading, estados, aria-labels, download).
- `src/lib/jingle.ts` — derivados do título no view model, se a extração virar função pura.
- `src/components/jingles/JingleHomeSection.tsx` — home (headingLevel `h4`, até 3 jingles).
- `src/collections/Jingle.ts` — schema (não muda); descrição atual do campo em `:48-50`.
- Página em produção: `https://jorgesolla1313.com.br/jingles` (títulos reais verificados em 2026-09-21).
- `AGENTS.md` — convenções de identificadores/copy e "edite o dono, sem twin".
