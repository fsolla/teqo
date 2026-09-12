# Piloto da fonte: vídeos e transcrição minutada de discursos da Câmara

Status: concluído — piloto de viabilidade
Atualizado em: 2026-09-12
Issue: [#954](https://github.com/fsolla/teqo/issues/954) (C152)
Intenção: [`docs/plans/piloto-fonte-videos-camara.md`](../plans/piloto-fonte-videos-camara.md)
Impl: [`docs/plans/piloto-fonte-videos-camara-impl.md`](../plans/piloto-fonte-videos-camara-impl.md)
Script: [`scripts/pilot-camara-speeches.mjs`](../../scripts/pilot-camara-speeches.mjs) + [`scripts/lib/camaraSpeeches.mjs`](../../scripts/lib/camaraSpeeches.mjs)

Relatório de engenharia: responde as quatro incógnitas que decidem o desenho do acervo de falas (C153) antes de modelar banco, import e tela. **Nada foi escrito em banco**; mídia e JSON ficam em `data/camara/` (gitignored).

## Como reproduzir

```bash
# requer DEEPINFRA_API_KEY no .env.local ou no env do processo
pnpm camara:pilot --legislature 57 --limit 1
pnpm camara:pilot --date 2016-03-10 --skip-transcribe   # só resolve o VOD
```

O script escolhe o discurso, casa o evento do dia, acha o trecho do orador na página do evento, polla a geração assíncrona do VOD, baixa o MP4 e transcreve com segmentos. Os artefatos vão para `data/camara/` (MP4 + `pilot-report.json`).

## Discursos processados ponta a ponta

| Legislatura | Discurso         | Sessão                             | Trecho do orador                   | VOD             | MP4     | ASR (segmentos) | Custo ASR    |
| ----------- | ---------------- | ---------------------------------- | ---------------------------------- | --------------- | ------- | --------------- | ------------ |
| 57ª (2023)  | 2023-02-07T17:28 | Sessão Deliberativa (evento 67091) | `a=558641` `t=1675801808560` 17:30 | PRONTO, 1 poll  | 20,3 MB | 43 (252,0 s)    | ~US$ 0,00189 |
| 56ª (2021)  | 2021-02-24T16:16 | Outro Evento (evento 60430)        | `a=545023` `t=1614194341593` 16:19 | PRONTO, 1 poll  | 22,9 MB | 62 (284,0 s)    | ~US$ 0,00213 |
| 55ª (2016)  | 2016-03-10T09:28 | Sessão Deliberativa (evento 43106) | `a=55709` `t=1457612936930` 09:28  | PRONTO, 2 polls | 4,4 MB  | 16 (83,1 s)     | ~US$ 0,00062 |
| 54ª (2013)  | 2013-09-04T15:45 | Comissão Geral "Mais Médicos"      | **não há** (0 âncoras de trecho)   | —               | —       | —               | —            |

O `tipoDiscurso`/`faseEvento` vêm da API de discursos; o trecho, da página do evento.

## As quatro incógnitas

### 1. Os links de vídeo por discurso são permanentes?

**Não existe link por discurso**: `urlVideo` e `urlAudio` vêm nulos e `uriEvento` vem vazio na API de discursos. O vídeo é derivado em duas etapas:

- `GET https://www.camara.leg.br/evento-legislativo/{evento}/video-sob-demanda?idAudio={a}&trecho={t}` devolve `{ estado, video }` — **geração assíncrona** no servidor de VOD (`GERANDO` → `PRONTO`), não um download síncrono. O primeiro request de um trecho novo pode levar ~30 s e retorna `GERANDO`; os seguintes (a cada ~5 s) retornam `PRONTO` em 1–2 polls.
- Quando `PRONTO`, o `video.linkParaDownload` aponta para `https://vod.camara.leg.br/vod/download?p=<hash>.mp4`, que respondeu **200 sem cookie nem sessão** (2026-09-12).

**Evidência de permanência:** o mesmo `<hash>` foi devolvido em requests separados por >15 min (2023: `a7b49fbccf69a58965f8f25377fe9a97`; 2016: `2c102e9a69704b5e7edb780f934000a2`), e o MP4 baixou consistentemente. **Recomendação:** tratar o link como **regerável e determinístico**, não como asset imutável — persistir `evento`+`idAudio`+`trecho` e re-resolver via `video-sob-demanda` quando precisar baixar de novo. Um teste de permanência de longa duração (semanas) não foi feito.

### 2. Sessões antigas (2011–2015) têm trechos por orador?

**Depende da legislatura.** A página do evento lista os trechos por orador (âncoras server-rendered com `a`/`t`) e o Solla aparece:

- **55ª (2016)** e **56ª (2021)**: sim — 248 e 262 âncoras na página, com o trecho do Solla (1:21 e 4:40).
- **54ª (2011–2015)**: não. O único discurso do período na API (Comissão Geral "Mais Médicos", 2013-09-04) não tem trecho: a página do evento 33397 tem **0 âncoras** e nenhuma menção ao orador — e o evento também não tem `urlRegistro` (YouTube), então não há nem fallback.

O volume do período também é praticamente nulo para este deputado (1 discurso em 2011–2015, contra 362/414/234 em 55ª/56ª/57ª, conforme a pesquisa do planejamento). **Conclusão:** a cobertura útil começa em 2015; C153/C155 não devem contar com 54ª.

### 3. A transcrição via Deep Infra devolve segmentos com minutagem?

**Sim, no endpoint compatível, e sem ffmpeg.** Funcionou de primeira:

```
POST https://api.deepinfra.com/v1/openai/audio/transcriptions
  model=openai/whisper-large-v3  language=pt
  response_format=verbose_json   timestamp_granularities[]=segment
  file=<o próprio MP4 do trecho, video/mp4>
→ { text, language: "pt", duration, segments: [{ start, end, text }, …] }
```

Retornou `segments[]` com `start`/`end` numéricos nos três discursos (43/62/16 segmentos) e **aceitou o MP4 direto** — o container de vídeo não precisa de extração de áudio. O endpoint nativo (`chunk_level`) e a instalação de `ffmpeg` **não foram necessários** (o repo e a imagem não têm ffmpeg). O `deepInfraTranscribe.ts` do app não serve: é `server-only`, devolve só `{ text }` e não expõe timestamps.

### 4. O casamento discurso ↔ evento ↔ trecho funciona em anos antigos?

**Sim, por data/hora.** Como `uriEvento` vem vazio, o casamento é: discurso → eventos do mesmo dia (ordenados por proximidade do horário) → âncoras da página do evento → trecho cujo `titulo` normalizado bate com o orador e cujo horário é o mais próximo. Funcionou em 55ª/56ª/57ª. A única falha foi o caso de 2013, explicada por ausência de trecho (não por erro de casamento).

**Custo do casamento:** quando o dia não tem trecho, o script varre todos os eventos do dia até achar — em 2013 foram ~44 páginas de evento (~50 s). C153 deve priorizar os tipos `Sessão Deliberativa`/`Breves Comunicações` e abortar cedo em vez de varrer tudo.

## Custos e tempos medidos

- **Transcrição (Deep Infra, whisper-large-v3):** US$ 0,00045/min. Medido: US$ 0,00062 (1:21), US$ 0,00189 (4:02), US$ 0,00213 (4:40). Para o acervo 54ª–57ª (≈1.011 discursos, ~4 min médios ≈ 67 h) a ordem de grandeza é **~US$ 1,80** — irrelevante.
- **Tempo de transcrição:** ~11–19 s por trecho de 1–5 min (≈4–5× tempo real); o upload de ~20 MB é o que domina.
- **Geração do VOD:** 1–2 polls (~5–35 s na primeira vez de cada trecho).
- **Download do MP4:** ~3 s para ~20 MB.
- **Ponta a ponta por discurso:** ~35–40 s (incluindo busca de evento e transcrição).

## Fallbacks recomendados (por incógnita)

1. **Link/permanência:** não persistir a URL do MP4; persistir `evento`+`idAudio`+`trecho` e re-resolver por `video-sob-demanda`. Se `INDISPONIVEL`, cair para o YouTube do evento com offset `t/1000 − startTimestamp` (`urlRegistro`); sem `urlRegistro`, marcar "sem vídeo".
2. **Sessão sem trecho:** idem acima; em 2011–2015 a resposta é "não cobre" (documentado, não é falha).
3. **Segmentos ASR:** compat `verbose_json` funcionou; fallback raro = endpoint nativo (`chunk_level: segment`); último recurso = extrair áudio com `ffmpeg` (não foi preciso).
4. **Casamento ambíguo:** usar `faseEvento`/tipo do discurso e validar o nome normalizado; limitar a varredura a tipos de sessão relevantes.

## Limitações e armadilhas observadas

- **Anti-crawl:** a URL de trecho `?a=…&t=…&trechosOrador=&crawl=no` responde **400 "Acesso via bot não permitido"** a User-Agent de curl. O caminho que funciona é a página do evento (200, UA de browser) + o JSON de `video-sob-demanda`; não foi preciso copiar cookies.
- **Conteúdo inicial do recorte:** o MP4 do trecho começa alguns segundos antes do orador (captura o fim da fala anterior). Para citar com precisão, recortar pelo `start` do primeiro segmento ASR após o início real, ou cruzar com o horário do trecho.
- **Data/hora sem timezone:** as datas da API e o `horario` do trecho são hora local de Brasília; o casamento foi feito por hora-do-dia, sem conversão.
- **Sem espelhamento de mídia:** os vídeos continuam servidos pela Câmara (C154/C155).
- **Licença:** as transmissões de atividades legislativas da Câmara são **CC BY 4.0**; crédito obrigatório e marca-d'água intocada.

## Recomendações para C153

- Modelar o discurso com `evento`+`idAudio`+`trecho` (chave natural) e re-resolver o MP4 sob demanda, nunca guardar a URL do VOD como identidade.
- Reusar a lógica pura de `scripts/lib/camaraSpeeches.mjs` (parser de âncoras, matching, offset YouTube, normalização de segmentos) no import idempotente.
- Assumir cobertura de trecho **2015+**; tratar 54ª como vazia.
- Priorizar tipos de sessão e cachear a página do evento para não varrer dezenas de páginas por dia.
- A transcrição oficial (taquigrafia) + segmentos ASR (minutagem) convivem: o texto oficial é a leitura; o ASR dá os `start/end`.

## Crédito

Vídeos e dados da Câmara dos Deputados — [dadosabertos.camara.leg.br](https://dadosabertos.camara.leg.br) e [camara.leg.br](https://www.camara.leg.br), licença CC BY 4.0.
