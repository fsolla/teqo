# Card "Time de você": harmonizar as cores da foto do visitante com o time

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1196
Priority: P2
Impeccable: C — novo controle em estados já existentes de um funil público
Design UI: docs/plans/cards-time-de-voce-harmonizar-cores-ui-design.html
Appetite: ~0,5–1 dia eng; um toggle que deixa a foto do visitante com o tom do time
Responsável: —

## Intenção

O "Time de você" (S15, #1161, entregue em 2026-09-18) deixou o visitante entrar no card com a própria cara — mas quase sempre com uma selfie de celular ao lado de candidatos fotografados por profissional. O recorte fica bom e a foto ainda assim "destoa" do resto: luz mais quente ou fria, contraste e saturação em outra faixa. O pedido do humano foi literal: **"Seria possivel fazer automaticamente algum balanceamento de cores na foto do usuario para encaixar melhor com as fotos dos candidatos que são profissionais? Talvez possa ser um 'filtro' ativavel ou não, um toggle que o usuario seleciona ou não."**

A S15 listou "correção automática de foto" como rabbit hole e não a entregou; agora o humano pede isso de propósito. É item **novo** (S15 não é editado), com escopo pequeno e explícito: um toggle que ajusta a foto, não um editor.

## Persona e fluxo

- **Persona / contexto:** militante no celular, escolheu uma selfie razoável; vê a prévia e sente que a foto "não parece do time" ao lado dos candidatos.
- **Job principal:** o card ficar harmônico sem virar edição de imagem e sem perder a cara dele.
- **Fluxo desejado:** foto recortada e prévia prontas → vê o controle "Harmonizar cores" ligado por padrão → desliga e a foto original volta na hora → baixa o PNG com a escolha que deixou na tela.
- **Anti-goals de produto:** editor de imagem (slider de cor/curvas/presets), filtro "instagramável", promessa de "parecer profissional", retoque de pele, alterar os 3 modelos existentes, upload/serviço/rede, analytics, persistência, segundo fluxo.

### Esboço de fluxo (C)

```text
[estado pronto do Time de você] → [controle "Harmonizar cores" LIGADO por padrão]
→ [desligar = foto original | religar] → [PNG com a escolha atual]
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-time-de-voce-harmonizar-cores-ui-design.html` — cenas: controle no estado pronto (ligado/desligado), prévia antes/depois e card baixado, desktop e mobile.
- `Design tier: DEGRADED` — o frontier `openai/gpt-5.6-sol` bateu quota; o artefato saiu do `designer-degraded` e **não certifica**: exige sign-off humano no gate/PR.

## Objetivo e aceite

- No estado em que a foto já está pronta, o visitante vê "Harmonizar cores" com ajuda curta em pt-BR; funciona por toque e teclado (alvo ≥44px).
- Padrão ligado: a prévia abre harmonizada; desligar devolve a foto original instantaneamente e religar reaplica.
- A escolha vale para a prévia e para o PNG baixado; nada é persistido — sair e voltar volta ao padrão ligado.
- O ajuste é automático, suave e limitado ao tom das fotos oficiais dos candidatos (referência: arte-mestre `public/cards/team-card-base.png`); não é retoque de beleza (nada de pele, forma ou imperfeições) e nunca altera o recorte.
- 100% no aparelho: sem upload, sem analytics de PII, sem nova dependência de rede; vale só para `time-de-voce` (os 3 modelos existentes intocados).
- A nota de privacidade existente (`CARD_PRIVACY_NOTE`/`CARD_PHOTO_PRIVACY_NOTE`) continua visível e verdadeira.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — nenhum dado novo é apresentado; a escolha do toggle é local e não gera métrica.
- **Forma:** _adiada ao plano de implementação_ — medir "quantos ligam" seria analytics de interação, fora deste item.

## Dados da decisão (literais)

- ID `S17`; slug `cards-time-de-voce-harmonizar-cores` (arquivo `docs/plans/cards-time-de-voce-harmonizar-cores.md`); tipo `feature`; Priority `P2`; Impeccable `C — novo controle em estados já existentes de um funil público`; Design UI `docs/plans/cards-time-de-voce-harmonizar-cores-ui-design.html`.
- Rótulo do controle: `Harmonizar cores`; ajuda curta em pt-BR (ex.: "Ajusta o brilho e as cores da sua foto para combinar com as fotos do card.").
- Padrão LIGADO; desligar devolve a foto original instantaneamente; a escolha vale para a prévia e para o PNG baixado; nada é persistido.
- Ajuste automático, suave e limitado: aproxima brilho, contraste e saturação da foto do visitante do tom das fotos oficiais dos candidatos; referência: arte-mestre `public/cards/team-card-base.png`; não é retoque de beleza (sem suavizar pele, sem mudar forma, sem remover imperfeições); nunca altera o recorte.
- 100% no aparelho, sem upload, sem analytics de PII, sem nova dependência de rede; vale só para o modelo `time-de-voce` (os 3 modelos existentes intocados).
- Sem pin de modelo de execução (roda no modelo padrão da sessão; provider `openai` é reservado ao design).
- A nota de privacidade existente continua visível e verdadeira (o ajuste não muda o que ela promete).

## Direção no codebase (hipótese)

- **Áreas prováveis:** processamento de pixel local no recorte (`src/components/cards/cardCutout.ts`/`useCardCutout.ts`) ou no render puro (`src/lib/cardRender.ts`), via contexto estrutural; estado do toggle no `CardComposer.tsx` (controles do estado pronto).
- **Precedente a olhar:** `src/components/CampaignNewsletterForm.tsx` (forms/controles) e tokens do tema `campaign-site` em `src/app/(frontend)/styles.css` (`--pt-red`, `--campaign-line`, `--campaign-ink`, `--campaign-muted`, `--field-border`, `--team-blue`); `src/components/ui` não tem shadcn Switch — o app usa radix `Toggle`/`Checkbox` e botões `aria-pressed`.
- **Risco de acoplamento:** o recorte (`composeCutout`/máscara) não pode ser alterado; os 3 modelos existentes não podem mudar; sem rede/dependência nova; testes de unidade (se o ajuste nascer no recorte, specs próprios; sempre `cardRender.unit.spec.ts`) e e2e `tests/e2e/frontend.e2e.spec.ts` (describe Time de você, stub do motor via `NEXT_PUBLIC_CARDS_CUTOUT_STUB=1`) — o e2e falha em qualquer console error.

## Dependências

- S15 (#1161) entregue em 2026-09-18 — é o fluxo onde o controle entra.
- Sem dependência dura de S16/S18.

## Fora de escopo

- Editor de imagem: slider de cor, curvas, presets, ajuste manual.
- Filtro "instagramável", promessa de "parecer profissional" e retoque de beleza (pele, forma, imperfeições).
- Alterar os 3 modelos existentes ou as artes-mestre.
- Upload/serviço/rede, analytics, persistência, segundo fluxo.

## Rabbit holes de produto

- **O toggle virar editor.** Se alguém "só completar": nascem sliders de cor/curvas, presets e pack de filtros "de marca". **Corte neste item:** um controle binário, sem ajuste manual.
- **Escorregar para retoque de beleza.** Se alguém "só completar": suaviza pele e "melhora" o rosto. **Corte neste item:** só brilho/contraste/saturação, nada de forma ou pele.
- **Processar no servidor ou baixar modelo pesado.** Se alguém "só completar": quebra a promessa de 100% no aparelho. **Corte neste item:** local, sem rede, sem dependência nova.

## Questões em aberto (produto)

- **Padrão ligado ou desligado?** **Opções:** ligado | desligado. **Recomendação:** ligado — é o pedido literal do humano e o card fica bom sem exigir decisão. _(decidido nos literais; confirmar no gate)_
- **Referência de tom medida na arte dos candidatos ou perfil fixo calibrado?** **Opções:** medir a arte-mestre `team-card-base.png` | perfil fixo (números calibrados uma vez). **Recomendação:** medir a arte como referência, com limites fixos de intensidade — segue o tom real do card sem virar "filtro da casa". _(assumido — validar com produto)_
- **Toggle só no estado pronto ou também no estado vazio?** **Opções:** só no estado pronto | também antes da foto. **Recomendação:** só no estado pronto — sem foto não há o que harmonizar, e o estado vazio já tem carga própria. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1196
- Design UI (gate): `docs/plans/cards-time-de-voce-harmonizar-cores-ui-design.html` (+ assets em `cards-time-de-voce-harmonizar-cores-ui-design-assets/`)
- `docs/plans/cards-time-de-voce.md` / `cards-time-de-voce-impl.md` (S15) — o fluxo onde o controle entra
- `public/cards/team-card-base.png` — arte-mestre usada como referência de tom
- `src/components/cards/cardCutout.ts`, `useCardCutout.ts`, `CardComposer.tsx`, `src/lib/cardRender.ts`, `cardCopy.ts`
- `src/components/CampaignNewsletterForm.tsx`; `src/app/(frontend)/styles.css`; `tests/e2e/frontend.e2e.spec.ts`; `AGENTS.md` (provider `openai` reservado ao design)
