# Home — escolher o estadual da dobradinha, montar e compartilhar a colinha

Status: rascunho
Atualizado em: 2026-10-01
Issue: #1404
Priority: P1
Impeccable: B — seção nova na home com seletor próprio e reuso da folha de compartilhamento
Design UI: docs/plans/home-colinha-estadual-ui-design.html
Appetite: ~1,5–2 dias eng; um outcome verificável (o visitante sai da home com a colinha do estadual — PNG e mensagem — e o link reabre a mesma colinha)
Responsável: —

## Intenção

Na reta final até 04/10, quem já está com Solla no grupo de WhatsApp precisa da colinha certa: o número do deputado estadual da dobradinha do seu território. A colinha já existe dentro do estúdio de cards (modelo `Minha colinha`, S31/S34) e a escolha do estadual vive dentro do composer — quem chega pela home não descobre que isso existe nem tem um caminho de um toque até o estadual dele. Este item dá à home uma seção própria: a lista dos estaduais com busca e card (foto, nome, número), a colinha montada no mesmo editor e o compartilhamento no mesmo idioma da Central de Conteúdos. É uma porta de entrada nova para o mesmo produto, não um segundo estúdio.

A campanha tem as dobradinhas na plataforma (`stateDeputy`) e o material de divulgação da Plenária da Vitória (54 dobradinhas, foto + card). A home mostra só quem casa nas duas pontas — quem não tem número/foto não aparece (fail-closed), porque a base não tem número de urna e nada é inventado.

## Persona e fluxo

- **Persona / contexto:** militante/eleitor no celular, grupo de WhatsApp aberto, já decidido no 1313, querendo o número do estadual da dobradinha do seu município — chegou pela home ou recebeu um link.
- **Job principal:** achar o seu estadual, sair com a colinha pronta (PNG + mensagem) e mandar para o grupo sem cadastro, sem digitar e sem errar o número.
- **Fluxo desejado:** rola a home até a seção nova (ou abre o link direto recebido) → a prévia da colinha já aparece na própria seção com `Baixar` e `Compartilhar` sempre disponíveis → digita o nome na busca e escolhe o estadual (desktop: rolagem vertical da lista; mobile: carrossel horizontal de uma linha) → a prévia atualiza na hora com a linha do estadual preenchida → baixa o PNG 1080×1920 → compartilha no WhatsApp (mensagem editável + link) ou manda o PNG pela folha do aparelho (Instagram e afins) → quem recebe o link cai na mesma seção com a colinha daquele estadual. **Sem escolha, a colinha é válida:** sai só com as cinco linhas fixas e o link sem `?estadual=`.
- **Anti-goals de produto:** segundo estúdio/editor; diálogo de montagem separado (a prévia é embutida); mini-CMS de dobradinhas; ranking/placar de estaduais; paginação/“carregar mais”; página por estadual nesta fatia; PII, cadastro, upload ou foto do visitante; envio automático ou destinatário; qualquer métrica nova.

### Esboço de fluxo (B)

```text
[home: nova seção (ou link direto /?estadual=<slug>#colinha)]
→ prévia da colinha SEMPRE visível na seção + Baixar/Compartilhar SEMPRE habilitados
→ busca "meu estadual" → lista com cards (foto · nome · número)
     desktop: grade em rolagem vertical (sem paginação) · mobile: carrossel horizontal de uma linha
→ escolhe (opcional) → a prévia atualiza na hora com a linha do estadual preenchida
→ baixa o PNG 1080×1920 (sem escolha: só as cinco linhas fixas)
→ compartilha: WhatsApp (mensagem editável + link) · folha nativa com o PNG (senão baixa) · copiar link
→ quem recebe o link cai na mesma seção com a colinha daquele estadual
[candidato sem material oficial / slug desconhecido] → não aparece na lista / cai no estado normal (fail-closed)
```

### Design UI (B)

- Design UI (gate): `docs/plans/home-colinha-estadual-ui-design.html` (+ assets em `home-colinha-estadual-ui-design-assets/`) — cenas: seção com busca, lista (desktop em rolagem vertical; mobile em carrossel horizontal de uma linha) e a **prévia da colinha embutida** nos dois estados (sem estadual = cinco linhas fixas; com estadual = linha preenchida), busca ativa/estado vazio, chegada pelo link direto (prévia já preenchida, sem diálogo), folha de compartilhamento e o recorte de candidato sem material (não aparece na lista); ~390 e ~1280. Posição da seção na home (sugestão: logo depois da seção `#cards`, antes da Central) entra na cena do fluxo para validação no gate.

## Objetivo e aceite

- A home ganha a seção âncora (`#colinha`) com busca de estadual; cada card mostra foto, nome e número; a lista é a interseção plataforma × material — sem material oficial, o estadual não aparece, nunca com número/foto inventados.
- A **prévia da colinha vive na própria seção** e é o estado inicial: sem nenhum estadual escolhido ela mostra só as cinco linhas fixas; escolhido um card, a linha `DEPUTADO ESTADUAL` preenche na hora e as cinco linhas fixas ficam intocadas. Não há diálogo de montagem separado.
- `Baixar o PNG` e `Compartilhar` ficam **sempre habilitados**, com ou sem estadual escolhido; sem escolha, o PNG sai com as cinco linhas fixas e o compartilhamento usa a mensagem/link sem o estadual.
- O download é o mesmo PNG 1080×1920 do estúdio — mesmo render, um só editor; nenhuma segunda via de geração.
- Navegação da lista **sem paginação**: no desktop os cards rolam verticalmente (grade na própria página, todos alcançáveis); no mobile são **um carrossel de uma linha** com rolagem horizontal — nenhum botão de página/“carregar mais”.
- Compartilhar usa a mesma folha/vocabulário: WhatsApp com mensagem editável + link, folha nativa do aparelho com o PNG gerado (fallback: baixar o PNG) e copiar link; sem destinatário e sem envio automático.
- O link direto `/?estadual=<slug>#colinha` reabre a seção com aquele estadual pré-selecionado e a prévia já preenchida; sem `?estadual` o link abre a seção no estado sem escolha; slug desconhecido ou sem material cai no estado normal, sem erro.
- Sem PII, sem login, sem upload e sem `Consent` novo; a nota de privacidade do estúdio continua verdadeira e a foto do visitante não entra aqui.
- Sem candidato com material, a seção continua útil: a lista mostra o estado vazio e a colinha (sem estadual) segue baixável/compartilhável; sem overflow horizontal fora do carrossel mobile.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — nenhuma decisão nova; a leitura de uso segue sendo a do contador anônimo existente (S32) se o download for o mesmo, sem evento novo.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: nenhuma métrica/superfície de dados nasce aqui.

## Dados da decisão (literais)

- Item `S43`; slug `home-colinha-estadual` (arquivo `docs/plans/home-colinha-estadual.md`); tipo `feature`; Priority `P1`; Impeccable `B — seção nova na home com seletor próprio e reuso da folha de compartilhamento`; Design UI `docs/plans/home-colinha-estadual-ui-design.html`.
- Fonte da lista: dobradinhas da plataforma (`stateDeputy`), **excluindo** registros cujo nome contenha "apagar" (case-insensitive; convenção da equipe para marcar registros a remover); a lista exibida é a **interseção** com quem tem material oficial (foto + número).
- Material da Plenária da Vitória (origem fora do repo; o repo recebe só derivativos otimizados, convenção S30): `/home/fsolla/Downloads/CARDS-PLENARIA-DA-VITORIA/<Nome> - card.png`, `/home/fsolla/Downloads/DOBRADINHAS-ORGANIZADAS/<Nome>/foto.png` e a lista `/home/fsolla/Downloads/DOBRADINHAS-ORGANIZADAS/LISTA-DOBRADINHAS.txt` — 54 dobradinhas.
- Descompasso conhecido a resolver no cruzamento (mapa explícito e versionado, nunca casamento por semelhança em tempo de render): `Dr. Armando` tem material e não tem entrada no catálogo S30; `Marlenne` (material) ≠ `Marlene do Sindicato` (catálogo); `Radiovaldo Costa` (material) ≠ `Radiovaldo` (catálogo).
- Colinha: model id `minha-colinha`; saída PNG 1080×1920; as cinco linhas fixas já contratadas (S31/S34) ficam intocadas — só a linha `DEPUTADO ESTADUAL <nome de urna> — <5 dígitos>` é preenchida. **Dois estados válidos:** sem estadual (a prévia/PNG sai só com as cinco linhas fixas) e com estadual (linha preenchida).
- Navegação da lista: **desktop = rolagem vertical** (grade que flui na página; sem paginação); **mobile = carrossel horizontal de uma linha** (todos os estaduais alcançáveis por rolagem lateral); nunca paginação/“carregar mais”.
- Link direto: `/?estadual=<slug>#colinha` (com estadual) e `/#colinha` (sem estadual); sem rota nova nesta fatia; slug desconhecido/sem material cai no estado normal da seção, sem erro.
- Copy da mensagem (assumida — validar com produto): com estadual `Montei minha colinha: [NOME] [NÚMERO] para deputado estadual, com Jorge Solla 1313. Monte a sua: [link]`; **sem estadual** `Montei minha colinha de votação com Jorge Solla 1313. Monte a sua: [link]`; alternativa com estadual `Colinha pronta: 1313 para deputado federal e [NÚMERO] para estadual. Monte a sua: [link]`.
- Share: WhatsApp com a mensagem editável + link; Instagram/outros pela folha nativa do aparelho com o PNG gerado (fallback: baixar o PNG); copiar link — sem destinatário e sem envio automático; nenhum canal novo.
- Sem PII, sem login, sem upload, sem `Consent` novo; a foto do card é do candidato (asset do site), a do visitante não entra neste fluxo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** nova seção na home (`src/app/(frontend)/(home)/page.tsx`) no padrão server → ilha client da S39/S42 (`ContentPieceHomeSection` → `ContentPieceHomeBoard`); o funil de cards em `src/components/cards/` (`CardComposer`, `StateDeputySelect`, `cardCanvas`); a folha de share em `src/components/conteudos/ContentPieceShareSheet.tsx`; catálogo no formato de `src/lib/stateDeputyCatalog.ts` (pista, não necessariamente o dono da nova lista); geração do cruzamento com precedentes `scripts/build-state-deputy-card-assets.mjs` e `scripts/regenerate-municipality-catalog-snapshot.mjs`.
- **Precedente a olhar:** S39/S42 (seção na home + folha de compartilhar), S27 (`ContentPieceShareSheet`), S30/S31/S34 (catálogo, seletor e colinha), S32/C213 (contador anônimo).
- **Risco de acoplamento:** o estúdio tem UM editor — a seção só abre o mesmo fluxo, nunca um render/download paralelo; a folha é o único mecanismo de share; diretório novo sem entrada no `scripts/lib/e2e-affected-manifest.mjs` falha fechado (`unmapped-risk`).

## Dependências

- S30 (#1271), S31 (#1272) e S34 (#1298) entregues — catálogo, seletor e colinha reusados.
- Material da Plenária da Vitória disponível fora do repo (paths acima); sem ele não há foto/número novos.
- Design hi-fi aprovado no gate. Soft: S32/C213 (contador anônimo) — se o download for o mesmo, nada muda.

## Fora de escopo

- Segundo editor/estúdio; **diálogo/step separado para montar a colinha** (a prévia é embutida na seção e atualiza na escolha); mudar os modelos existentes ou o conteúdo das cinco linhas fixas; mexer na seção `#cards` ou em `/cards`.
- Paginação, “carregar mais” ou qualquer corte da lista; rota/página por estadual com metadata própria (`/colinha/<slug>`) — item próprio se o preview social do link medir.
- Mini-CMS/collection/toggle novo para dobradinhas (salvo se a Questão 1 mudar).
- Ranking, força, prioridade, contagem por estadual ou qualquer métrica nova; A4/impressão.
- PII/cadastro/foto do visitante/upload; novos canais de compartilhamento.

## Rabbit holes de produto

- **"Já que tem seção, mostra o estúdio inteiro".** Se alguém "só completar": galeria dos seis modelos e busca de tudo na home. **Corte neste item:** só a colinha; a lista e a prévia vivem na seção.
- **"Escolher o estadual vira obrigatório".** Se alguém "só completar": `Baixar`/`Compartilhar` desabilitados até escolher. **Corte neste item:** sem estadual é estado válido — a colinha sai com as cinco linhas fixas e o link sem `?estadual=`.
- **"A lista vira mini-CMS/ranking".** Se alguém "só completar": prioridade, força eleitoral, ordenação por votos. **Corte neste item:** ordem estável do material, sem métrica; curadoria continua na plataforma.
- **"Lista longa pede paginação".** Se alguém "só completar": páginas ou “carregar mais” cortam os 54. **Corte neste item:** rolagem vertical no desktop e carrossel horizontal no mobile — a lista inteira sempre alcançável.
- **"Completar quem não tem material".** Se alguém "só completar": aproximar número de outra fonte ou usar foto genérica. **Corte neste item:** fail-closed — sem foto+número oficiais, o estadual não aparece.
- **"Segundo mecanismo de compartilhar".** Se alguém "só completar": folha própria com mensagem divergente. **Corte neste item:** a folha existente é o único mecanismo.
- **"Prometer anexo no WhatsApp".** Se alguém "só completar": dizer que o PNG vai junto no `wa.me` (não vai). **Corte neste item:** WhatsApp = mensagem + link; o PNG vai pela folha nativa ou pelo download.

## Questões em aberto (produto)

- **Qual a fonte da verdade da lista cruzada?** **Opções:** A) a plataforma segue a fonte de quem é dobradinha (filtro "apagar") e foto/número vêm do material, com o cruzamento gerado e versionado | B) número e foto viram campos preenchidos na plataforma (+ publicação para o site) | C) lista digitada à mão no site. **Recomendação:** A — ninguém cadastra duas vezes e a curadoria fica no mapa versionado; B vira item próprio se a equipe quiser operar a lista sem deploy. _(assumido — validar com produto)_
- **Link direto nesta fatia?** **Opções:** A) `/?estadual=<slug>#colinha` na home, sem rota nova | B) `/colinha/<slug>` com título/descrição por estadual (preview melhor no link compartilhado, nova URL pública). **Recomendação:** A agora; B vira item próprio se o preview social do link for pedido. _(assumido — validar com produto)_
- **Qual copy da mensagem?** **Opções:** A) com estadual `Montei minha colinha: [NOME] [NÚMERO] para deputado estadual, com Jorge Solla 1313. Monte a sua: [link]` (sem estadual cai no literal sem nome/número) | B) `Colinha pronta: 1313 para deputado federal e [NÚMERO] para estadual. Monte a sua: [link]`. **Recomendação:** A — nomeia o estadual e chama a montagem. _(assumido — validar com produto)_
- **Se a lista cruzada vier vazia, a seção aparece?** **Opções:** A) sim — busca com estado vazio e a colinha (sem estadual) seguem baixável/compartilhável | B) não aparece (kill switch do rascunho anterior). **Recomendação:** A — “Baixar/Compartilhar sempre disponíveis” e a colinha sem estadual é estado válido. _(assumido — validar com produto)_

## Referências

- GitHub Issue: #1404.
- Design UI (gate): `docs/plans/home-colinha-estadual-ui-design.html` (+ assets em `home-colinha-estadual-ui-design-assets/`).
- `docs/plans/cards-estadual-dobradinha.md` (S30), `cards-colinha.md` (S31), `cards-colinha-arte-exata.md` (S34), `cards-analytics.md` (S32); `central-conteudos-secao-home-share-filtro.md` (S42 — seção na home + folha de share).
- `src/components/cards/StateDeputySelect.tsx`, `CardComposer.tsx`, `cardCanvas.ts`, `src/lib/stateDeputyCatalog.ts`, `cardRender.ts`/`cardColinha.ts`; `src/components/conteudos/ContentPieceShareSheet.tsx`, `ContentPieceHomeSection.tsx`; `src/app/(frontend)/(home)/page.tsx`; `scripts/lib/e2e-affected-manifest.mjs`.
- Material externo: `/home/fsolla/Downloads/CARDS-PLENARIA-DA-VITORIA/`, `/home/fsolla/Downloads/DOBRADINHAS-ORGANIZADAS/` (54 dobradinhas; `LISTA-DOBRADINHAS.txt`).

## Self-score (shaping)

1. Fatia = um outcome verificável? 5/5 — o visitante escolhe o estadual na home e sai com a colinha (PNG + share); o link reabre a mesma colinha.
2. Appetite declarado e a intenção cabe nele? 4/5 — ~1,5–2 dias: seção nova + lista cruzada versionada, reusando editor e folha existentes; o cruzamento plataforma×material é o delta.
3. Persona + job + aceite claros (sem jargão de stack)? 5/5 — fluxo em linguagem de eleitor, reta final de eleição.
4. Direção no codebase é hipótese (não contrato técnico)? 5/5 — arquivos e paths são pista do estado atual; nenhuma schema/signature prescrita.
5. Zero decisões duras de engenharia no plano? 4/5 — materialização do cruzamento e forma do link direto ficam nas questões abertas; a escolha final é da implementação.

Média: 4,6/5 — ≥4/5.
