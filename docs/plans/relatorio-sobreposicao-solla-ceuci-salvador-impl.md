# Implementação — Relatório Solla × Ceuci em Salvador (2022)

Status: executado
Atualizado em: 2026-09-14
Issue: #979
Intenção: docs/plans/relatorio-sobreposicao-solla-ceuci-salvador.md
Appetite restante: 1 sessão

## Leitura da intenção

O entregável é o PDF; o gerador é meio. O relatório tem que funcionar impresso em A4, em preto-e-branco aceitável, com números conferíveis e sem promessa que os dados não sustentam (não há voto por bairro nem por eleitor). A análise política usa as duas personas como lentes declaradas — Helena Rocha (método) e Nivaldo Cerqueira (decisão) —, sem inventar números internos da campanha.

## Abordagem recomendada

**Opções**

- **A (recomendada): script Node único + HTML→PDF via Chromium do Playwright** (`@playwright/test` já é devDependency e os browsers estão instalados), com SVGs gerados das geometrias commitadas + malha de bairros do IBGE, e JSON de dados commitado. Sem dependência nova; o projeto já rejeitou lib de PDF server-side (`docs/plans/dossie-municipio.md`) e prefere CSS/print.
- B: rota `/campanha` com print CSS — rejeitada: exige sessão autenticada, imprime Leaflet raster e não é um anexo entregável "amanhã" fora do app.
- C: lib de PDF (pdfkit/react-pdf) — rejeitada: dependência nova + precedente contrário.

**Componentes/mudanças**

- `scripts/build-solla-ceuci-salvador-report.mjs` — baixa/simplifica a malha de bairros (cache `data/geometries/`), lê o JSON de dados + artefato de Solla, projeta SVGs, monta o HTML e imprime o PDF.
- `docs/research/solla-ceuci-salvador-2022-dados.json` — entrada com proveniência (19 ZE: votos, válidos, posições, totais).
- `docs/research/analise-sobreposicao-solla-ceuci-salvador-2022.md` + `.pdf` — entrega.
- `docs/research/README.md` — registro na tabela; `docs/changelog/2026-09-14-c157.md` — contrato OPS44.
- Sem `src/**` novo (não força suíte full), sem `package.json` (não força build/e2e curado).

**Fases verificáveis**

1. Exportar dados TSE 2022 de Salvador read-only (prod, só SELECT) → JSON; validar Solla contra o artefato (27.264) e Ceuci contra o total estadual conhecido (36.992) e contra 19.776 em Salvador.
2. Baixar/simplificar malha de bairros do IBGE; conferir bbox de Salvador e contagem de bairros.
3. Gerar HTML com mapas/tabelas; conferir em screenshot do Chromium (mapas legíveis, sem sobreposição de rótulos).
4. Gerar PDF; conferir nº de páginas, fontes e tamanho; revisar o companion `.md`.
5. Guards locais (`pnpm lint`, `pnpm format:check`, `gate:push`), commit, push, PR `Closes #979`, CI verde e merge (auto-merge nativo).

## Rabbit holes

- Mapa de bairros com geometria própria do IBGE mas voto por ZE: a legenda e a nota de método têm que dizer que a cor do bairro é a da ZE dele (centroide), nunca sugerir medição por bairro.
- Projeção: não introduzir d3; equiretangular local com `cos(lat)` resolve Salvador.
- Rótulos: não rotular 100+ bairros; rotular ZE e uma seleção de bairros fortes.

## Riscos

- Malha do IBGE indisponível no build (hoje acessível): o PDF já gerado é o entregável; o cache `data/geometries/` é local e gitignored.
- 19 ZE é N pequeno para correlação: reportar Pearson e Spearman com ressalva explícita (não usar como probabilidade).
- PDF pesado demais: simplificar malha de bairros e não embutir raster; meta < 5 MB.

## Aceite de engenharia

- Script roda de ponta a ponta sem banco; sem dependência nova.
- PDF + companion `.md` + JSON de dados + changelog commitados.
- `pnpm lint` e `pnpm format:check` verdes; PR com CI verde.

## Débitos + self-score

- O JSON de entrada foi extraído da base de produção (read-only) porque o CDN do TSE está bloqueado nesta rede; regenerar exige o mesmo caminho ou um seed local com os ZIPs. Registrado na proveniência do JSON.
- Gerador não é chamado por alias `pnpm` (evita suíte full no CI); documentado no cabeçalho do script.
