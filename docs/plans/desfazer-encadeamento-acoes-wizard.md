# Desfazer o encadeamento automático das ações rápidas do wizard

Status: registrado
Atualizado em: 2026-08-08
Issue: #422
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe no header do wizard (remover “Pular”) + navegação pós-save
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b168-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; remover navegação de cadeia e skip; sem migration
Responsável: —

## Intenção

Durante a verificação em campo com o coordenador geral, o **encadeamento automático** das ações
rápidas (B98) confundiu o usuário. Ao tocar “Ajustar votos”, ajustar e salvar, a tela avançava
**sozinha** para “Mudar tendência” e depois para as próximas ações — sem que ele tivesse pedido.
A expectativa de quem clica numa ação rápida é **performar exatamente aquela ação** e voltar.
Existe aqui evidência de produto em campo (não suposição): o vereador/comando testou e rejeitou.

## Persona e fluxo

- **Persona / contexto:** staff (coordenador/assessor) no celular, no meio da operação, dispare a ação
  rápida de um município na página em que está ou no Início.
- **Job principal:** fazer **um** ajuste específico e voltar ao ponto de origem com a confirmação de
  que funcionou — sem ser levado para outra ação.
- **Fluxo desejado:** toca a ação → wizard daquela ação → ajusta → salva → toast de sucesso → volta à
  origem (página de onde tocou ou Início). Header sempre com “X” (sair), nunca “Pular”.
- **Anti-goals de produto:** fluxos que abrem outros fluxos sozinhos; “continuidade” disfarçada de
  sugestão automática pós-save; segunda tela de sucesso; mexer no catálogo/strip das ações.

### Esboço de fluxo (B)

```text
Hoje (B98): ação A → ajuste A → save → [automático] ação B [Pular] → ação C [Pular] → … → Início

Desejado: ação A → ajuste A → save → toast → volta à origem (Início ou página de origem)
```

## Objetivo e aceite

- Ao concluir **qualquer** ação rápida de ajuste (votos, tendência, atualização, liderança), o usuário
  volta à origem — **nunca** avança sozinho para outro wizard.
- O chrome do wizard não exibe mais “Pular” (nem “Pular mudança de tendência”, etc.) em etapa nenhuma;
  “X” (sair da ação) existe em todas as etapas e retorna à origem.
- Não existe mais fila encadeada, `entryAction` de cadeia nem “próxima etapa sugerida” pós-save.
- Guardrails que valem: retorno à origem via `from` allowlist (**B110** — manter); wizards standalone
  intactos; liderança continua fora (já gateada); sem migration.

## Dados (intenção)

- **Vou apresentar dados?** Não — fluxo de navegação, sem métrica superfície.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/wizardActionChain.ts` (matriz `WIZARD_CHAIN_AFTER` + continue/end),
  `src/lib/campaignWizardCopy.ts` / `wizardUpdateUi.ts` / `politicalTrendWizardUi.ts` /
  `wizardLeadershipContract.ts` (skip resolvers + `WIZARD_CHAIN_SKIP_LABEL`), pontas de sucesso de
  `src/components/campaign/{shared,municipality,leadership}/*Wizard*Step.tsx` (chamam
  `wizardChainContinueHref`), avanço da cadeia em `src/app/(campaign)/campanha/(app)/acoes/[slug]/page.tsx`
  (chamada em `change-trend`), `src/lib/campaignActionRoutes.ts` (query `entryAction`).
- **Precedente a olhar:** B98 `encadear-ajustes-wizard.md` (#106) é o que este item **inverte**;
  `wizard-retorno-pagina-origem.md` (#149) — retorno à origem, **manter**; `wizard-header-x-vs-pular.md`
  (#104) e `wizard-pular-curto-encadeadas.md` (#131) — chrome X/Pular; `wizard-voltar-passo-anterior-cadeia.md`
  (#289) — “voltar” de elo encadeado perde sentido.
- **Risco de acoplamento:** `entryAction` também alimenta skip e prefill de nota de tendência; deep-links
  de demanda/atividade passam `returnPath`. A profundidade da remoção (mínima vs limpeza total do
  plumbing/código morto) é decisão de implementação — nunca quebrar retorno à origem nem wizards standalone.

## Dependências

- Nenhuma dura. Item é **sucessor de intenção** de B98 (#106, done/in-prod) — plano/Issue novos; B98 e
  demais antecedentes ficam imutáveis.

## Fora de escopo

- Redesenho do chassis/header do wizard; nova tela de “concluído” (o toast basta).
- Alterar a strip/FAB de ações rápidas ou o catálogo do Início.
- Comportamento de “continuar/voltar ao passo anterior” fora do contexto de cadeia (B135 genérico).
- Decidir profundidade da limpeza de código — fica com `work-issue`/`agent-work-issue`.

## Rabbit holes de produto

- **“Continuidade” como sugestão passiva.** Se alguém “só completar” o desejo: reintroduz um segundo
  encadeamento (link automático pós-save) que o campo rejeitou. **Corte neste item:** nenhuma sugestão
  pós-save; só toast + retorno.
- **Remover menos do que o necessário e deixar dois sistemas de navegação.** **Corte:** o executor
  decide, mas o resultado não pode ter `Pular`/fila morta aparente para o usuário.

## Questões em aberto (produto)

- **Pós-save: retorno direto ou tela curta de confirmação?** **Opções:** A) retorno direto à origem +
  toast (toast já existe) | B) tela “ação concluída” antes de voltar. **Recomendação:** **A** — o
  coordenador quer performar a ação e voltar; toast já confirma. _(assumido)_
- **Oferecer “continuar para a próxima” como link opcional (não automático)?** **Opções:** A) não
  oferecer nada | B) link discreto pós-save (ex. “Ajustar a tendência também”). **Recomendação:** **A** —
  o pedido em campo foi “cada ação performa exatamente a ação”; link pós-save é encadeamento disfarçado.
  _(assumido)_

## Referências

- GitHub Issue #106 (B98 — o que se inverte) · #104 (B96) · #131 (B104) · #149 (B110 — manter retorno à
  origem) · #289 (B135)
- Canvas UI (gate): /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b168-ui-draft.canvas.tsx
- `src/lib/wizardActionChain.ts` · `src/lib/campaignWizardCopy.ts` · `src/lib/campaignActionRoutes.ts` ·
  `src/components/campaign/shared/WizardExpectedVotesStep.tsx` (ponta de sucesso de exemplo) ·
  `src/app/(campaign)/campanha/(app)/acoes/[slug]/page.tsx`
- AGENTS.md — naming / deletes (`knip`) / convention de rotas pt-BR
