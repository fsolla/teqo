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
  "gaps": [{ "id": "…", "label": "…", "reason": "…" }] // lacunas que o agente já sabe
}
```

Checklist (`id`s): `prefeito`, `vice`, `relacao_campo`, `vereadores`,
`disputa_local`, `quem_investe`, `noticias`, `imprensa_local`, `emendas_web`.
Item sem `sourceUrl`/`sourceDate` é convertido em lacuna pelo validador; item
ausente também.

Emendas: sem `--emendas`, o builder consulta o Portal da Transparência
(`PORTAL_TRANSPARENCIA_API_KEY` no ambiente; sem chave → lacuna). O resultado
fica cacheado em `data/relatorios-cidade/<base>.emendas.json` para replay.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem data+URL não entra.
- **Empenho ≠ pagamento** (defeso/ano eleitoral): o bloco de emendas mostra a
  fase (empenhada, liquidada, paga, restos) e o "anunciar × não anunciar" é fixo.
- **Leitura relativa**: % do próprio voto, rank, LQ — nunca % estadual absoluto.
- **PII mínima**: contatos completos (telefone/e-mail) nunca entram; nomes de
  lideranças entram porque o produto pede "quem é quem".
- **Completo para o candidato**: estimativas e nível N0–N4 entram no PDF, sem
  marca de restrição; o que não sai é para o palanque.
- **Artefato gitignored**: o repo é público; o PDF/MD com dado interno nunca é
  commitado (só a skill/scripts/changelog).

## Troubleshooting

- **Página 1 estourou**: o builder aborta com `scrollHeight > útil`; corte copy
  do resumo/`caps`, não mexa no layout para "espremer".
- **`tsx` ausente no homeserver**: `pnpm install --prod=false`.
- **API de emendas 429/erro**: o builder degrada para lacuna com URL+motivo;
  reexecute depois (o cache só é escrito com resultado utilizável).
- **Chromium**: vem do `@playwright/test`; se faltar binário,
  `pnpm exec playwright install chromium`.
- **Snapshot de outro município**: o builder recusa (`municipalitySlug` ≠
  snapshot) — regenere, nunca edite o JSON à mão para "casar".

## Referências

- Intenção: `docs/plans/relatorio-cidade-viagem.md`; impl:
  `docs/plans/relatorio-cidade-viagem-impl.md`.
- Precedente de PDF: `scripts/build-solla-ceuci-salvador-report.mjs` (C157).
- Runbook: `docs/ops/teqo-1313-deploy.md` §C163.
