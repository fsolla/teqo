# Escala/DRY pós-C209 — orquestração repetida nos 3 builders + resíduos mortos

Status: rascunho
Atualizado em: 2026-09-22
Issue: #1251 (débito do C209; a Issue própria nasce `depends: [1251]`)
Priority: P3
Impeccable: A — só-backend (scripts), sem superfície visual
Appetite: ~0,5–1 dia eng (fill-in)
Responsável: —

## Intenção

O C209 (dossiês e boletins sóbrios) entregou o redesenho; a revisão estrutural/qualidade
deixou três resíduos maiores que o cleanup da sessão. Este lote existe para não deixá-los
apodrecendo no diff do C209: (1) o loop probe→pack→measure→emit está triplicado nos três
builders e o C209 acabou de duplicar também os callbacks de fit; (2) o par `layout: 'card'`
do packer/probe ficou inalcançável quando as ações viraram listas; (3) a síntese ainda
calcula e expõe quatro séries que só existiam para os gráficos consolidados, extintos no
redesenho.

## Fases

1. **F1 (S4) — orquestração compartilhada dos builders.** Extrair o loop
   `probe → packProbeSections → measureDocumentSheets → adjustPackPlan → emitHtmlPairPdf`
   para um helper único (ex. `scripts/lib/dossieBuild.mjs`) parametrizado pelos deltas reais:
   fallback de índice (cidade), shrink de boletim (cidade/tema/instituição) e log. Opções:
   A) helper com options; B) classe; C) manter os três loops. Recomendação: A — os deltas
   são dados, não fluxos; rejeitadas B (cerimônia sem volatilidade) e C (o custo cresce a
   cada builder novo). Prova: os 3 builders geram os mesmos PDFs/artefatos dos fixtures,
   com o log `pack estável` idêntico.
2. **F2 (S3) — par `card` morto no packer.** Decidir entre aposentar o par `card` de
   `measureDocumentPackProbe`/`dossiePack` (atualizar o spec do packer) ou documentá-lo
   como contrato do packer (nenhuma unit emite hoje). Recomendação: aposentar e ajustar o
   spec — o redesign fixou listas/tabelas; um grid de 2 colunas novo pede decisão de design.
3. **F3 (S1) — séries mortas da síntese.** Remover `byYear`, `acervoByYear` (do retorno),
   `moneyByYear` e `moneyProposals` de `buildDossierSynthesis` (mantendo os usos internos de
   `topYears`), ou re-consumi-las num consumidor real. Recomendação: remover — nenhum
   consumidor após a morte dos gráficos; o spec da síntese pina só o que é lido.

## Já resolvido no simplify/critique (não reabrir)

- Índice do companion com âncoras reais (`mdAnchor`) e rodapés do PDF alinhados ao `.md`.
- Duplicação de honrarias (era + folha de títulos) no dossiê institucional.
- Região/polo e abrangência consolidadas em uma seção corrente (design cenas 06/09/10).
- Atribuição das ações da Câmara (`Alcance: mandato federal`), era omitida sem número de
  seção, estado vazio do "E mais" do boletim, célula "Tema canônico" sem token concatenado.

## Explicitamente fora (descartes deste triage)

- **S2 `BULLETIN_MORE_LIMIT`:** fallback defensivo de uma unit futura sem
  `bulletinMoreLimit`; remover deixaria `slice(0, NaN)` silencioso. Descartado.
- **S5 mutação de `report.meta.pageTotal` no render:** pré-existente em `main`, decisão
  travada do paginador (2ª passada para o índice real). Descartado.
- **S7 `factsPrintable`:** contrato de contagem do boletim pinado por spec (precedente C188).
  Descartado.
- **S9 documento reconstruído 2×:** Decisão A do C209 aceita a 2ª passada pelo índice com
  página real. Descartado.

## Adiado com gatilho

- **S6 copy do boletim-município hardcoded no render:** gatilho — a copy municipal mudar
  duas vezes ou surgir um quarto shape de boletim; aí mover para `MUNICIPALITY_UNIT.copy`.
- **S8 builders instituição/tema sem `resumoOnly`:** gatilho — overflow de página não-resumo
  nesses dois builders ou quando o C189 tocar os builders.
