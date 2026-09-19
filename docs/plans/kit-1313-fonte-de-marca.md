# Kit 1313 como fonte de marca única (doutrina + ativos oficiais)

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1193
Priority: P2
Impeccable: A — N/A sem UI (doutrina, skills e assets de referência; nenhuma superfície nova)
Design UI: N/A — sem UI
Appetite: ~0,5 dia eng — ponteiro na doutrina + 7 ativos + README
Responsável: —

## Intenção

A C196 mesclou o kit oficial 1313 (`public/campaign-kit/` com 7 PNGs + README de paleta e uso; manual em `docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`), mas só a skill `reels-tutoriais` e o agente `designer-campanha-solla` sabem que ele existe. Quem mais produz peça visual — e a doutrina compartilhada de design, que hoje diz "logo quando aprovado" sem apontar a fonte — continua podendo inventar identidade. O kit original ainda tem 7 ícones/pattern oficiais fora do repo. Esta entrega faz do kit a fonte de marca única e verificável, sem geminar regra e sem arrastar o site público ou os documentos institucionais para a identidade de campanha.

## Persona e fluxo

- **Persona / contexto:** agentes e pessoas que produzem peças da campanha — `designer`/`designer-campanha-solla` (design), `reels-tutoriais` (vídeo), `solla-comunicacao` (texto) — e quem revisa marca no gate.
- **Job principal:** achar o ativo e a regra oficiais sem adivinhar e sem recriar lockup.
- **Fluxo desejado:** quem desenha abre a doutrina → encontra o ponteiro para o kit → abre o README → usa o ativo certo (positiva/negativa/estrela). Quem escreve texto carrega `solla-comunicacao` → vê o ponteiro curto → não inventa identidade; se a peça pede visual, o caminho é o kit.
- **Anti-goals de produto:** manual paralelo no repo; segunda paleta de campanha; regra de marca copiada por agente; kit virar desculpa para redesenhar o site.

## Objetivo e aceite

- A doutrina de design (`.agents/skills/plan-issue/ui-design-html.md` §Tokens, brand e shadcn) aponta `public/campaign-kit/README.md` + manual como fonte de marca das superfícies da campanha — valendo para `designer`, `designer-degraded` e `designer-campanha-solla` **sem** regra duplicada em cada agente.
- `public/campaign-kit/` guarda os 14 ativos (7 já mesclados + 7 ícones/pattern), com os nomes de arquivo preservados; o README cobre "Ativos e quando usar" para os 14 e registra a origem externa do kit.
- `solla-comunicacao` ganha ponteiro curto: identidade visual oficial = kit; não inventar nem copiar a paleta (a dona é o README do kit).
- Nada de regra geminada; dossiês/boletins/relatório de cidade e site público ficam intocados (fail-closed institucional; UI pública é outro item).
- Verificação por inspeção: ponteiro presente na doutrina; `public/campaign-kit/` com 14 PNGs; README com 14 entradas de uso.

## Dados (intenção)

- **Vou apresentar dados?** Não — entrega de doutrina e assets; nenhuma métrica ou decisão analítica.
- **Decisões desbloqueadas:** quem cria peça visual escolhe o ativo oficial certo (positiva/negativa/estrela) em vez de recriar; quem escreve texto não inventa identidade visual.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de que o README não vire recópia do manual.

## Dados da decisão (literais)

- 7 ativos a mesclar, nomes preservados: `bahia.png`, `coração.png`, `estrela-2.png`, `pattern-shapes.png`, `punho.png`, `saude.png`, `saude-2.png` (ícones/pattern, RGBA transparentes, ~400 KB somados).
- Origem externa verbatim: `/home/fsolla/Downloads/OneDrive_2026-09-19/kit solla 1313/PNGs/`.
- Paleta oficial (extraída dos ativos): `#e4102f` (vermelho), `#184e92` (azul), `#ffeb00` (amarelo), `#009647` (verde, só dentro dos ativos); laranja do manual `#f89c0e` só nas variações de paleta — não usar.
- Ponteiro canônico: `public/campaign-kit/README.md` + `docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`.
- Não versionar: `FOTO SOLLA CAMISA BRANCA.png` (34 MB) e `MANUAL CAMPANHA JORGE SOLLA 1313.ai` (3,3 MB).
- Site segue legado (fora de escopo): `public/LOGO_SOLLA_BRANCO.svg` e paleta `#a21c1c`/`#ffe607`/creme.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/plan-issue/ui-design-html.md:66-71` (o bullet `:69` "logo quando aprovado" é o encaixe natural do ponteiro); `.opencode/skills/solla-comunicacao/SKILL.md` (regras rápidas); `public/campaign-kit/README.md` (mapa de uso).
- **Precedente a olhar:** C196 (`docs/changelog/2026-09-18-c196.md:3`) e as citações já existentes em `.agents/skills/reels-tutoriais/SKILL.md:118-135` e `.opencode/agent/designer-campanha-solla.md:25`.
- **Risco de acoplamento:** `designer` e `designer-degraded` herdam a doutrina — ponteiro na doutrina, nunca regra copiada; não encostar nos builders de dossiê (`scripts/lib/dossieRender.mjs`, `dossieBulletinRender.mjs`, `cityReportRender.mjs`) nem na UI pública (`src/components/campaign/shell/campaign-logo.tsx`, `src/app/(frontend)/styles.css`).

## Dependências

- Dura: nenhuma.
- Soft: C196 (kit original e manual — sem ela não haveria o que apontar).

## Fora de escopo

- Site público/admin: trocar logo legado/paleta é mudança de UI pública — item próprio (gatilho: entrega de identidade visual do site).
- Dossiês, boletins e relatório de cidade: fail-closed institucional, nunca marca de campanha (`scripts/lib/dossieRender.mjs:141`).
- `FOTO SOLLA CAMISA BRANCA.png` e o `.ai`: a foto, quando usada em página, entra otimizada via Media/Garage (item próprio); o PDF do manual já cobre o versionamento.
- Redesenhar ou regerar qualquer ativo do kit.

## Rabbit holes de produto

- **Duplicar a regra em cada agente.** Se alguém "só completar" colando a paleta nos três agentes de design: drift entre eles e a doutrina. **Corte neste item:** ponteiro único na doutrina.
- **README virar manual paralelo.** Se alguém recopiar as regras do PDF no README: duas verdades divergindo. **Corte neste item:** README só mapa de uso + paleta extraída; o manual é o PDF.
- **Versionar os arquivos pesados.** Se alguém "só completar" com a foto (34 MB) e o `.ai` (3,3 MB): repo inchado. **Corte neste item:** fora; foto via Media quando houver uso.

## Questões em aberto (produto)

- **Os 7 novos ativos não têm legenda de uso no kit; o que escrever no mapa?** **Opções:** A) ler o manual PDF e extrair o uso; B) pedir legenda ao humano; C) descrever literalmente a forma (ex.: "ícone de saúde — variação 2"). **Recomendação:** A e, se o manual não distinguir (ex.: `saude` vs `saude-2`), C com nota "uso a confirmar" — não travar a entrega nem inventar significado. _(decidido no gate 2026-09-19: A, com o fallback C se o manual não distinguir)_

## Referências

- GitHub Issue: a registrar (C204)
- Design UI (gate): N/A — sem UI
- `public/campaign-kit/README.md:19-43` (ativos e regras atuais); `docs/changelog/2026-09-18-c196.md`
- `.agents/skills/plan-issue/ui-design-html.md:66-71`; `.opencode/skills/solla-comunicacao/SKILL.md:8-11`
- `.agents/skills/reels-tutoriais/SKILL.md:118-135`; `.opencode/agent/designer-campanha-solla.md:25`
- `scripts/lib/reelRender.mjs:121-138`; `scripts/build-reel.mjs:48,116` (consumo atual do kit)
- `scripts/lib/dossieRender.mjs:110-114,141`; `scripts/lib/dossieBulletinRender.mjs:11-14,125-141,197`; `scripts/lib/cityReportRender.mjs:370-392`
- `src/components/campaign/shell/campaign-logo.tsx:7-18`; `src/app/(frontend)/styles.css:976-982`; `DESIGN.md:5-20,150-151`
