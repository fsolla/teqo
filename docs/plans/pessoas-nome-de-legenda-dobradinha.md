# Pessoas: nome de legenda da dobradinha (campo + display discreto sob o nome)

Status: rascunho
Atualizado em: 2026-08-11
Issue: #696
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na célula de Nome de `/campanha/pessoas` (e nas superfícies de dobradinha que mostram o nome)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-pessoas-ajustes-ui-draft.canvas.tsx (seção "Depois — tabela desktop ajustada")
Appetite: ~0,5–1 dia eng; campo novo + display em 1–2 superfícies
Responsável: —

## Intenção

A dobradinha tem um **nome real** (ficha) e pode ter um **nome de legenda** (como vai aparecer na urna — ex. apelido/abreviação usado na campanha). Hoje só existe o nome real; a mesa precisa registrar e ver o nome de legenda com destaque discreto, sem confundir com o nome real.

## Persona e fluxo

- **Persona / contexto:** coordenador/candidato e assessores olhando a tabela de pessoas no desktop.
- **Job principal:** reconhecer a dobradinha de relance pelo nome de legenda, com o nome real ao lado.
- **Fluxo desejado:** abro `/campanha/pessoas` → na linha da dobradinha, vejo o nome real e, logo abaixo, discreto, o nome de legenda (quando houver). Posso editar o nome de legenda onde ele aparece.
- **Anti-goals de produto:** o nome de legenda não substitui o nome real; não vira segunda linha com peso visual de nome; não é campo livre genérico fora da dobradinha.

## Objetivo e aceite

- A dobradinha ganha um campo **nome de legenda** (opcional), separado do nome real da ficha.
- Na tabela de `/campanha/pessoas`, a linha da pessoa com dobradinha mostra o nome real e, embaixo, **discreto** (mesma família tipográfica, menor/atenuado), o nome de legenda — quando preenchido.
- O nome de legenda é **editável nas superfícies onde já se edita dado de dobradinha** (ex.: lista de Dobradinhas, onde hoje se edita nome/partido/telefone) — **não** inline na célula de Nome de `/campanha/pessoas` (decisão do gate 2026-08-11: dois inputs na mesma célula não funciona bem; display-only lá).
- Sem nome de legenda, nada muda na linha (sem linha vazia, sem traço).
- O nome real continua sendo o nome da pessoa em toda parte (busca, ordenação, link da ficha).

## Dados (intenção)

- **Vou apresentar dados?** Não — é texto de identidade, não métrica.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/StateDeputy.ts` (campo novo na entidade dobradinha), `src/utilities/people/peopleData.ts` (levar o valor ao modelo de linha), `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` (célula de Nome com segunda linha), e a superfície de edição inline correspondente.
- **Precedente a olhar:** C116 (célula de Nome com link + input invisível, campo `party` como sufixo do nome), C118 (seção de dobradinha na ficha da pessoa), lista de Dobradinhas (`/campanha/dobradinhas`, mostra nome + partido).
- **Risco de acoplamento:** a regra "segunda linha = nome de legenda OU base" é compartilhada com C130 — o executor deve manter a precedência combinada (legenda sobrepõe base).

## Dependências

- Suave com **C130** (a segunda linha do Nome abriga legenda e base na mesma posição; as duas entregas podem ser construídas em qualquer ordem, mas a regra final da segunda linha deve ser uma só).

## Fora de escopo

- Nome de legenda para liderança/staff (a pedido atual é só dobradinha).
- Uso do nome de legenda em buscas/ordenação/facets (o nome real continua sendo a chave).

## Rabbit holes de produto

- **"E na lista de Dobradinhas?"**: o nome de legenda naturalmente também ajuda lá, mas a pedido atual é a tabela de pessoas. **Corte:** exibir também onde o nome da dobradinha aparece (lista/ficha de dobradinhas) se for barato; não redesenhar essas superfícies.

## Questões em aberto (produto)

_Decididas no gate 2026-08-11 (não reabrir sem evidência nova):_

- **Onde mais o nome de legenda aparece?** **Decidido:** tabela de pessoas (2ª linha do Nome) + lista/ficha de Dobradinhas (mesmo padrão "discreto sob o nome").
- **Onde o nome de legenda é editado?** **Decidido:** onde hoje se edita dado de dobradinha (lista de Dobradinhas — precedente B163), display-only na tabela de pessoas.

## Referências

- Canvas UI (gate): plan-pessoas-ajustes-ui-draft.canvas.tsx (seção C130 — mesma célula de Nome)
- Planos: [pessoas-edicao-inplace-lista.md](pessoas-edicao-inplace-lista.md) (C116), [pessoas-lista-unificada.md](pessoas-lista-unificada.md) (C100 — coluna Nome com partido), [pessoas-detalhe-por-capacidades.md](pessoas-detalhe-por-capacidades.md) (C118)
- `AGENTS.md` — naming: identificadores em inglês, labels pt-BR
