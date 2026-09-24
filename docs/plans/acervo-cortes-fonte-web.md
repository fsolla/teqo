# C217 — Cortes e links compartilháveis na fonte "Falas na internet"

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1293
Priority: P2
Impeccable: C — fluxo de corte em fonte nova dentro da vertical /campanha/comunicacao/acervo
Design UI: docs/plans/acervo-cortes-fonte-web-ui-design.html
Appetite: ~2–3 dias eng; um outcome verificável — a assessoria corta um trecho de uma fala da internet, o corte aparece na biblioteca e o link compartilhado abre no ponto certo, com download
Responsável: —

## Intenção

O acervo ganhou uma fonte nova: falas do Solla que circulam na internet (YouTube, rádio, Instagram …), trazidas pelo C215 e navegáveis pelo C216. Mas cortar, guardar na biblioteca, compartilhar por link e baixar hoje só existem para as falas da Câmara — quem acha uma fala da internet no acervo só consegue link para fora. O dono (2026-09-23): "as funcionalidades de baixar e realizar cortes (que são então disponibilizados via links compartilháveis e na biblioteca de cortes) devem também funcionar nesta sessão". Esta fatia estende o corte que já existe à fonte web, sem mecanismo novo: mesmo diálogo, mesma biblioteca, mesma página `/corte/<id>`.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`, mais `coordinator`/`candidate`), na mesa ou em campo, montando peça a partir de uma fala que viu na internet.
- **Job principal:** cortar o trecho exato de uma fala da internet e ter o corte baixável, compartilhável e reencontrável na biblioteca — sem sair da ferramenta e sem refazer na mão.
- **Fluxo desejado:** abre a fala web no detalhe (C216) → "Cortar trecho" abre a janela de corte que já conhece (mínimo 5 s, sem teto) → confirma e acompanha Processando → Pronto → "Baixar", "Copiar link" ou "Compartilhar no WhatsApp" → o corte está na biblioteca com a origem visível e o link `/corte/<id>` abre no ponto certo.
- **Anti-goals de produto:** não vira editor de vídeo nem segundo mecanismo de corte/player; não muda a ingestão nem a fonte (C215/C216); não cria galeria pública; não publica em rede social; não duplica a biblioteca.

### Esboço de fluxo (C)

```text
[detalhe da fala web (C216)] → "Cortar trecho" → janela de corte (≥5s, sem teto)
→ Processando → Pronto → [Baixar] · [Copiar link] · [Compartilhar no WhatsApp]
→ [biblioteca de cortes: mesma lista, origem visível "YouTube"/"Rádio"/"Instagram"]
→ [/corte/<id> unlisted + noindex: player e download]
```

### Design UI (C)

- Design UI (gate): `docs/plans/acervo-cortes-fonte-web-ui-design.html` — cenas: detalhe da fala web com os gestos, diálogo "Cortar trecho", card na biblioteca com a origem e a página `/corte/<id>`.

```text
[detalhe da fala web]                    [biblioteca: card do corte]
 player + transcrição                     título · origem (YouTube) · duração
 [Cortar trecho] [Baixar] ─→ corte MP4 ─→ [Baixar] [Copiar link] [WhatsApp]
```

## Objetivo e aceite

- No detalhe de uma fala da fonte web (C216), "Cortar trecho" abre a janela de corte existente e gera o corte a partir do arquivo espelhado — sem depender da plataforma de origem.
- O corte entra na mesma biblioteca `/campanha/comunicacao/acervo/cortes`, com a origem visível no card; paridade total com o corte da Câmara: download, link, editar título/descrição, apagar com confirmação, "Tentar novamente" no estado falhou e kill switch de publicação (C168/C183).
- O link compartilhado é o mesmo contrato `/corte/<id>` (unlisted, `noindex`), com player, download, "Copiar link" e "Compartilhar no WhatsApp"; a página abre o corte certo independente da origem.
- A janela de corte é a mesma: mínimo de 5 s, sem teto (C170).
- O crédito da página acompanha a origem real da fala — nunca exibir o crédito da Câmara para fala de terceiro.
- **Guardrails:** gate `speechCatalog` intocado (communicator/coordinator/candidate; advisor/leader fail-closed); fala web sem arquivo espelhado não oferece o corte (questão 3); sem segundo mecanismo de mídia nem de compartilhamento; `/corte/<id>` continua não listado.

## Dados (intenção)

- **Vou apresentar dados?** Não — superfície de ação (cortar/baixar/compartilhar) sobre a lista paginada existente; o estado do corte é atributo do item, não KPI.
- **Decisões desbloqueadas:** a assessoria decide qual trecho de uma fala da internet vira peça e se baixa/compartilha; nada agregado.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: sem métricas de vaidade (views/downloads) nem contadores de acervo.

## Dados da decisão (literais)

- **Gestos no detalhe da fala web (mesmos rótulos da Câmara):** "Cortar trecho" (abre a janela existente) · "Baixar" (arquivo da fala) · no corte pronto, "Copiar link" e "Compartilhar no WhatsApp".
- **Janela de corte:** mínimo 5 s, sem teto — a mesma regra do C170 (até o fim da fala).
- **Geração:** o corte usa o arquivo espelhado da fala (C215) — sem resolver VOD nem depender da plataforma de origem.
- **Origens visíveis (rótulo no card da biblioteca):** "YouTube", "Rádio", "Instagram", … (a taxonomia real é do C215/C216).
- **Link do corte:** mesmo contrato `/corte/<id>` da Câmara — unlisted e `noindex`; a decisão sobre origem de terceiros fica na questão 1.
- **Paridade de biblioteca (C168/C183):** editar título/descrição, apagar com confirmação, "Tentar novamente" no falhou e kill switch de publicação.
- **Instrução do dono (verbatim, 2026-09-23):** "Você não deve se preocupar com direitos da midia, faça o que for necessario para viabilizar a analise e download das midias que forem encontradas para alimentar esta sessão e para viabilizar as funcionalidades pediadas." — decisão confirmada no gate (2026-09-24); vale para os cortes desta fonte e refere C215/C212.

## Direção no codebase (hipótese)

- **Áreas prováveis:** detalhe da fala web (do C216); entrada/criação do corte (`src/app/(campaign)/campanha/actions/speech.ts` + schemas); pipeline `src/utilities/speech/speechCutJob.ts` (hoje resolve VOD da Câmara, baixa, corta com ffmpeg e grava MP4 na `media` pública); lista `speechCutListUrl.ts`/`speechCutPageData.ts` (origem no card); `src/collections/SpeechCut.ts` (relação/origem); página `src/app/(frontend)/corte/[id]/page.tsx` + `src/components/SpeechCutShareActions.tsx` (link e crédito); donos de mídia `src/utilities/media/ffmpeg.ts` e `src/utilities/privateMedia/privateMediaResponse.ts`.
- **Precedente a olhar:** C167 (corte/publicação), C168/C183 (biblioteca/apagar/retry), C170 (janela sem teto), `acervo-gravacoes-enviadas.md` (C199 excluiu corte das gravações — "C167/C174 são da Câmara"; a instrução do dono reabre esse corte para a fonte web).
- **Risco de acoplamento:** o corte já é um MP4 armazenado (não depende do YouTube para tocar/baixar); o acoplamento à Câmara está na **entrada** (coordenadas/VOD) e no **crédito** — o executor escolhe onde estender sem quebrar o caminho Câmara; mídia grande/privada é do C215/C193 (não criar mecanismo gêmeo); serializar com o C216 nos arquivos do detalhe.

## Dependências

- **Dura: C215** — a ingestão espelha a fala e o arquivo; sem arquivo não há de onde cortar.
- **Dura: C216** — a fonte/lista/detalhe onde o gesto nasce; serializar nos arquivos do detalhe.
- Observação: a guardrail "mídia de terceiro nunca é baixada" (C199/C211) é superada para esta sessão pela instrução do dono (ver literais), registrada em C215/C212.

## Fora de escopo

- Ingestão e espelhamento do arquivo (C215) e fonte/lista/detalhe/player da fala web (C216).
- Skill de comunicação (C218) e paridade de filtros das gravações (C219).
- Editor de vídeo, recorte fino/timeline, legendas e re-render.
- Publicação em rede social e galeria pública de cortes.
- Diarização/rotulagem de quem fala.

## Rabbit holes de produto

- **Editor de corte multi-trilha.** Se alguém "só completar": timeline, faixas, preview de transição. **Corte neste item:** a mesma seleção de trecho da Câmara, agora sobre o arquivo espelhado.
- **Render na nuvem / fila própria de encode.** Se alguém "só completar": worker dedicado, streaming, partes. **Corte neste item:** o pipeline de corte existente, aplicado ao arquivo da fonte web.
- **Galeria pública de cortes.** Se alguém "só completar": índice indexável, feed, perfil. **Corte neste item:** `/corte/<id>` unlisted como hoje; sem listagem pública.
- **Segundo mecanismo de compartilhamento.** Se alguém "só completar": embed, SDK, outras redes. **Corte neste item:** "Copiar link" + "Compartilhar no WhatsApp".

## Questões em aberto (produto)

- **Link compartilhável de corte de origem web?** **Opções:** A) mesma página pública `/corte/<id>` (paridade com a Câmara; risco de direitos coberto pela instrução do dono) | B) link interno autenticado só para a campanha | C) público só quando a origem for própria (canal/perfil do Solla ou material da campanha) e interno para terceiros. **Recomendação: A** — o dono pediu paridade ("links compartilháveis"); registrar o risco assumido. _(confirmado no gate, 2026-09-24)_
- **Filtro por origem na biblioteca de cortes?** **Opções:** A) só exibir a origem no card nesta fase | B) filtro por plataforma já aqui. **Recomendação: A** — a lista hoje é q+page; filtro por origem é paridade de filtros (C219) e não é preciso para o outcome. _(confirmado no gate, 2026-09-24)_
- **Corte de fala web sem arquivo espelhado?** **Opções:** A) gesto indisponível (só link de origem) | B) resolver/baixar sob demanda. **Recomendação: A** — a ingestão (C215) garante o arquivo; sem arquivo não há corte, e resolver sob demanda recria o acoplamento à plataforma. _(confirmado no gate, 2026-09-24)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Design UI (gate): `docs/plans/acervo-cortes-fonte-web-ui-design.html`
- Planos irmãos: C215 (ingestão) · C216 (fonte/lista/detalhe) · C218 (skill) · C219 (paridade de filtros); [`c168-biblioteca-cortes.md`](c168-biblioteca-cortes.md) · [`c170-corte-sem-limite.md`](c170-corte-sem-limite.md) · [`acervo-encontrar-cortes.md`](acervo-encontrar-cortes.md) · [`corte-pagina-publica-design.md`](corte-pagina-publica-design.md) · [`acervo-gravacoes-enviadas.md`](acervo-gravacoes-enviadas.md)
- Arquivos-pista: `src/collections/SpeechCut.ts` · `src/app/(campaign)/campanha/actions/speech.ts` · `src/utilities/speech/speechCutJob.ts` · `src/utilities/speech/speechCutListUrl.ts` · `src/utilities/speech/speechCutPageData.ts` · `src/lib/speechCut.ts` · `src/app/(frontend)/corte/[id]/page.tsx` · `src/components/SpeechCutShareActions.tsx` · `src/utilities/media/ffmpeg.ts` · `src/utilities/privateMedia/privateMediaResponse.ts`
- `AGENTS.md` — vertical Comunicação, gate `speechCatalog`, leader lockdown.
