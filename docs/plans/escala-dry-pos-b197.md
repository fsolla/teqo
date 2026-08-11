# Escala e DRY pós-B197 (picker de colunas de assessores)

Status: pendente (capture-review-debts pós-B197, gate humano confirmado)
Atualizado em: 2026-08-11
Item do roadmap: fill-in **B197+** pós-[#627](https://github.com/fsolla/teqo/issues/627)
Impeccable: A — sem superfície UI nova (DRY/estrutura)
Appetite: ~0,5 dia eng
Responsável: —

## Contexto

O B197 entregou o seletor de colunas na lista de assessores — a primeira lista do
mecanismo B17 que **não** usa `CampaignTable`. A tabela (`AdvisorsTable.tsx`) é
client-side com `<th>` escritos à mão, então o menu do picker
(`advisorPickerColumns` em `assessores/page.tsx`) é um array estático que
**espelha** os cabeçalhos da tabela: `Nome/E-mail/Celular/Municípios/Ações`.
O espelho é coberto por comentário, mas nada impede um item futuro de adicionar
uma coluna na tabela e esquecer o menu — a coluna nasceria fora do picker (nem
ocultável, nem listada), silenciosamente.

**Já resolvido no simplify/critique (não reabrir):** nada — o achado foi
registrado direto do gate pós-entrega (nenhum outro follow-up do B197 ficou).

**Explicitamente fora:** conversão do `AdvisorsTable` para `CampaignTable`
(rejeitada no impl do B197 — redesenho de superfície fora do pedido; o shell
não modela a linha-draft de criação nem a edição inline por célula).

## Objetivos

- O menu do picker de assessores nasce da **mesma fonte** que os `<th>` da
  tabela — adicionar coluna num lugar atualiza o outro de graça.
- Sem mudança de comportamento: mesmos ids (`name` mandatory, `email`, `phone`,
  `municipalities`, `actions`), mesmos labels, exceção do draft intacta.

## Decisões travadas

- **Opção A — fonte única serializável no módulo da tabela (recomendada).**
  `AdvisorsTable.tsx` (client) passa a declarar as colunas como dados
  (id/label/mandatory) e exporta uma versão serializável (`toCampaignColumnPickerColumns`
  já existe no lib B17); o `<th>` renderiza de `label`, e `assessores/page.tsx`
  importa a mesma fonte para o picker. Cliente-para-servidor vale para
  constantes serializáveis (mesmo padrão de `supporterPickerColumns` em
  `SupporterList.tsx`).
- **Opção B — status quo (comentário).** Rejeitada: o comentário já existe e o
  achado é exatamente que ele é insuficiente para um time de agentes paralelos.
- **Gatilho de execução:** a qualquer momento como fill-in (~0,5 dia); se C112
  (telefones) tocar o `AdvisorsTable` antes, executar junto (mesma superfície).

## Fases verificáveis

1. Extrair a fonte única no `AdvisorsTable` + export serializável; `<th>` por
   `label`.
2. `assessores/page.tsx` consome a fonte; remover `advisorPickerColumns`.
3. Gates: `tsc`, `lint`, unit do lib, e2e `campaignColumnPicker` (assessores),
   `format:check`.

## Rabbit holes / Não escopo

- Não portar para `CampaignTable` (decisão travada do B197).
- Não mexer em labels/ordem/ids das colunas — contrato do cookie `campaign_columns`.
- Não criar coluna nova nenhuma — só o DRY do menu.
