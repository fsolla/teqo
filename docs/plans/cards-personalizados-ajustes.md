# Cards personalizados: ajustes de fidelidade e experiência (S14)

Status: rascunho
Atualizado em: 2026-09-12
Issue: #959
Priority: P1
Model: composer-2.5
Impeccable: C — ajustes de fidelidade e interação no funil público de cards (home + compositor)
Rascunho UI: docs/plans/cards-personalizados-ajustes-ui-draft.html
Appetite: ~1–1,5 dia eng; seis ajustes verificáveis no funil já entregue, sem fluxo novo
Responsável: —

## Intenção

O S13 (#941) entregou o funil de cards e está em produção: a seção `Mostre que você está com Solla` na home e o compositor em `/cards`. O humano revisou o funil e pediu seis ajustes de fidelidade e experiência: o modelo da home deve abrir o compositor ali mesmo; o nome no card gerado deve alinhar à esquerda com a linha `SOU`; o tile do modelo de nome deve ser fiel ao resultado real; a seção precisa de uma posição melhor na home; a moldura do modal tem um vão interno grande demais; e o texto de ajuda está ilegível por baixo contraste.

É um refinamento do que já existe — nenhum modelo, rota ou mecanismo novo. A promessa ao visitante continua a mesma: mostrar apoio com a identidade oficial, sem conta e sem que nome ou foto saiam do aparelho.

**Decisões do humano (2026-09-12, gate):** a home passa a abrir o MESMO compositor de `/cards` (modal no desktop, drawer no mobile), mantendo a pessoa na homepage; o CTA `Criar meu card` da home é removido — os três modelos passam a ser o único gatilho. Isso reverte deliberadamente a decisão do gate do S13 de que `/cards` seria a única superfície de edição; o anti-goal "dois fluxos de criação" permanece — há um único editor, não dois.

## Persona e fluxo

- **Persona / contexto:** visitante do site, geralmente no celular, que quer manifestar apoio e publicar uma imagem com a identidade da campanha.
- **Job principal:** criar um card pessoal com aparência oficial em poucos passos, sem sair de onde está nem entregar dados.
- **Fluxo desejado:** vê a seção na home → toca em um modelo → o compositor abre ali mesmo (modal no desktop, drawer no mobile) → personaliza e confere → gera e baixa o PNG → fecha e continua na home. Quem chega direto em `/cards` (ou por link `?model=`) mantém o fluxo canônico.
- **Anti-goals de produto:** virar editor gráfico completo, galeria, rede social, cadastro de apoiador, segundo editor ou novo canal de coleta de dados.

### Esboço de fluxo (C)

```text
[home: seção "Mostre que você está com Solla"]
→ [toca num modelo]
→ [modal desktop | drawer mobile — compositor aberto na home]
→ [personalizar + conferir] → [card pronto] → [baixar PNG] → [fechar → continua na home]
(caminho canônico preservado: /cards e /cards?model=<id>)
```

### Rascunho UI (C)

- Rascunho UI (gate): `docs/plans/cards-personalizados-ajustes-ui-draft.html`
- Cenas: home com o compositor aberto em desktop e mobile, tile de nome fiel ao resultado, modal sem vão interno, ajuda legível e a nova ordem das seções.

## Objetivo e aceite

- Tocar em um modelo na home abre o compositor ali mesmo, sem navegar; a pessoa permanece na homepage e, ao fechar, volta à seção.
- O CTA `Criar meu card` sai da seção da home: os três modelos são o único gatilho e abrem o compositor ali mesmo.
- O nome no card gerado fica alinhado à esquerda com a linha `SOU` (borda x≈213), em uma e duas linhas, sem cortar texto; o ajuste de tamanho/quebra atual permanece.
- O tile do modelo de nome reproduz o resultado real: mesma borda esquerda do `SOU`, fonte `Brexter 700`, mesma relação de tamanho/cap height e cor `#ffec01`, com `SEU NOME` como exemplo.
- A seção é reposicionada na ordem da home: imediatamente antes de `Receba as novidades da campanha` e depois de `Acompanhe de perto`, mantendo a captura de contato como último bloco de conversão.
- A moldura do modal do compositor encosta no conteúdo (sem o vão interno atual), preservando borda fina e raio.
- O texto de ajuda `Arraste para posicionar e use os controles para aproximar ou ajustar.` fica legível nos dois shells (contraste ≥ 4.5:1 sobre branco).
- Guardrails: nome e foto continuam 100% no aparelho (sem PII em rede/analytics, sem persistência); arte-mestre intocada; `/cards` e o deep-link `/cards?model=<id>` seguem funcionando; um único editor; as demais seções da home não mudam.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — esta entrega não apresenta métricas nem dados para uma decisão operacional.
- **Forma:** _adiada ao plano de implementação_ — nome e foto seguem insumos locais da imagem; nenhum conteúdo pessoal entra em analytics.

## Dados da decisão (literais)

- ID reservado: `S14`; Tipo: `feature`; Priority proposta: `P1`; Model: `composer-2.5`.
- Frase de ajuda literal: `Arraste para posicionar e use os controles para aproximar ou ajustar.`
- Placeholder literal do tile: `SEU NOME`.
- Geometria-mestre do nome: borda esquerda x≈213 (canvas de 1080 de largura), tinta máxima 714px, cap height 106px, fill `#ffec01`, fonte `Brexter 700`.
- Tokens de contraste: `--campaign-muted: #6c615e`, `--campaign-ink: #000000`.
- Rota canônica preservada: `/cards` e deep-link `/cards?model=<id>`.
- Seção na home: `id="cards"`, `data-home-section="cards"`, título `Mostre que você está com Solla`; o CTA `Criar meu card` é removido da home (os modelos são o único gatilho).
- Nova ordem da home (decidida no gate): `… → Acompanhe de perto → cards → Receba as novidades da campanha → rodapé`.
- Arquivos-mestre de referência: `/home/fsolla/Documentos/cards/eu-sou-solla/template-to-com-solla-site.jpg.jpeg` (preenchido) e `/home/fsolla/Documentos/cards/eu-sou-solla/template-to-com-solla-site-sem-o-nome.jpg.jpeg` (base).

## Direção no codebase (hipótese)

- **Áreas prováveis:** seção e ordem da home em `src/app/(frontend)/(home)/`, componentes e catálogo em `src/components/cards/`, geometria/render em `src/lib/card*`, tokens em `src/app/(frontend)/styles.css`.
- **Precedente a olhar:** o próprio S13 (`docs/plans/cards-personalizados-campanha.md` + `-impl.md`); `CardsStudio`/`CardComposer` para reusar a ilha na home sem duplicar editor; `CardModelTile`/`NAME_CARD_SLOT` para a fidelidade do tile.
- **Risco de acoplamento:** o vão do modal nasce da classe base `sm:p-8` sobrevivendo ao override `p-0` (twMerge só remove a variante sem breakpoint); o contraste da ajuda vem de `DialogDescription`/`DrawerDescription` usarem `text-muted-foreground`, que `[data-theme='campaign-site']` não redefine (cai no near-white do `:root`). Resolver no menor blast radius, sem criar tema paralelo.

## Dependências

- Nenhuma.

## Fora de escopo

- Novos modelos, CMS de modelos ou métricas de uso.
- Redesenho das demais seções da home ou da página `/cards`.
- Remover `/cards` ou quebrar o deep-link `?model=`.
- Compartilhamento direto em redes sociais.
- Alterar as artes-mestre (compor por cima, nunca redesenhar).

## Rabbit holes de produto

- **Segundo editor na home.** Se alguém "só completar": nasce um compositor próprio na home e os comportamentos divergem. **Corte neste item:** a home abre o mesmo compositor, com o mesmo estado e a mesma ilha de edição.
- **Redesenhar o modal inteiro.** Se alguém "só completar": vira repaginação do compositor. **Corte neste item:** corrigir o vão da moldura e o contraste da ajuda, sem mudar estrutura.
- **Trocar a arte para "melhorar" a fidelidade.** Se alguém "só completar": a arte oficial é reeditada. **Corte neste item:** o resultado segue a arte-mestre; o ajuste é do desenho/tile.
- **Medir fidelidade "no olho".** Se alguém "só completar": aproximação visual vira critério. **Corte neste item:** usar a geometria do mestre (borda x≈213, tinta 714, cap 106, Brexter 700, `#ffec01`).

## Questões em aberto (produto)

- **Onde a seção entra na home?** **Decidido no gate (2026-09-12): antes de `Receba as novidades da campanha` e depois de `Acompanhe de perto`** — mantém a captura de contato como último bloco de conversão.
- **O que faz o CTA `Criar meu card` da home?** **Decidido no gate (2026-09-12): o CTA é removido da home** — tocar num modelo já abre o compositor de criação; a seção fica só com os três modelos como gatilho.
- **`/cards` continua existindo?** **Decidido no gate (2026-09-12): sim**, como página canônica e deep-link; a mudança é só o comportamento da home.

## Referências

- GitHub Issue #941 (S13, entregue)
- `docs/plans/cards-personalizados-campanha.md` e `docs/plans/cards-personalizados-campanha-impl.md`
- `docs/changelog/2026-09-12-s13-cards-personalizados.md`
- Rascunho UI (gate): `docs/plans/cards-personalizados-ajustes-ui-draft.html`
- `src/app/(frontend)/(home)/CampaignCardsSection.tsx`, `src/app/(frontend)/(home)/page.tsx`, `src/app/(frontend)/(home)/cards/page.tsx`
- `src/components/cards/{CardsStudio,CardComposer,CardModelGallery,CardModelTile}.tsx`, `src/lib/{cardModels,cardNameFit,cardRender}.ts`
- `src/app/(frontend)/styles.css` e `src/app/(frontend)/fonts.ts`
- `AGENTS.md` e `AGENTS-public.md`
