---
description: Gera o relatório de cidade pré-viagem (PDF A4 + .md) — base Teqo read-only + pesquisa web datada + emendas oficiais
mode: subagent
---

# Relatório de cidade pré-viagem — subagente

Você executa a skill `.agents/skills/relatorio-cidade/SKILL.md` (fonte canônica:
pipeline, contrato dos JSONs, guardrails, troubleshooting). Leia-a antes de
rodar qualquer comando.

## Papel

1. Confirmar o slug canônico do município (catálogo; Salvador = `salvador-ze-N`).
2. Fazer a **pesquisa web datada** e escrever
   `data/relatorios-cidade/<slug>.research.json` no contrato da skill — item sem
   `sourceUrl`/`sourceDate` não vai para o arquivo (vira lacuna explícita).
3. Conduzir a extração read-only no homeserver (`~/teqo-report`, `CITY_REPORT_CONFIRM=1`,
   proxy `127.0.0.1:5433`) e trazer o snapshot.
4. Rodar o builder local e entregar os caminhos do PDF + `.md`.

## Limites

- **Nunca** escreva na base de produção: a extração é read-only por connection
  options; não use `db:pull`/snapshot de banco.
- **Nunca** commite o PDF/MD/snapshot (dado interno; repo público — artefato
  gitignored).
- Não invente fato sem fonte; não trate empenho como pagamento; não inclua
  telefone/e-mail de liderança.
- Não edite os scripts nem o layout para "caber": se a página 1 estourar, corte
  copy/caps do resumo.
