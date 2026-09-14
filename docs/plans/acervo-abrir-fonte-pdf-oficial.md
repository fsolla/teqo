# Acervo de falas: "Abrir fonte" abre o PDF oficial do Diário (fim do visualizador legado)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-09-14
Issue: #988
Priority: P2
Impeccable: A — N/A (sem UI nova; muda só o destino de um link existente)
Rascunho UI: N/A — sem UI
Appetite: ~1 dia eng + tempo de máquina de uma passada; um outcome verificável — nenhuma fala do acervo entrega "Abrir fonte" apontando para o visualizador legado, e o import não reintroduz
Responsável: —

## Intenção

O acervo de falas (C153–C155) já mostra a transcrição oficial inline e oferece "Abrir fonte" como prova de origem. Só que o link gravado é o visualizador legado da Câmara (`dc_20b.asp`/`dc_20.asp`): medido em 2026-09-14, ele responde 302 depois de 25–85 s para uma página que faz meta-refresh (1 s) para um host deprecado — que pendura o browser. Quem clica fica em "Loading…" e nunca abre o Diário. O PDF oficial no mesmo host responde 200/206 `application/pdf` em segundos. Este item troca o valor gravado pelo PDF direto (na página do discurso quando ela existe) e repara os discursos já importados, sem reimportar nada. É P2: a transcrição oficial já aparece inline e o link é proveniência — mas um botão que nunca abre é defeito real numa entrega recente.

## Persona e fluxo

- **Persona / contexto:** assessoria/comunicação e staff que conferem a proveniência de uma fala no acervo; na mesa, com o detalhe da fala aberto, querem checar a fonte oficial sem cerimônia.
- **Job principal:** clicar "Abrir fonte" e cair no PDF oficial do Diário, na página do discurso, para conferir/citar a publicação.
- **Fluxo desejado:** abre a fala no acervo → clica "Abrir fonte" → o PDF oficial da Câmara abre direto (na página do discurso quando disponível) em tempo normal de PDF.
- **Anti-goals de produto:** redesenhar a tela/detalhe do acervo; espelhar Diários; resolver o link no request do usuário; trocar a fonte oficial por YouTube como padrão; reimportar o acervo inteiro; mexer em comissões/segunda fonte.

## Objetivo e aceite

- Nenhuma fala do acervo entrega "Abrir fonte" apontando para `dc_20b.asp`/`dc_20.asp`/`montaPdf.asp`.
- Clicar abre o PDF oficial da Câmara direto, na página do discurso quando disponível, em tempo de carregamento normal de PDF.
- A página do acervo nunca depende da Câmara para renderizar (resolução é offline/cacheada).
- Reimport/backfill não reintroduz o link legado.
- Reparo dos dados existentes em produção roda com guard de escrita, é idempotente e reporta cobertura (falas/datas atualizadas, falhas).
- **Guardrails:** crédito "Fonte: Câmara dos Deputados · CC BY 4.0" mantido; URL pública do acervo intocada; sem Consent novo; sem reimportar ASR/LLM (o escopo é só o link); sem tocar no VOD (`vodPlaybackUrl`/`vodDownloadUrl`).

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é um link existente; o relatório do reparo é insumo operacional, não tela.
- **Decisões desbloqueadas:** quem confere proveniência decide citar/checar sem sair do fluxo; a coordenação técnica decide, pelo relatório, se alguma data não resolvida merece tratamento manual.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: resolução offline/cacheada (nunca chamada à Câmara no render), uma resolução por data compartilhada pelas falas daquela publicação.

## Dados da decisão (literais)

- **Destino do link:** PDF direto do Diário em `https://imagem.camara.leg.br/Imagem/d/pdf/<narquivo>` com `#page=<página>` quando a URL legada tinha `txPagina`.
- **Onde gravar:** sobrescrever `officialTextUrl` (mesmo campo, sem schema novo, sem segundo link) — o valor continua sendo "o texto oficial", agora link direto e funcional.
- **Legado a erradicar:** `https://imagem.camara.(leg|gov).br/dc_20b.asp?...Datain=25/6/2020&txPagina=129...` (e variante `dc_20.asp`); o redirect intermediário `montaPdf.asp?narquivo=DCD0020200625001020000.PDF&npagina=129` também não deve ser gravado.
- **Comportamento medido (2026-09-14):** legado responde 302 após 25–85 s; `montaPdf.asp` devolve HTML com meta-refresh (1 s) para `http://imagem.camara.gov.br/...` (host deprecado), que pendura no browser; o PDF direto responde 200/206 `application/pdf` em segundos.
- **Exemplos reais resolvidos:** 25/06/2020 → `DCD0020200625001020000.PDF#page=129`; 28/09/2011 → `DCD28SET2011.pdf` (ano antigo usa nome curto); 10/03/2026 → `DCD0020260310000250000.PDF`.
- **`<narquivo>` não é derivável da data por fórmula** (o número do Diário não está na URL); só se conhece seguindo o redirect do legado — por isso a resolução é cacheável por (coleção, data), uma vez por data.
- **Escala/cobertura:** 997 discursos importados em produção pelo C155 (2026-09-13); `officialTextUrl` é o único ponto do link (nenhum código/teste referencia `dc_20b`/`montaPdf`/`narquivo`).
- **Guard de escrita:** `CAMARA_IMPORT_CONFIRM=1` via `requiresWriteConfirm` (`--coverage`/`--verify-links` são isentos); precedente de reparo one-off: `MEDIA_RECOVER_CONFIRM` em `scripts/recover-media.mjs`. Cache/report vivem em `data/camara/` (gitignored).
- **Falha de resolução numa data:** nada de link morto — a fala cai no fallback já existente (`youtubeUrl`; sem ele, botão oculto), e o relatório lista as datas não resolvidas como pendência explícita.

## Direção no codebase (hipótese)

- **Áreas prováveis:** dono do import `scripts/import-camara-speeches.mjs` + helpers puros `scripts/lib/camaraSpeeches.mjs` + `scripts/lib/camaraFetch.mjs` (resolver com cache, no padrão de `ensureCachedDownload`); consumidores do link: `src/components/campaign/speech/SpeechResultCard.tsx` e `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx`.
- **Precedente a olhar:** `scripts/recover-media.mjs` (reparo one-off com guard e relatório), `scripts/lib/cli.mjs` (`requiresWriteConfirm`, `ensureCachedDownload`), runbook `docs/ops/teqo-1313-deploy.md` §C155.
- **Risco de acoplamento:** a normalização na gravação não pode virar dependência de rede frágil no import (cache + falha → fallback, sem link morto); o e2e `tests/e2e/campaignSpeechAcervo.e2e.spec.ts:44` usa URL fictícia e não passa pelo import — não quebrar; testes unit de `scripts/lib/camaraSpeeches.mjs` cobrem os helpers puros.

## Dependências

- Entregues (duras, satisfeitas): C153 (catálogo), C154 (vertical/acervo), C155 (backfill; 997 discursos).
- Nenhuma dependência bloqueante.

## Fora de escopo

- Espelhar os PDFs dos Diários no Garage (cada um tem ~55 MB).
- Resolver o link no request do usuário (offline/cacheado).
- Redesenhar a tela/detalhe do acervo ou mudar o botão (só o destino).
- Reimportar ASR/LLM do acervo — o escopo é só o link; nenhuma alteração em VOD, trechos ou transcrições.
- Comissões e segunda fonte; busca semântica; novo campo/segundo link de fonte.
- Mudar crédito/licença (CC BY 4.0 fica) ou a URL pública do acervo.

## Rabbit holes de produto

- **"Espelhar os Diários no Garage."** Se alguém "só completar": storage de dezenas de MB por dia, retenção e custo. **Corte neste item:** link direto para o PDF oficial no host da Câmara.
- **"Resolver o link no clique/render."** Se alguém "só completar": latência de 25–85 s ou pendura no request do usuário; acoplamento do render à Câmara. **Corte neste item:** resolução offline, cacheada por data.
- **"Reimportar o acervo inteiro para corrigir o campo."** Se alguém "só completar": custo de ASR/LLM e risco de regressão em dados bons. **Corte neste item:** reparo one-off idempotente só de `officialTextUrl`.
- **"Trocar a fonte para YouTube como padrão."** Se alguém "só completar": perde-se a proveniência oficial exigida pelo crédito. **Corte neste item:** PDF oficial é padrão; YouTube segue só como fallback de falha.

## Questões em aberto (produto)

- **Quando a data não resolve, o que fazer?** **Opções:** A) cair no fallback existente (`youtubeUrl`; senão, ocultar o botão) | B) manter o legado | C) placeholder. **Recomendação:** A — nada de link morto; o relatório lista a data como pendência. _(assumido — validar com produto)_
- **Distinguir na UI quando o link virou fallback YouTube?** **Opções:** A) não distinguir (sem mudança de UI) | B) rotular. **Recomendação:** A — o aceite é o link funcional; o relatório é o lugar da verdade. _(assumido)_
- **Quando rodar o reparo em produção?** **Opções:** A) uma passada após o merge, com guard, reexecutável | B) junto do próximo import. **Recomendação:** A — mesmo padrão do C155 e do `recover-media`. _(assumido)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): N/A — sem UI
- `docs/plans/backfill-acervo-falas.md` (C155 — import/cobertura) · `docs/plans/acervo-videos-comunicacao.md` (C154 — acervo)
- `docs/ops/teqo-1313-deploy.md` §C155 (execução em produção) · `scripts/recover-media.mjs` (precedente de reparo com guard)
- Arquivos-chave para o executor abrir primeiro: `scripts/import-camara-speeches.mjs`, `scripts/lib/camaraSpeeches.mjs`, `scripts/lib/camaraFetch.mjs`, `scripts/lib/cli.mjs`, `src/components/campaign/speech/SpeechResultCard.tsx`, `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`
- `AGENTS.md` — rotas `/campanha`, guardrails de escrita em produção e crédito CC BY.
