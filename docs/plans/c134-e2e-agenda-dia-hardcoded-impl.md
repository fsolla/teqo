# Impl: C134 — e2e agenda: dia hardcoded "17 de agosto de 2026" no teste C104 expira

Status: aprovado
Atualizado em: 2026-08-13
Issue: #712
Intenção: body da Issue (sem plano de intenção linkado — body é a spec)
Appetite restante: herdado (correção de teste, escopo mínimo)

## Leitura da intenção

- **Outcome:** o teste e2e "cria compromisso 'Todo o dia'" (`campaignActivity.e2e.spec.ts`)
  não quebra mais deterministicamente ~2026-09: o dia do picker de término é derivado
  de "hoje" (`formatBahiaCivilDate(new Date()) + delta`), no mesmo padrão do resto do spec.
- **O que NÃO negociar:** nada de produto; mudança restrita ao spec de e2e.
- **O que reavaliar:** o delta. A intenção pede "+ delta (mesmo padrão do resto do spec)".
  Hoje o teste não usa `civilDatePlusDays` no C104; o helper existe em
  `tests/e2e/helpers/agendaPeriodLabels.ts` (usado pelo C95/mobile). A questão real é:
  o delta precisa manter o dia **dentro do mesmo mês** (comentário atual: "a later day of
  the same month") ou basta ser **posterior a hoje**?

## Abordagem recomendada

**Opções consideradas:**

- **A — delta fixo +1 derivado de hoje (recomendada):** `endCivil = civilDatePlusDays(formatBahiaCivilDate(new Date()), 1)`,
  label do botão montado de `ptBrMonthNames` + partes do civil date. Sem navegação de mês no picker.
- **B — delta +1 com navegação de mês condicional:** se `endCivil` cai em mês diferente,
  clicar o botão de próximo mês antes do dia. Mais passos, cobre o caso em que o dia alvo
  não está no grid — mas o grid do react-day-picker (`showOutsideDays`) **sempre** renderiza
  o dia 1 do mês seguinte como célula "outside" clicável (seleciona e navega), então B é
  complexidade sem cobertura adicional.
- **C — manter hardcode mas avançar a data:** adia a quebra; não resolve o problema de classe.

**Recomendação:** A. O picker é react-day-picker v9 (`Calendar` em `ActivityDateTimeField`,
`defaultMonth` = mês de hoje; `showOutsideDays=true` renderiza o primeiro dia do mês
seguinte como botão clicável no próprio grid — verificado no source do node_modules:
`CalendarDay.outside` só marca `data-outside`, não desabilita). Com delta +1 o alvo está
**sempre** no grid visível: se hoje não é o último dia do mês, é um dia do próprio mês; se é,
vira o dia 1 do mês seguinte na primeira posição da última semana — ainda visível e clicável.
O label do botão é date-fns `PPPP` com pt-BR ("segunda-feira, 17 de agosto de 2026") — o
regex não-ancorado `/17 de agosto de 2026/` do teste casa contra o subconjunto
"dia de mês de ano"; derivamos exatamente esse subconjunto (dia sem zero à esquerda,
nome do mês capitalizado de `ptBrMonthNames`, ano). A asserção do trigger
(`toHaveText(/17\/08\/2026/)`) vira `dd/mm/aaaa` derivado do mesmo `endCivil`.

**Rejeitadas:** B (navegação extra sem ganho: o dia alvo sempre está no grid), C (adieta).

### Componentes / mudanças

- **`campaignActivity.e2e.spec.ts`** (teste C104, ~linhas 308–315): derivar
  `endCivil = civilDatePlusDays(formatBahiaCivilDate(new Date()), 1)`; clicar
  `endPicker.getByRole('button', { name: new RegExp(pickerDayLabel) })` com o label
  montado de `ptBrMonthNames`; asserir o trigger com o `dd/mm/aaaa` derivado.
  Atualizar o comentário "same month" → "later day" (pode cruzar mês no último dia).
- **Helpers:** nenhum helper novo — `civilDatePlusDays` e `ptBrMonthNames` já existem e
  estão importados/exportados; a montagem do label é 3 linhas locais no spec (mesmo
  padrão de `dayLabelFor` do helper — não criar helper novo para 1 uso).
- **Migration:** sem migration.
- **Access / Consent:** sem mudança.
- **UI:** sem mudança.

## Fases verificáveis

1. **Spec** — editar o teste C104 no `campaignActivity.e2e.spec.ts`.
2. **Verificação** — `pnpm test:e2e campaignActivity` (e2e com db de teste do worktree).
3. **Gates** — `tsc --noEmit`, `lint`, `format:check`, `knip` (nenhum símbolo orfanado).

## Rabbit holes / Não escopo (engenharia)

- Não tocar nos outros hardcodes de data de e2e (`campaignAiChatFollowUps` são strings
  de conteúdo, não datas de calendário — verificados, sem trabalho).
- Não generalizar para um helper de "label de dia do picker": 1 uso não justifica
  camada nova (`civilDatePlusDays` + `ptBrMonthNames` já cobrem).

## Riscos e mitigação

- **Fuso:** `formatBahiaCivilDate` usa hora civil da Bahia (padrão do spec inteiro);
  `civilDatePlusDays` opera em UTC puro sobre o civil date — imune a DST. Mesmo
  contrato do resto do spec.
- **Último dia do mês:** o dia alvo vira "outside day" — o react-day-picker v9 renderiza
  e seleciona outside days normalmente (verificado no source; o unit spec de
  `activityOverlay` já clica dias do mês corrente sem restrição de "inside").
  Risco residual baixíssimo; se um dia o RDP mudar esse contrato, o teste falha com
  "button não encontrado" — mensagem clara, não determinística de data.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (teste deriva o dia de hoje + delta)
- [x] Invariantes AGENTS/engineering-standards (mudança só em spec; sem DB, sem schema)
- [x] Testes de domínio previstos (e2e C104 roda no worktree; sem unit — sem lógica de runtime)

## Absorvido durante a execução (débito pré-existente, mesmo arquivo)

- **Flake `?tab=overview` (3 sítios):** `toHaveURL(/\/campanha\/atividades\/[^/?]+$/)` nas
  linhas 86/344/397 corria contra o redirect canônico da página de detalhe
  (`getActivityDetailTabRedirect` → sempre `?tab=overview` quando o query está vazio):
  só passava quando o poll pegava o URL intermediário pré-redirect — quebrou 5× nos runs
  de verificação, inclusive no próprio C104 (linha 344). O precedente da correção já
  existia na linha 219 do mesmo arquivo (`(?:\?tab=overview)?$`); apliquei o mesmo
  regex nos 3 sítios restantes. Débito absorvido (determinismo, mesma classe do C134;
  sem nova Issue).
