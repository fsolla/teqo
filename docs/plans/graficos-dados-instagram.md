# Gráficos de dados para Instagram (skill de comunicação)

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1145 (após `pnpm agent:register`)
Priority: P2
Impeccable: C — fluxo novo (skill/command + template visual do gráfico); não é UI de app, mas a superfície gráfica é o produto
Design UI: `docs/plans/graficos-dados-instagram-ui-design.html` (a produzir pelo `designer`) + assets em `docs/plans/graficos-dados-instagram-ui-design-assets/`
Appetite: ~2–3 dias eng; um outcome verificável — rodar a skill com uma planilha/texto e obter um gráfico PNG 1080×1350 com a paleta Solla
Responsável: —

## Intenção

A equipe de comunicação do mandato recebe números em planilha, CSV, doc, markdown ou texto solto e hoje transforma isso à mão em peça de rede — lento, e muitas vezes com gráfico feio ou enganoso. Este item dá a essa equipe uma skill que aceita o dado como ele veio e devolve um **gráfico pronto para compartilhar**, já no formato de Instagram e na paleta de Jorge Solla. A skill entrega o **gráfico**; a comunicação transforma o gráfico no material final (legenda, carrossel, contexto). É a base visual confiável, não a peça acabada.

## Persona e fluxo

- **Persona / contexto:** equipe de comunicação/mandato (social media, assessoria), na mesa ou no celular, sem tempo e sem formação em data viz; sabe o que quer comunicar, mas não deve ter que escolher tipo de gráfico, escala ou eixo.
- **Job principal:** numa invocação, transformar um punhado de números num gráfico claro, correto e "com a cara do mandato", no tamanho do Instagram.
- **Fluxo desejado:** cola os dados no comando ou aponta o arquivo → a skill lê, entende a relação dos dados (comparação, tempo, parte-de-um-todo, ranking) e propõe o gráfico adequado → gera o PNG com título-manchete, um destaque de cor e a paleta Solla → a pessoa confere, pede ajuste (tipo/rótulo/tamanho) e leva para a produção da peça.
- **Anti-goals de produto:** virar editor gráfico/dashboard; publicar direto nas redes ou agendar; limpar/interpretar estatisticamente os dados; inventar ou inferir dado/categoria sem fonte; persistir o dado; substituir os dossiês/relatórios em PDF; segundo pipeline irmão do renderer do dossiê.

### Esboço de fluxo (C)

```text
[cola dados no comando | aponta xlsx/csv/md/txt] → [skill lê e classifica a relação dos dados]
→ relação ambígua ou dado faltando → pergunta (nunca inventa)
→ [propõe tipo + gera HTML/SVG com paleta Solla] → [screenshot PNG 1080×1350] → [pessoa confere/ajusta]
→ [entrega o gráfico; comunicação finaliza a peça]
```

### Design UI (C)

- Design UI (gate): `docs/plans/graficos-dados-instagram-ui-design.html` — template do gráfico Instagram: capa, título-manchete, área de plot, rodapé de marca, área segura do grid (conteúdo crítico dentro de ~`1012×1350`) e variações por tipo essencial (barra, coluna, linha, número-âncora).
- A superfície é o **gráfico**, não tela de app; o artefato hi-fi é a fonte de verdade do port do template.

## Objetivo e aceite

- Rodar a skill com um arquivo/texto e obter **um gráfico PNG** (default `1080×1350`) legível, com a paleta Solla e a marca do mandato.
- O gráfico tem **título-manchete** (takeaway, não "Gráfico de X"), rótulos diretos, ordenação por valor e **um destaque de cor** sobre o resto neutro.
- O tipo é coerente com a relação dos dados; os tipos essenciais do v1 são barra, coluna, linha e número-âncora.
- Saída nos três tamanhos sob demanda: `1080×1350` (feed 4:5, default), `1080×1080` (quadrado) e `1080×1920` (stories/reels).
- Legibilidade no celular: rótulos ≥30px e headline ≥48px no canvas 1080; contraste ≥4.5:1 no texto e ≥3:1 nas marcas de dado; não codificar informação só por cor.
- Guardrails de correção do gráfico: barras começam no zero; nunca pizza com >5 fatias; nunca 3D/perspectiva; no máximo ~7 pontos de dado por gráfico; dado faltando/ambíguo → pergunta, nunca completa.
- Nenhum dado de campanha sai da máquina — render local.
- Todo artefato gerado permanece **gitignored** (repo público): sem dado bruto nem PNG commitado.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — a própria entrega é um gráfico de dados fornecidos pela pessoa.
- **Decisões desbloqueadas:** a comunicação escolhe **qual número/ângulo** vira peça e **para qual canal** (feed × stories); a coordenação/mandato escolhe **o que destacar** no material do período.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: o tipo segue a relação dos dados; barras no zero; um destaque de cor; ≤~7 pontos; rótulo direto; sem pizza grande, sem 3D; dado sem fonte não entra.

## Dados da decisão (literais)

- **Nome e artefatos (verbatim):** skill `.agents/skills/graficos-dados/SKILL.md`; command `.opencode/commands/graficos-dados.md`; subagente opcional `.opencode/agent/graficos-dados.md`. Invocação: `/graficos-dados <dados>` (texto colado ou caminho de arquivo).
- **Formatos de entrada v1 (verbatim):** `xlsx`, `csv`, `md`, `txt`, texto no comando; `doc/docx` fica fora do v1 (sem dependência) — decisão na questão em aberto.
- **Tamanhos de saída (verbatim):** `1080×1350` (feed 4:5, default), `1080×1080` (quadrado), `1080×1920` (stories/reels); sRGB, PNG <8MB.
- **Paleta Solla (hex, verbatim):** destaque `#c51414`; escuro de marca `#ae1603`; vermelho PT `#a21c1c`; amarelo PT `#ffe607`; tinta `#1c1917`; muted `#6b7280`; borda `#e7e5e4`; fundo off-white não-branco (ex.: `#faf9f7`) para aguentar dark mode.
- **Tipografia mínima (verbatim):** rótulos ≥30px; headline ≥48px; janela segura do grid do perfil ~`1012×1350`; safe zone de stories ~250px topo + ~250px base.
- **Limites (verbatim):** ≤~7 pontos de dado por gráfico; barras começam no zero.
- **Artefatos gitignored (verbatim):** `data/graficos-instagram/` (intermediários) + `docs/research/graficos-instagram/` (PNG/SVG finais) — nunca commitados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/graficos-dados/SKILL.md`, `.opencode/commands/graficos-dados.md`, `.opencode/agent/graficos-dados.md`; primitivos de gráfico hoje em `scripts/lib/dossieRender.mjs` (`barChart` L914, `valueList` L932, `columnChart` L948, `stackedColumnChart` L969, `CHART_COLORS` L898-912) e pipeline Chromium em `scripts/lib/buildPdf.mjs`; novo entry `scripts/build-chart-from-data.mjs`.
- **Precedente a olhar:** família de skills C186/C187/C190 (skill + command + subagente + builder local, artefato gitignored), `tests/unit/opencodeCommands.unit.spec.ts:13-48` (array de commands), `tests/unit/opencodeAgents.unit.spec.ts`.
- **Risco de acoplamento:** **"edite o dono, não gema um irmão"** — extrair/parametrizar os primitivos SVG existentes em vez de um segundo renderer; não tocar no layout dos dossiês; sem schema/migration; dados nunca saem da máquina (sem MCP remoto por default).

## Dependências

- **Hard:** design hi-fi do template (`docs/plans/graficos-dados-instagram-ui-design.html`) produzido pelo `designer` antes do port.
- **Soft:** primitivos SVG e pipeline Chromium existentes (dossiê/PDF) disponíveis para reuso.
- **Soft:** decisões das questões em aberto (nome/ID, `doc/docx`, MCP, formato default, catálogo de tipos).

## Fora de escopo

- Limpeza/interpretação estatística dos dados, análise, priorização territorial — a skill representa o dado, não o interpreta.
- Legenda, carrossel final, copy e publicação — ficam com a comunicação.
- Publicar/agendar direto nas redes.
- Dossiês/relatórios completos em PDF — domínio dos irmãos C186/C187/C190.
- Persistir dados, schema ou migration; segundo cadastro/catálogo de dados.

## Rabbit holes de produto

- **"Editor gráfico completo."** Se alguém "só completar": cores/fontes/eixos/legenda configuráveis, drag de rótulo. **Corte neste item:** tipos essenciais + paleta fixa Solla + ajuste de tipo/rótulo/tamanho.
- **"Dashboard interativo."** **Corte neste item:** uma imagem estática por invocação.
- **"Pizza para tudo."** Dataset pede comparação e vira pizza de 9 fatias. **Corte neste item:** a relação dos dados manda no tipo; pizza só com ≤5 fatias (ou nem entra no v1).
- **"MCP remoto de gráfico."** AntV/QuickChart mandam o dado para serviço de terceiro. **Corte neste item:** render local; MCP fica com gatilho futuro (self-hosted, em subagente).
- **"Segundo renderer irmão."** **Corte neste item:** estender/extrair o dono existente.

## Questões em aberto (produto)

- **Nome/ID da skill e comando?** **Opções:** A) `graficos-dados` | B) `grafico-instagram` | C) `gerador-graficos`. **Recomendação:** A — descreve o insumo (dados), não amarra ao canal. _(assumido — validar)_
- **`doc/docx` no v1?** **Opções:** A) fora — só `xlsx/csv/md/txt/texto` | B) adicionar dependência `mammoth`. **Recomendação:** A — evita dep nova; reavaliar com demanda real. _(assumido)_
- **MCP de gráficos/planilha?** **Opções:** A) nenhum no v1, render local | B) AntV `mcp-server-chart` self-hosted em subagente | C) MCP de planilha só leitura. **Recomendação:** A — privacidade do dado de campanha e a marca/anotação finas vencem; MCP com gatilho futuro. _(assumido)_
- **Formato default de saída?** **Opções:** A) `1080×1350` feed 4:5 | B) `1080×1080` quadrado. **Recomendação:** A — retrato é o padrão de feed em 2026 e ocupa mais tela. _(assumido)_
- **Quantos tipos no v1?** **Opções:** A) essenciais — barra, coluna, linha, número-âncora | B) catálogo amplo tipo FT Visual Vocabulary. **Recomendação:** A — cobre a maioria dos pedidos com menos chance de escolha errada. _(assumido)_

## Referências

- GitHub Issue #1145.
- Design UI (gate): `docs/plans/graficos-dados-instagram-ui-design.html` + assets em `docs/plans/graficos-dados-instagram-ui-design-assets/`.
- Irmãos: `.agents/skills/relatorio-cidade/SKILL.md`, `dossie-solla-cidade/SKILL.md`, `dossie-solla-instituicao/SKILL.md`, `docs/plans/dossie-solla-tema.md` (C190).
- Renderer/pipeline: `scripts/lib/dossieRender.mjs`, `scripts/lib/buildPdf.mjs`, `tests/unit/opencodeCommands.unit.spec.ts`.
- `DESIGN.md` §2 (paleta/regras), `AGENTS.md` (artefato gitignored, "edite o dono").
- FT Visual Vocabulary, Datawrapper (chart types, accessible colors, size), WCAG 2.2 (contrast/use of color) — pesquisa 2026-09-18.
