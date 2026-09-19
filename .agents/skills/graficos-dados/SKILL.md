---
name: graficos-dados
description: 'Transforma números que a comunicação recebeu (xlsx/csv/md/txt/texto colado) num gráfico PNG pronto para o Instagram — 1080×1350 feed, 1080×1080 quadrado ou 1080×1920 stories — com a paleta Jorge Solla, título-manchete, um único destaque de cor e guardrails de correção; dado ambíguo vira pergunta, nunca invenção.'
---

# Gráficos de dados para Instagram (C191)

Entrega **um gráfico PNG** por invocação, no tamanho do Instagram e com a cara
do mandato, a partir do dado **como ele veio** — planilha, CSV, markdown ou
texto solto colado no comando. A skill lê, entende a **relação** dos dados
(comparação, tempo, parte-de-um-todo, número único), **propõe o tipo** correto,
gera a peça com **título-manchete** e **um destaque vermelho**, e deixa a
comunicação transformar o gráfico no material final (legenda, carrossel,
contexto). É a **base visual confiável**, não a peça acabada.

O template visual é o artefato aprovado
`docs/plans/graficos-dados-instagram-ui-design.html`; o renderer
(`scripts/lib/graficosInstagramRender.mjs`) porta esse design classe-a-classe.
**Nunca invente estrutura visual** — o dono é o `designer`.

## Quando usar

- A comunicação pede "um gráfico disso", "transforma essa planilha em post",
  "faz um gráfico para o Instagram" — e fornece os números (arquivo ou colado).
- **Não** use para: limpar/interpretar estatisticamente os dados, escrever a
  legenda/carrossel, publicar/agendar, gerar dossiê/relatório em PDF (irmãos
  C163/C186/C187) ou montar dashboard interativo. A skill **representa** o dado;
  não o interpreta.

## Fluxo

1. **Receba o dado.** Texto colado → grave em
   `data/graficos-instagram/<slug>-input.txt` (o diretório é gitignored) e aponte
   com `--in=`. Arquivo → aponte o caminho direto (`xlsx`, `xls`, `csv`, `tsv`,
   `md`, `txt`).
2. **Inspecione antes de desenhar:**
   ```bash
   node scripts/build-chart-from-data.mjs --in=<arquivo> --inspect
   ```
   Devolve `{ rows, series, format, issues }` — a matriz parseada (tabela com
   2+ colunas de medida vira `series`) e os problemas.
3. **Decida o tipo e a copy.** A relação dos dados manda:
   - **ranking / comparação → `bar`** (barras horizontais, ordenadas pelo valor,
     rótulo direto e valor na ponta);
   - **poucos períodos (≤4) → `column`** (base zero comum);
   - **série de tempo contínua → `line`** (ponto final destacado);
   - **duas séries no mesmo período → `line` multi-série**: tabela com 2 colunas
     de medida e a primeira coluna temporal; `--good=`/`--bad=` marcam a valência
     bom/ruim (par ou nenhum), `--projected=` marca o último período projetado e
     `--crossing=<período>` confirma a ultrapassagem que ganha anotação;
   - **uma única medida → `anchor`** (número grande + frase que explica).
   Ambíguo (mais de um tipo plausível) → **pergunte**; não escolha no escuro.
   Escreva a **manchete = takeaway** (não "Gráfico de X"), subtítulo opcional e a
   **fonte** (viaja dentro da imagem).
4. **Gere o PNG:**
   ```bash
   node scripts/build-chart-from-data.mjs --in=<arquivo> \
     --headline="Um território concentra o maior resultado do período" \
     --subtitle="Valores de 2022" \
     --source="TSE 2022" --type=bar --size=feed \
     --highlight="Ilhéus"
   ```
   Duas séries no tempo (valência bom/ruim + projeção no último ponto):
   ```bash
   node scripts/build-chart-from-data.mjs --in=<arquivo> \
     --headline="Internações crescem no hospital estadual e recuam no municipal" \
     --source="Ministério da Saúde — SIH/SUS" \
     --note="2026 é projeção pela média de janeiro a junho × 2." \
     --type=line --size=feed \
     --good="Estadual" --bad="Municipal" --projected=2026 --crossing=2024
   ```
   Saída default: `docs/research/graficos-instagram/<slug>-<data>-<size>.png`
   (gitignored) + o `chart-spec.json` em `data/graficos-instagram/`. `--size`:
   `feed` (1080×1350, default), `square` (1080×1080), `story` (1080×1920, com
   faixas seguras de 250px no topo e na base). `--out=` sobrescreve o caminho.
5. **Confira e ajuste.** A pessoa confere o PNG; ajuste tipo/rótulo/manchete/
   tamanho/`--highlight` (ou `--good`/`--bad`/`--projected`/`--crossing`) e
   regenere. **Replay** sem reparse: `--spec=<chart-spec.json>`.
6. **Entregue o gráfico.** A comunicação finaliza a peça. O dado não persiste.

## Contrato do `chart-spec.json`

```json
{
  "chartType": "bar",
  "size": "feed",
  "headline": "Um território concentra o maior resultado do período",
  "subtitle": "Valores de 2022",
  "source": "TSE 2022",
  "note": "valores arredondados",
  "highlight": "Ilhéus",
  "rows": [{ "label": "Ilhéus", "value": 84 }]
}
```

Na linha de 2 séries, `series` substitui `rows` e `projectedLabel` marca o
último período projetado:

```json
{
  "chartType": "line",
  "size": "feed",
  "headline": "Internações crescem no hospital estadual e recuam no municipal",
  "source": "Ministério da Saúde — SIH/SUS",
  "projectedLabel": "2026",
  "crossingLabel": "2024",
  "series": [
    { "name": "Estadual", "tone": "good", "rows": [{ "label": "2017", "value": 9807 }] },
    { "name": "Municipal", "tone": "bad", "rows": [{ "label": "2017", "value": 24002 }] }
  ]
}
```

`chartType` ∈ `bar | column | line | anchor`; `highlight` é o rótulo que recebe o
único vermelho `#c51414` (default: o maior valor). Em `series`, `tone` ∈
`good | bad` (os dois tons ou nenhum) e as duas séries compartilham os mesmos
rótulos temporais; `rows` e `highlight` não entram nessa variante.
`projectedLabel` marca a projeção no último período e `crossingLabel` só é aceito
quando a série boa de fato ultrapassa a ruim naquele período (confirmação
textual, nunca inferência automática). Os rótulos finais trazem a variação
observada (primeiro → último ponto observado, fora a projeção).

## Guardrails (fail-closed)

O builder **recusa** em vez de desenhar algo enganoso:

- **Barras e colunas partem do zero**; valor negativo é recusado; sem 3D/eixo
  truncado.
- **Até 7 pontos** por gráfico (barra, coluna e linha simples); a **linha de 2
  séries** comporta **até 12 pontos por série**, sempre com os mesmos rótulos
  temporais alinhados. Em **stories**, o ranking comporta **até 5** pontos (a
  adaptação vertical reduz um ponto, conforme o design aprovado). Acima disso,
  resuma as categorias e explique.
- **Valência só na linha de 2 séries**, em par (`good`/`bad`) e sempre por
  palavra + seta + forma do marcador + cor — **cor nunca carrega sozinha**:
  bom = vermelho `#c51414`, círculo, "↑ amplia" (o vermelho é a cor do
  mandato/PT e nunca marca a perda); ruim = cinza `#78716c`, quadrado,
  "↓ recua". Sem tons, a comparação é neutra: sem setas, sem palavras de
  valência e **sem vermelho no plot**.
- **Projeção** (`--projected=`) só no último período das duas séries: último
  segmento tracejado, marcador final vazado e nota do método; sem projeção não
  há faixa, tracejado nem ressalva automática.
- **Cruzamento** (`--crossing=<período>`) só com confirmação textual e quando a
  série boa realmente ultrapassa a ruim naquele período; a anotação nunca é
  inferida sozinha.
- **Número-âncora:** a manchete é o takeaway (não repete o número) e o valor
  aparece uma vez, grande, seguido da frase que explica.
- **Pizza não é gerada no v1** — pedido `pie` é recusado com sugestão de barras.
- **Dado faltando/ambíguo → pergunta, nunca completa.** O builder sai com
  `{ needsQuestion: true, issues: [...] }` e não gera imagem.
- **Sem fonte, sem peça:** `--source` é obrigatório.
- Legibilidade: headline ≥48px e rótulos ≥30px no canvas 1080; contraste ≥4.5:1
  no texto e ≥3:1 nas marcas; **cor nunca é a única pista** (o destaque tem
  valor e posição).
- **Dado de campanha nunca sai da máquina:** render 100% local, sem MCP/serviço
  remoto por default.
- **Nada é commitado:** entrada, `chart-spec` e PNG vivem em
  `data/graficos-instagram/` e `docs/research/graficos-instagram/`, ambos
  gitignored (repo público).

## Troubleshooting

- **"dado ambíguo ou faltando"** → leia `issues` no JSON de saída: linha sem
  rótulo, valor não numérico, rótulo repetido. Pergunte à pessoa; não invente.
- **"N pontos (> 7)"** → agrupe/remova categorias com a pessoa. Na linha de 2
  séries o teto é 12 por série.
- **Séries desalinhadas / tom ímpar / projeção fora do último ponto /
  cruzamento não confirmado** → o builder pede a correção com mensagem
  acionável; nunca interpola, completa nem infere ultrapassagem.
- **"pizza não é gerada"** → ofereça barras horizontais.
- **Número pt-BR:** `1.234,56` é lido como 1234,56; `1,5` como 1,5.
  **Separador único é sempre decimal:** `1.234` é lido como 1,234 e `1.500`
  como 1,5 — para milhar, escreva os dois separadores (`1.234,56`) ou nenhum
  (`1234`). Separador repetido (`1.234.567`) é recusado como não numérico.
- **PNG grande:** a guarda de 8MB falha fechado; simplifique o gráfico.

## Referências

- Design aprovado: `docs/plans/graficos-dados-instagram-ui-design.html` (inclui
  a variação certificada de linha de duas séries, com valência bom/ruim).
- Plano de intenção: `docs/plans/graficos-dados-instagram.md`; impl:
  `docs/plans/graficos-dados-instagram-impl.md`.
- Irmãos (mesmo padrão skill + command + builder local): C186/C187.
