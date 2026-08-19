# Escala pós-C141: options write-scoped para formulários de escrita

Status: rascunho
Atualizado em: 2026-08-19
Issue: C144 (a criar)
Priority: P2
Model: deepseek/deepseek-v4-flash
Impeccable: A — backend de dados de formulário (o C142 cuida da apresentação)
Appetite: ~0,5–1 dia eng

## Contexto (achado do /simplify da entrega C141)

`loadMunicipalityOptions` (`src/utilities/campaignRelationOptions.ts`) resolve os
municípios oferecidos nos formulários de escrita com o escopo de LEITURA
(`overrideAccess: false` + access de `canReadMunicipality`). Desde o C141, um
assessor com **Visão "Tudo" + Edição "Carteira"** vê os 435 municípios nos
pickers de atividade/demanda/apoiador/liderança, mas o servidor rejeita o
submit fora da carteira (fail-closed, mensagem genérica) — e em **atividade**
o servidor hoje **aceita** (o create individual foi corrigido no C141, mas o
formulário continua oferecendo o estado inteiro). A apresentação por perfil é
o item irmão C142; este item entrega a base de dados correta para os
formulários de escrita.

## Objetivo

- Os pickers de município dos **formulários de escrita** oferecem apenas
  municípios no escopo de **escrita** do ator (`getWritableMunicipalityIds`):
  unrestricted/tudo → todos; carteira → carteira; somente leitura → nenhum
  (formulários de escrita nem abrem para esse assessor).
- Superfícies alvo: atividade (create/update + giro), demanda (criar),
  apoiador (novo), liderança (criar/editar), organização (vínculos).
- Leitura (listas/detalhes/mapa) continua read-scoped — não tocar.
- Sem mudança de enforcement (C141 já fail-closed no servidor).

## Direção no codebase

- `src/utilities/campaignRelationOptions.ts` (`loadMunicipalityOptions`) —
  variante write-scoped (parametro `scope: 'read' | 'write'` ou helper irmão)
  consumida pelos form actions/pages de escrita; manter o fragmento P3-D
  (`advisorMunicipalityScopeWhere`) e o `getWritableMunicipalityIds` do C141.
- Mapear os call sites dos pickers (atividades/agenda, demandas, apoiadores,
  lideranças, organizações) e trocar só os de escrita.

## Fases

1. Variante write-scoped + call sites de atividade (onde o servidor aceita) — tester int: picker de atividade reflete o eixo.
2. Demanda/apoiador/liderança/organização (UX — servidor já rejeita).
3. Gates (`pnpm push`); e2e no CI.

## Já resolvido no simplify/critique (não reabrir)

- Criação de atividade avulsa/giro fora do escopo: server-side no C141
  (`getWritableMunicipalityIds` no create individual e no batch do giro).
- Ficha de contatos write-scoped (`assertPersonContactWritable`).
- Ações de liderança write-scoped (`assertMunicipalitiesWithinScope`).
- `allocationDecision` create capado na carteira.

## Explicitamente fora (deste lote)

- Apresentação por perfil (botões/controles/atalhos) — C142.
- Enforcement server-side — C141 (já entregue).
- Options de leitura (listas/detalhes) — read-scoped permanece.
