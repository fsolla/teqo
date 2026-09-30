# S42 — Home — seção da Central de Conteúdos: compartilhar a peça no card e filtro que abre /conteudos já filtrado

Status: rascunho
Atualizado em: 2026-09-29
Issue: #1391
Priority: P2
Impeccable: B — encaixe na seção S39 da home (ações no card existente)
Design UI: docs/plans/central-conteudos-secao-home-share-filtro-ui-design.html
Appetite: ~1–1,5 dias eng; um outcome verificável (a seção compartilha a peça e leva à Central já filtrada)
Responsável: —

## Intenção

A seção da Central de Conteúdos na home (S39) está no ar, mas hoje é só vitrine: o eleitor vê a peça do território dele, toca e cai em `/conteudos` para então compartilhar ou filtrar. Na reta final até 04/10, o dono pediu o atalho direto: compartilhar a peça **do card da seção**, tocar numa tag ou na **fileira de filtros da seção** e abrir a Central **já filtrada** naquele recorte. A seção deixa de ser só vitrine e vira atalho de circulação — ações no card existente mais uma fileira de filtros, sem virar uma segunda Central (nada filtra a amostra localmente).

Este item **reabre parcialmente** o corte do S39 "A seção vira uma mini-Central" (`docs/plans/central-conteudos-secao-home.md:98`): compartilhar no card e tags-atalho para o catálogo filtrado passam a valer por pedido explícito do dono; filtros, busca e download locais na seção continuam cortados. O restante do S39 (localização sem rastro, seleção município→região→recentes, fail-closed, 3 peças) fica intocado — a reabertura é registrada no mesmo molde do S39 sobre o D7 do S27.

## Persona e fluxo

- **Persona / contexto:** eleitor no celular que rola a home, reconhece a peça do município/região dele na seção da Central e está com o grupo de WhatsApp aberto — quer repassar sem sair da home e, se quiser mais, ver o recorte inteiro.
- **Job principal:** compartilhar a peça que acabou de ver em um toque e, quando quiser o resto, chegar em `/conteudos` já filtrado pelo mesmo recorte.
- **Fluxo desejado:** rola a home → vê a peça do território → toca em `Compartilhar` no card → a mesma folha de compartilhamento do catálogo abre com a mensagem de voto do tipo da peça → compartilha e continua na home. Ou: toca numa tag com faceta equivalente (`Do seu município`, `Da sua região`, `Vídeo`/`Áudio`/`Foto`/`Texto`, `⌖ Para seu município`) ou numa opção da **fileira de filtros da seção** (`Tipo`/`Cidade`/`Região`) → cai em `/conteudos` **já filtrada** naquele recorte → segue do catálogo (fluxo do S27).
- **Anti-goals de produto:** não é mini-Central — sem busca e sem nenhum filtro que filtre as 3 peças exibidas: tags e fileira apenas abrem `/conteudos` já filtrada; sem player próprio, sem download novo no card; sem segundo mecanismo de compartilhar (a folha é a do S27); sem rastreio novo — o compartilhar da home conta na mesma circulação por peça (C213); nada de localização nova, login, captura ou PII; `Ver esta peça →` e `Ver todas as peças →` intactos.

### Esboço de fluxo (B)

```text
[visitante na home] → seção da Central (S39, intocada)
→ card da peça do território
   ├─ toca em "Compartilhar" → abre a folha do S27 com a mensagem de voto do tipo
   │                            → compartilha → continua na home
   └─ toca numa tag com faceta equivalente → /conteudos já filtrado (?tipo | ?cidade | ?regiao)
       (tags sem faceta honesta: "Mais recente"/"Seleção recente"/origem de peça-link — estáticas)
→ fileira de filtros da seção (Tipo | Cidade | Região) → /conteudos já filtrado
   (a fileira NÃO filtra a amostra: nenhum estado local, nenhum resultado vazio na seção)
→ "Ver esta peça →" e "Ver todas as peças →" seguem como estão
[zero peça publicada] → a seção inteira some (fail-closed)
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-secao-home-share-filtro-ui-design.html` — cobre o card com `Compartilhar` + tags-link, a **fileira de filtros** (e o menu aberto), a folha de compartilhamento aberta a partir da home, foco/estado das affordances e a cena de peça única; cenas ~390 e ~1280.

## Objetivo e aceite

- **Compartilhar no card:** `Compartilhar` no card da seção abre a **mesma** folha do catálogo S27, com a mensagem de voto por tipo já contratada; o visitante não sai da home e o evento conta na mesma circulação por peça (C213).
- **Filtro direto (tags):** as affordances com faceta equivalente abrem `/conteudos` com o parâmetro canônico da URL (`tipo|cidade|regiao`) pelo construtor canônico (`buildContentPieceCatalogHref`), no recorte da tag; `Ver todas as peças →` continua abrindo a Central sem filtro.
- **Fileira de filtros da seção:** a seção ganha uma fileira com as facetas canônicas `Tipo` | `Cidade` | `Região` (mesmo vocabulário do catálogo) e cada opção abre `/conteudos` já filtrada; a fileira **não** filtra a amostra localmente (sem estado de filtro, sem resultado vazio na seção).
- Tags sem faceta honesta (`Mais recente`, `Seleção recente`, origem de peça-link) permanecem **estáticas**.
- Sem peça publicada, a seção inteira some (fail-closed) — kill switch intacto.
- A seção continua sem login, sem PII e sem localização persistida; nenhuma solicitação de localização nova.
- Demais seções da home e a própria `/conteudos` intocadas; sem overflow horizontal novo nos dois breakpoints.

## Dados (intenção)

- **Dados: N/A** — nenhum número, contagem, ranking ou série nova na superfície; a contagem de compartilhamento é o contador anônimo já existente do C213 por peça, alimentado pela própria folha. Nenhum dado novo do visitante é coletado, guardado ou exibido.

## Dados da decisão (literais)

- Item `S42`; slug `central-conteudos-secao-home-share-filtro`; tipo `feature`; Priority `P2`; Impeccable `B`.
- **Supersessão parcial:** rabbit hole "A seção vira uma mini-Central" do S39 (`docs/plans/central-conteudos-secao-home.md:98`) — reabre só compartilhar-no-card e tags-atalho para `/conteudos` filtrado; filtros/busca/download locais seguem cortados; restante do S39 intocado.
- Mapeamento affordance → faceta canônica:
  - `Do seu município` → `?cidade=<slug do label>`
  - `Da sua região` → `?regiao=<slug>`
  - tag de tipo (`Vídeo`/`Áudio`/`Foto`/`Texto`) → `?tipo=<enum>`
  - tag da seção `⌖ Para seu município` → `?cidade=<slug do município do visitante>`
  - fileira de filtros da seção: facetas `Tipo` | `Cidade` | `Região` (rótulos do catálogo), cada opção → `/conteudos` já filtrada; sem filtro local
  - `Mais recente` / `Seleção recente` / origem de peça-link (`Instagram`/`YouTube`) → estáticas
- Copy: `Compartilhar` (mesma do catálogo S27), com `aria-label` `Compartilhar <título>`.
- Intocados: `Ver esta peça →` e `Ver todas as peças →`; sem download no card; sem busca local; sem solicitação de localização nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:** wrapper server `src/components/conteudos/ContentPieceHomeSection.tsx:12-34`; board client `ContentPieceHomeBoard.tsx` (estado `:66-71`, card `:217-226`, CTAs `:202-207` e `:229-242`); card `ContentPieceHomeCard.tsx` (tags `:58-63`, link `:66-74`); montagem em `src/app/(frontend)/(home)/page.tsx:257`.
- **Precedente a olhar:** folha do S27 (`ContentPieceShareSheet.tsx:31-193`) com estado de share no catálogo (`ContentPieceCatalog.tsx:36-37,86-88`); construtor canônico de URL e facetas (`src/lib/contentPieceCatalog.ts:55-73,131-151`, cidade/região `slugify(label)` `:222-224`); o S4 (`ContentShareButton.tsx:44` em `CampaignContentCard.tsx:86`) é precedente visual de OUTRO dono (seção S3) — não duplicar.
- **Risco de acoplamento:** o item lean da home (`ContentPieceHomeItem`, `src/lib/contentPieceHomeSelection.ts:25-43`) não carrega `sourceUrl` (usado por `src/lib/contentPieceShare.ts`) — projetar/estreitar a prop é decisão do plano de implementação; a intenção exige reusar o MESMO mecanismo. Não editar a home além da seção nem o manifesto de e2e.

## Dependências

- S39 entregue (#1305) — sem a seção não há o que estender.
- Design hi-fi aprovado no gate.

## Fora de escopo

- Busca/filtro que filtrem a própria amostra (mini-Central local) — item próprio, se houver pedido.
- Novos canais de compartilhamento além da folha S27; download no card.
- Tema/liderança/instituição como affordance na seção; mudar `/conteudos` ou o catálogo; tocar a seção S3/`CampaignContentSection`; analytics novo; qualquer mudança de localização/Consent.

## Rabbit holes de produto

- **"Já que tem atalho, filtra a amostra aqui mesmo".** Se alguém "só completar": a seção guarda estado de filtro, esconde cards e inventa um resultado vazio local. **Corte neste item:** tags e fileira só montam a URL da Central; os 3 cards da amostra nunca são filtrados na seção.
- **"Faz um botão de share próprio do card".** Se alguém "só completar": nascem dois mecanismos de compartilhar com mensagens divergentes. **Corte neste item:** a folha do S27 é o único mecanismo; o card só a abre.
- **"Toda tag vira link".** Se alguém "só completar": tags sem faceta (origem, "Mais recente") viram link para lugar nenhum ou busca improvisada. **Corte:** só tag com faceta canônica vira filtro; o resto fica estático.
- **"Aproveita e baixa também".** Se alguém "só completar": download no card puxa mídia pesada para a home. **Corte:** download só no catálogo/página da peça (S27).

## Questões em aberto (produto)

- **Quais affordances viram filtro na v1?** **Decidido no gate:** **B** — tags com faceta honesta **e** fileira de filtros própria da seção (`Tipo` | `Cidade` | `Região`), ambas abrindo `/conteudos` já filtrada; nenhum filtro local. _(decidido — humano, gate 2026-09-29)_
- **Incluir chip de tema no card?** **Decidido no gate:** **A** — não nesta v1 (o card fica com 2 tags + `Compartilhar` + CTA; tema vive no catálogo). _(decidido — humano, gate 2026-09-29)_
- **O compartilhar da home entra na contagem C213 existente?** **Decidido no gate:** **A** — sim, mesmo mecanismo/contador por peça; sem rastreio novo. _(decidido — humano, gate 2026-09-29)_

## Referências

- GitHub Issue: #1391.
- Design UI (gate): `docs/plans/central-conteudos-secao-home-share-filtro-ui-design.html` (+ assets em `central-conteudos-secao-home-share-filtro-ui-design-assets/`).
- `docs/plans/central-conteudos-secao-home.md` (S39 — supersessão na linha 98) e `central-conteudos-secao-home-ui-design.html`; `docs/plans/central-conteudos-publica.md` (S27).
- `src/components/conteudos/ContentPieceHomeSection.tsx`, `ContentPieceHomeBoard.tsx`, `ContentPieceHomeCard.tsx`, `ContentPieceShareSheet.tsx`, `ContentPieceCatalog.tsx`; `src/lib/contentPieceCatalog.ts`, `src/lib/contentPieceHomeSelection.ts`; `src/app/(frontend)/(home)/page.tsx`.
- Testes: `tests/unit/contentPieceHomeBoard.unit.spec.tsx`, `tests/unit/contentPieceHomeSelection.unit.spec.ts`, `tests/e2e/frontendConteudos.e2e.spec.ts`, `scripts/lib/e2e-affected-manifest.mjs`.
- `AGENTS-public.md` — convenções do site público (cache, kill switch, mídia).

## Self-score (shaping)

1. Fatia = um outcome verificável? 5/5 — a seção compartilha a peça e leva à Central já filtrada (tags + fileira), ambos observáveis no card/seção.
2. Appetite declarado e a intenção cabe nele? 4/5 — ~1–1,5 dias cabe porque reusa folha e URL canônica existentes; a fileira de filtros é o delta.
3. Persona + job + aceite claros (sem jargão de stack)? 5/5 — fluxo só em linguagem de eleitor.
4. Direção no codebase é hipótese (não contrato técnico)? 5/5 — arquivos/linhas são pista do estado atual, não prescrição.
5. Zero decisões duras de engenharia no plano? 4/5 — projeção de `sourceUrl` para a folha e formato das affordances ficam para o plano de implementação.

Média: 4,6/5 — ≥4/5.
