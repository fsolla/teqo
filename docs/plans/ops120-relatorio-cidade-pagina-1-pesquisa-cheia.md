# OPS120 — relatório de cidade: página 1 sob pesquisa cheia (C163)

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1069
Priority: P2
Impeccable: A — ajuste de conteúdo/orçamento do PDF (sem UI de app)
Rascunho UI: N/A — sem UI
Appetite: ~1 dia eng
Responsável: —

## Intenção

No caminho normal do relatório (checklist de pesquisa cheio + notícias ≤90 dias), a
página 1 estoura o guard do builder — `A página 1 estourou (1110px > 1001px úteis)`
(`data/relatorios-cidade/logs/itacare.build.log`, tracer da OPS118) — e o PDF não é
gerado. O guard e a composição da página 1 vêm do C163 (#1007); a OPS118 (#1065)
expôs o caso ao rodar N cidades com pesquisa real (o troubleshooting atual manda
"corte copy/caps", mas a página 1 é montada de dados — não há knob de corte exposto).

## Objetivo e aceite

- Cidade com o checklist de pesquisa cheio (9 itens) + notícias ≤90 dias gera PDF+MD
  sem estourar a página 1.
- O corte é por **teto/orçamento de conteúdo** na página 1 (não espremer layout):
  notícias e "quem é quem" com cap explícito + `totalCount`, no padrão dos caps do
  E16 — o aprofundamento continua nas seções 2+.
- Se ainda estourar, o erro segue fail-closed e acionável.
- Sem regressão no relatório de cidade pequena/sem pesquisa.

## Fora de escopo

- Mudar layout/identidade do PDF, criar seção nova ou agregar lote.
- A atribuição de emenda a município (#1025).

## Fases (ordem de entrega)

1. Medir o que compõe a página 1 com pesquisa cheia e definir os tetos (notícias /
   quem é quem / resumo) com `totalCount`.
2. Aplicar os tetos na composição e no render, mantendo a guarda de página 1.
3. Prova local (Ilhéus/Itacaré/Una com pesquisa cheia) + gates.

## Verificação

- Rebuild local do tracer com pesquisa cheia → par PDF+MD, página 1 em 1 página.
- Cidade com base vazia continua gerando (sem seção inventada).

## Riscos

- Cortar notícia/liderança demais empobrece a página 1 — mostrar "Mostrando X de Y" e
  preservar o detalhe nas seções 2+.

## Referências

- Issues #1007 (C163) · #1065 (OPS118).
- `scripts/build-city-report.mjs` (guarda de página 1, `PAGE_ONE_BUDGET_PX`).
- `scripts/lib/cityReportBlocks.mjs` (composição da página 1) — hipótese a confirmar.
- `data/relatorios-cidade/logs/itacare.build.log` (evidência).
