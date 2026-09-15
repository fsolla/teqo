---
name: relatorio-cidade
description: 'Gera o relatório de cidade pré-viagem (PDF A4 + .md) a partir da base Teqo read-only + pesquisa web datada + emendas oficiais.'
---

# Relatório de cidade pré-viagem (C163)

Entrega um **PDF A4 datado + companion `.md`** por município, cruzando a base de
produção do Teqo (**read-only**, snapshot do momento) com pesquisa web (data +
URL por item) e emendas lidas da fonte oficial **em tempo de geração**. Página 1
= resumo de uma olhada; páginas 2+ = aprofundamento; tudo sem fonte vira
**lacuna explícita** — nunca inferência.

## Quando usar

- O candidato/CG pede "o relatório de <cidade>" antes de uma viagem.
- Quem executa é o agente (pesquisa web + escrita dos JSONs) + os dois scripts
  (`extract` no homeserver, `build` local). O PDF sai para leitura de bolso.

## Pipeline (3 passos)

1. **Slug canônico.** O município é sempre um slug do catálogo
   (`src/lib/municipalityCatalog.ts`, 435 unidades; Salvador = `salvador-ze-N`).
   Não invente slug: confirme no catálogo (`pnpm exec tsx -e` ou a lista em
   `/campanha/municipios`).
2. **Pesquisa web → `data/relatorios-cidade/<slug>.research.json`.**
   Cada item do checklist com `sourceUrl` + `sourceDate`; sem fonte, **não
   escreva o item** (ele vira lacuna). Notícias: janela ≤90 dias.
3. **Extração read-only no homeserver** (receita completa no runbook
   `docs/ops/teqo-1313-deploy.md` §"C163 — relatório de cidade"):
   ```bash
   ssh homeserver
   source ~/.nvm/nvm.sh
   cd ~/teqo-report && git fetch origin main && git checkout main && git pull --ff-only
   [ -d node_modules/tsx ] || pnpm install --prod=false
   set -a; source ~/stack/teqo-1313.env; set +a
   export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5433}"
   export CITY_REPORT_CONFIRM=1
   NODE_OPTIONS="--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs" \
     node scripts/extract-city-report-snapshot.mjs \
       --municipality=<slug> --out=data/relatorios-cidade/<slug>.snapshot.json
   ```
   Depois `scp homeserver:~/teqo-report/data/relatorios-cidade/<slug>.snapshot.json data/relatorios-cidade/`.
   O `~/teqo-report` é checkout de **scratch** — não use `~/teqo-deploy` (deploy
   em andamento no mesmo host). O SHA do extrator e do builder devem ser o mesmo.
4. **Render local:**
   ```bash
   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-city-report.mjs \
     --snapshot=data/relatorios-cidade/<slug>.snapshot.json \
     --research=data/relatorios-cidade/<slug>.research.json \
     --out-dir=docs/research/relatorios-cidade
   ```
   Saídas: `docs/research/relatorios-cidade/<slug>-<YYYY-MM-DD>.pdf` + `.md`
   (companion revisável em diff). Intermediários gitignored em
   `data/relatorios-cidade/` (HTML, JSONs de emendas).
   Flags úteis: `--emendas=<json>` (replay sem rede), `--author=<nome>`
   (default `JORGE SOLLA`), `--generated-at=<ISO>` (reprodutibilidade),
   `CITY_REPORT_STRICT=1` (falha o run se houver lacuna de pesquisa — para
   conferência, não para entrega).

## Contrato dos JSONs

`research.json`:

```jsonc
{
  "municipalitySlug": "feira-de-santana",       // tem de bater com o snapshot
  "researchedAt": "2026-09-15T10:00:00.000Z",   // obrigatório
  "items": [
    {
      "id": "prefeito",             // id do checklist (abaixo)
      "answer": "Nome (Partido), situação",
      "details": "opcional",
      "sourceUrl": "https://…",     // obrigatório em item publicado
      "sourceDate": "2026-09-10",   // obrigatório
      "extraSources": [             // opcional; cada uma exige url+date
        { "label": "Polo regional", "url": "https://…", "date": "2026-09-01" }
      ],
      "consultedAt": "2026-09-15T09:00:00.000Z" // opcional
    }
  ],
  "news": [
    {
      "title": "…", "outlet": "…",
      "publishedAt": "2026-09-01T00:00:00.000Z", // janela ≤90 dias do researchedAt
      "url": "https://…", "summary": "…"
    }
  ],
  "approach": [                    // sugestões das personas; tema+texto+fonte
    {
      "persona": "Ciência política",   // ou "Coordenação de campanha"
      "topic": "Saúde regional (polo)",
      "suggestion": "…",
      "sourceUrl": "https://…", "sourceDate": "2026-04-07"
    }
  ],
  "preCandidates": [               // prováveis candidatos do campo do prefeito em 2026
    {
      "name": "…", "office": "Deputado federal", "party": "PSDB",
      "support": "Campo do prefeito …",
      "sourceUrl": "https://…", "sourceDate": "2026-04-18"
    }
  ],
  "leaders": [                     // últimos prefeitos/vices, vereadores mais votados
    {
      "name": "…", "role": "Ex-prefeito", "party": "PSDB", "period": "2017–2024",
      "sourceUrl": "https://…", "sourceDate": "2024-08-14"
    }
  ],
  "demography": [                  // cor/raça e poder aquisitivo (Censo 2022)
    {
      "topic": "Cor/raça (Censo 2022)", "detail": "Parda 73,1% …",
      "sourceUrl": "https://sidra.ibge.gov.br/tabela/9605", "sourceDate": "2026-09-15"
    }
  ],
  "economy": [                     // PIB, emprego, atividades (IBGE/RAIS e imprensa)
    { "topic": "PIB e perfil", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "transport": [                   // rodovias, aeroporto, portos, ferrovia
    { "topic": "Rodovia federal (BR-101)", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "gaps": [{ "id": "…", "label": "…", "reason": "…" }] // lacunas que o agente já sabe
}
```

Checklist (`id`s): `prefeito`, `vice`, `relacao_campo`, `vereadores`,
`disputa_local`, `quem_investe`, `noticias`, `imprensa_local`, `emendas_web`.
Item sem `sourceUrl`/`sourceDate` é convertido em lacuna pelo validador; item
ausente também. `approach`, `preCandidates` e `leaders` são listas de pesquisa:
cada entrada sem fonte vira lacuna (`abordagem_sem_fonte`,
`precandidato_sem_fonte`, `lideranca_sem_fonte`) e não entra no PDF.

**`emendas_web` — indícios de emenda (município, região ou polo):** quando a
fonte oficial não atribui emenda ao município, pesquise artigos, falas e
indicações de emenda para (a) o município, (b) a região/Território de
Identidade e (c) a maior cidade próxima (polo regional — cidades pequenas usam
serviços do polo). Registre cada indício com URL+data; use `extraSources` para
mais de uma fonte. O PDF mostra o item como "Emendas — indícios web" na página
1 e as URLs na seção de fontes. **Nunca somar** indício de região/polo como
emenda da cidade.

**Demografia, economia e transporte (pesquisa):** `demography`, `economy` e
`transport` são listas de `{topic, detail, sourceUrl, sourceDate}` (sem fonte →
lacuna). Pesquise: **cor/raça e rendimento** (Censo 2022 — SIDRA 9605 e 10295;
IBGE Cidades para salário médio); **economia** (PIB e PIB per capita — IBGE
Cidades; composição setorial e emprego formal — RAIS/CAGED e perfis regionais;
café, pecuária e comércio no caso do Extremo Sul); **transporte** (rodovias
federais/estaduais que cortam o município e obras novas/reformadas — DNIT,
Seinfra; aeroporto mais próximo em operação e o do polo, com situação; portos e
ferrovia da região — FIOL/Porto Sul, deixando claro quando não serve
diretamente a cidade). O enquadramento é "onde falta × onde o estado e a União
têm acertado" — o candidato é da base.

**Emendas oficiais:** sem `--emendas`, o builder consulta o Portal da
Transparência (`PORTAL_TRANSPARENCIA_API_KEY` no ambiente; sem chave → lacuna).
A API oficial **não filtra por município** (só UF/Nacional/Múltiplo na
`localidadeDoGasto`); o builder casa pela localidade com o nome do município e,
sem linha atribuível, degrada para lacuna (Issue #1025). O resultado fica
cacheado em `data/relatorios-cidade/<base>.emendas.json` para replay.

## Conteúdo do relatório

- **Página 1 (uma olhada):** identificação/prioridade/classe/nível, conta
  eleitoral 2022 (votos, % do próprio voto, rank/435) **+ expectativa de votos
  (cenário central com pessimista/otimista)** — a meta de cadeira e a cobertura
  de pledges **saíram** da página 1; quem é quem (prefeito, vice, relação com o
  campo, lideranças, dobradinhas, vereadores), o que Solla entregou (emendas
  oficiais com fase, acervo de falas, notícias ≤90 dias), **indícios web de
  emendas** quando a fonte oficial não atribui ao município, anunciar × não
  anunciar, riscos e pontos sem leitura.
- **Seções 2+:** `1. Conta eleitoral` · `2. Concorrentes no município (federal
  e estadual)` — top 5 por votos de 2022 na base TSE, com série 2014/2018/2022
  e os prováveis candidatos do campo do prefeito (pesquisa) · `3. Rede e
  lideranças` — inclui as lideranças locais pesquisadas (ex-prefeitos/vices,
  vereadores mais votados, com partido) · `4. Conjuntura` · `5. Sinais` · `6.
  Demandas e visitas` · `7. Demografia` — IBGE Censo 2022 do artefato +
  **complemento pesquisado** (cor/raça e poder aquisitivo) · `8. Atividade
  econômica (pesquisa)` · `9. Transporte e conexões (pesquisa)` · `10. Acervo
  de falas` — cada fala com "O que é" (sumário oficial) e "Menção ao município"
  (passagem que cita a cidade ou, se o nome não aparece nos trechos, a marcação
  do acervo com o nº de municípios) · `11. Notícias e imprensa` · `12. Panorama
  regional` · `13. Abordagem sugerida (personas)` · `14. Fontes e limites`.
- **Links clicáveis:** todo URL no PDF é um link (`<a href>`): células de
  tabela, fontes por linha e a seção de fontes.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem data+URL não entra.
- **Empenho ≠ pagamento** (defeso/ano eleitoral): o bloco de emendas mostra a
  fase (empenhada, liquidada, paga, restos) e o "anunciar × não anunciar" é fixo.
- **Leitura relativa**: % do próprio voto, rank, LQ — nunca % estadual absoluto.
- **PII mínima**: contatos completos (telefone/e-mail) nunca entram; nomes de
  lideranças entram porque o produto pede "quem é quem".
- **Completo para o candidato**: estimativas e nível N0–N4 entram no PDF, sem
  marca de restrição; o que não sai é para o palanque.
- **Indício regional não é emenda da cidade**: emendas do município, da região
  ou do polo entram rotuladas na evidência web e **nunca somadas**; a fonte
  oficial ausente continua lacuna explícita.
- **Abordagem é análise ancorada**: as sugestões das personas (governo do PT na
  região, projetos futuros, prioridades locais) saem do `approach` com fonte por
  item — sem fonte, não entra; o PDF deixa claro que é análise, não fato novo.
- **Artefato gitignored**: o repo é público; o PDF/MD com dado interno nunca é
  commitado (só a skill/scripts/changelog).

## Troubleshooting

- **Página 1 estourou**: o builder aborta com `scrollHeight > útil`; corte copy
  do resumo/`caps`, não mexa no layout para "espremer".
- **`tsx` ausente no homeserver**: `pnpm install --prod=false`.
- **API de emendas 429/erro**: o builder degrada para lacuna com URL+motivo;
  reexecute depois (o cache só é escrito com resultado utilizável).
- **Emenda sem atribuição oficial**: é o comportamento esperado (a API não
  expõe o município). Pesquise os indícios web (município/região/polo) no item
  `emendas_web`; sem indício, a lacuna fica explícita — nunca zero silencioso.
- **Chromium**: vem do `@playwright/test`; se faltar binário,
  `pnpm exec playwright install chromium`.
- **Snapshot de outro município**: o builder recusa (`municipalitySlug` ≠
  snapshot) — regenere, nunca edite o JSON à mão para "casar".

## Referências

- Intenção: `docs/plans/relatorio-cidade-viagem.md`; impl:
  `docs/plans/relatorio-cidade-viagem-impl.md`.
- Precedente de PDF: `scripts/build-solla-ceuci-salvador-report.mjs` (C157).
- Runbook: `docs/ops/teqo-1313-deploy.md` §C163.
