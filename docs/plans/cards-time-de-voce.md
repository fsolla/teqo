# Card "Time de você": quarto modelo auto-serviço no funil público

Status: registrado (aguardando plano em main)
Atualizado em: 2026-09-18
Issue: #1161
Priority: P1
Impeccable: C — modelo novo num funil público existente (não é superfície nova)
Design UI: docs/plans/cards-time-de-voce-ui-design.html
Appetite: ~2–3 dias eng; um quarto modelo verificável no funil já entregue, sem fluxo novo
Responsável: —

## Intenção

O funil de cards do site (seção `#cards` da home + `/cards`, S13/#941, ajustado em S14/#959) tem três modelos — um de nome e dois de foto. Falta o card que mais circula na militância: a pessoa entra no "time" com a própria cara. O visitante digita o nome, envia uma foto de busto, o fundo é removido no próprio aparelho (nada é enviado) e o card `TIME DE <NOME>` fica pronto para baixar, com os candidatos ao fundo, a foto recortada no centro e os banners no topo.

É a continuação natural do funil — S13 excluía "remoção de fundo" e "novos modelos" do escopo. Não é superfície nova: quarto item do catálogo, mesmo editor, mesma promessa de privacidade.

## Persona e fluxo

- **Persona / contexto:** visitante/militante no celular, quer mostrar que entrou no time do Solla; tem uma foto de busto razoável na galeria.
- **Job principal:** virar `TIME DE <NOME>` em um card oficial sem instalar nada, sem criar conta e sem enviar a foto para ninguém.
- **Fluxo desejado:** vê o quarto modelo na home ou em `/cards` → escolhe `Time de você` → digita o nome → escolhe uma foto de busto → vê o recorte acontecer com progresso no aparelho → confere a prévia (auto-enquadrada; arrastar/zoom como escape) → baixa o PNG.
- **Anti-goals de produto:** editor gráfico/máscara manual, cadastro, galeria pública, analytics de PII, promessa de recorte perfeito, segundo editor.

### Esboço de fluxo (C)

```text
[home/#cards ou /cards] → [modelo "Time de você"] → [nome + foto de busto]
→ [remoção de fundo local: progresso | erro + retry] → [prévia auto-enquadrada + ajuste opcional]
→ [card pronto] → [baixar PNG]
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-time-de-voce-ui-design.html`
- Cenas: tile do quarto modelo na galeria, estados de processamento/erro do recorte, prévia com a geometria final e resultado, em desktop e mobile.

## Objetivo e aceite

- O funil ganha o quarto modelo, `Time de você`, ao lado dos três atuais; home e `/cards` continuam um único editor e um único fluxo.
- O visitante digita o nome e escolhe uma foto de busto; o card final estampa `TIME DE <NOME>` nos banners do topo (nome em caixa alta) e a foto recortada no centro, sobre o fundo oficial com céu e candidatos.
- A remoção de fundo acontece no aparelho: nenhum byte da foto é enviado; a nota de privacidade do funil segue visível no novo modelo.
- Durante o recorte a pessoa vê progresso; se falhar, vê um erro claro com opção de tentar de novo e não fica presa.
- A foto entra auto-enquadrada (topo do recorte encostado no topo do espaço previsto, centrada), com os controles de arrastar/zoom já existentes como ajuste opcional.
- Nome em uma linha: se não couber no menor tamanho legível, a pessoa é pedida a usar um nome mais curto (mesma mensagem do modelo de nome) — nunca corte silencioso.
- Fidelidade ao exemplo de referência: posições, rotações, cores e corpo do nome seguem o literal medido; arte-mestre intocada (compor por cima, nunca redesenhar).
- `/cards` e o link com modelo pré-selecionado (`?model=time-de-voce`) continuam funcionando.
- Escolha de foto, retry do recorte e download funcionam por toque e teclado.
- A expectativa é honesta: o pedido é foto de busto com fundo simples — sem prometer recorte perfeito.
- Sem conta, cadastro ou analytics de PII; o nome e a imagem final nunca saem do aparelho.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — nenhuma métrica é apresentada; não há decisão operacional desbloqueada por dado.
- **Forma:** _adiada ao plano de implementação_ — nome e foto são insumos locais da imagem; nenhum conteúdo pessoal entra em analytics.

## Dados da decisão (literais)

- ID `S15`; tipo `feature`; Priority `P1`; Model `composer-2.5`; Impeccable `C — modelo novo num funil público existente (não é superfície nova)`; Design UI: `docs/plans/cards-time-de-voce-ui-design.html`.
- Slug do plano: `cards-time-de-voce` (arquivo `docs/plans/cards-time-de-voce.md`).
- Model id `time-de-voce`; label de galeria `Time de você`; texto do card `TIME DE <NOME>` (nome normalizado em CAIXA ALTA pelo pipeline existente `normalizeCardName`).
- Assets commitados com o plano em `public/cards/`: `team-card-base.png` (fundo céu+candidatos, 1080×1440, ~1,5 MB), `team-card-front.png` (overlay marca/faixa, 1080×1440 RGBA, ~86 KB), `team-card-example.jpg` (exemplo final p/ tile da galeria, 1080×1440, ~268 KB).
- Ordem de composição: base → foto do usuário (fundo removido) → overlay frontal → textos do topo.
- Slot da foto (silhueta-placeholder do exemplo): x=286, y=439, largura=592, altura=577; auto-enquadramento cobrindo o slot, ancorado no topo e centrado (bbox alfa do recorte).
- Banner "TIME DE" (vermelho): centro ≈ (545, 162), ≈ 693×118, rotação ≈ −3,5°, fill `#E50E2F`; texto "TIME DE" centralizado, Brexter 700, cap ≈ 93 px, fill `#FFEC01`.
- Banner do nome (azul): centro ≈ (545, 313), ≈ 509×176, rotação ≈ −4,1°, fill `#0061A5`; nome centralizado, Brexter 700, cap ≈ 130 px, tinta máxima ≈ 470 px, 1 linha, cap mínimo ≈ 56 px, fill `#FFFFFF`.
- Cores literais: vermelho `#E50E2F`, amarelo `#FFEC01`, azul `#0061A5`, branco `#FFFFFF`.
- Copy: a página `/cards` e a dica da galeria hoje dizem "três modelos" → viram "quatro modelos" (o título/eyebrow da home não mudam). A nota de privacidade do funil continua valendo (`CARD_PRIVACY_NOTE`/`CARD_PHOTO_PRIVACY_NOTE`) e a remoção de fundo é 100% local.
- Motor de remoção de fundo: roda no navegador, sem upload da foto; recomendação `@imgly/background-removal` (mesma família do `@imgly/background-removal-node` já usado em `scripts/resize-images.mjs --remove-bg`), modelo pequeno (`isnet_quint8`, ~40 MB na 1ª vez, cacheado), carregado sob demanda SÓ quando o modelo time é escolhido, com estados de progresso/erro/retry. Alternativa mais leve (menor qualidade de borda): MediaPipe selfie segmenter (~250 KB, Apache-2.0). A escolha final do motor fica para o plano de implementação, mas o aceite exige: nenhum byte da foto sai do aparelho.
- Foto: auto-enquadrada (sem exigir ajuste), mas recomenda-se manter os controles de arrastar/zoom dos modelos de foto existentes como escape. Nome: 1 linha; se não couber no cap mínimo, erro pedindo nome mais curto (mesma mensagem do modelo de nome).

## Direção no codebase (hipótese)

- **Áreas prováveis:** catálogo `src/lib/cardModels.ts`, roteiro/render `src/lib/cardRender.ts`, fit `src/lib/cardNameFit.ts`, transform `src/lib/cardPhotoTransform.ts`, componentes `src/components/cards/`, página `src/app/(frontend)/(home)/cards/page.tsx`, seção `CampaignCardsSection.tsx`, assets `public/cards/`.
- **Precedente a olhar:** S13/S14 (`docs/plans/cards-personalizados-campanha-impl.md`, `docs/plans/cards-personalizados-ajustes.md`); `scripts/resize-images.mjs --remove-bg` para o motor; c167 (ffmpeg.wasm rejeitado por peso + COOP/COEP global que quebraria embed do YouTube).
- **Risco de acoplamento:** o composer carrega UMA imagem base e ramifica por `kind`; o roteiro não tem save/rotate/translate; os testes pinam os 3 ids (`tests/unit/cardModels.unit.spec.ts`) e o e2e (~:1694–1821) falha em qualquer console error e não cobre WASM; o motor deve funcionar SEM COOP/COEP (single-thread).

## Dependências

- S13 (#941) e S14 (#959) entregues; assets do quarto modelo já em `public/cards/`, commitados com o plano.

## Fora de escopo

- Modelos adicionais, CMS de modelos, métricas de uso.
- Compartilhamento direto em redes sociais.
- Recorte perfeito: cabelo fino, fundo complexo, várias pessoas, máscara manual (pincel/borracha).
- Conta, cadastro, persistência de nome/foto/arte gerada.
- Qualquer envio (mesmo parcial) da foto, ou processamento no servidor.
- Alterar as artes-mestre ou redesenhar home/`/cards`.

## Rabbit holes de produto

- **Motor "melhor" a qualquer custo.** Se alguém "só completar": entra uma dependência pesada ou headers globais que quebram o embed do YouTube (precedente c167). **Corte neste item:** motor sob demanda, sem COOP/COEP, carregado só se o modelo time for escolhido.
- **Prometer recorte perfeito.** Se alguém "só completar": vira editor de máscara com pincel e correção manual. **Corte neste item:** foto de busto com fundo simples, auto-recorte + retry.
- **Auto-enquadramento virar editor.** Se alguém "só completar": nasce um passo obrigatório de posicionamento. **Corte neste item:** auto + controles existentes como escape.
- **Segundo editor/segundo fluxo.** Se alguém "só completar": a home ganha compositor próprio e os comportamentos divergem. **Corte neste item:** o mesmo compositor de `/cards`.
- **Medir fidelidade "no olho".** Se alguém "só completar": aproximação visual vira critério. **Corte neste item:** geometria literal medida no exemplo (seção Dados da decisão).

## Questões em aberto (produto)

- **Qual motor de remoção de fundo?** **Opções:** `@imgly/background-removal` no navegador (borda melhor; ~40 MB na 1ª vez, cacheado; licença AGPL — self-host vs CDN a decidir na implementação) | MediaPipe selfie segmenter (~250 KB, Apache-2.0, borda mais fraca). **Recomendação:** `@imgly/background-removal`, com a ressalva AGPL a resolver na implementação. _(assumido — validar com produto)_
- **Auto-enquadramento puro ou com ajuste manual?** **Opções:** auto puro | auto + controles existentes. **Recomendação:** auto + controles existentes como escape. _(assumido — validar com produto)_
- **Qual rótulo do modelo na galeria?** **Opções:** `Time de você` | `Entre para o time`. **Recomendação:** `Time de você`. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1161
- Design UI (gate): `docs/plans/cards-time-de-voce-ui-design.html` (+ assets em `cards-time-de-voce-ui-design-assets/`)
- `public/cards/team-card-example.jpg` — referência visual final do card
- `docs/plans/cards-personalizados-campanha.md` e `cards-personalizados-campanha-impl.md`; `docs/plans/cards-personalizados-ajustes.md`
- `src/lib/cardModels.ts`, `src/components/cards/CardComposer.tsx`, `src/app/(frontend)/(home)/cards/page.tsx`
- `AGENTS.md` e `AGENTS-public.md`
