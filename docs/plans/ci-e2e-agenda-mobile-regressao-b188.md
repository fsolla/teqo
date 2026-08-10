# CI main: e2e da agenda mobile vermelho desde o merge do B188 — deploy bloqueado

Status: rascunho
Atualizado em: 2026-08-10
Issue: #562
Priority: P0
Model: cursor-grok-4.5-high
Impeccable: A — N/A (sem UI nova; corrigir regressão existente)
Canvas UI: N/A — sem UI
Appetite: ~1 dia de eng (diagnóstico + fix + verificação em CI)

## Intenção

O CI de `main` está vermelho de forma **determinística** desde 05:54 de hoje (merge do B188, `07464b88`): 8+ runs consecutivos falham nos mesmos 3 testes e2e do spec da agenda mobile (`tests/e2e/campaignAgendaMobile.e2e.spec.ts`), com todas as retries falhando. O job `deploy` depende do `checks` verde → **nenhuma entrega chega à produção desde então**. Antes do B188 o mesmo spec passava (último verde `46e93c14`, 05:47). Precisamos voltar a ter CI verde estável e deploy desbloqueado — e, se o defeito for do app (não só do teste), corrigir o comportamento que o usuário mobile veria.

## Persona e fluxo

- **Persona / contexto:** equipe que entrega no `/campanha` — cada merge hoje vira um run vermelho de 40 min e nenhuma feature chega ao deploy.
- **Job principal:** destravar a esteira (CI verde + deploy automático) sem mascarar um defeito real de produto.
- **Fluxo desejado:** merge em main → verifiers (static/int/build/e2e) verdes → deploy de produção automático, como antes de hoje 05:54.
- **Anti-goals de produto:** não "silenciar" o teste para caber no defeito se o comportamento do app regrediu de verdade (ex.: o chat mobile cobrindo/interferindo na agenda); não aproveitar o item para refatorar o spec inteiro nem a infra de e2e.

## Objetivo e aceite

- CI em `main` volta a ficar verde de forma **estável**: o job e2e passa a suíte completa em runs consecutivos (não um green de sorte).
- O deploy de produção volta a rodar automaticamente no fluxo normal (checks verde → deploy → alias).
- Os 3 testes do spec `campaignAgendaMobile` passam consistentemente, com o 4º teste do spec (que já passa) intacto.
- Se o mecanismo raiz for um defeito real de produto (não só timing de teste), o comportamento do app é corrigido — o teste continua validando o contrato de UX mobile da agenda (navegação por arrasto, filtro strip, seletor de visualização no header).
- O plano de implementação documenta o mecanismo raiz: qual merge/commit introduziu, por que os 3 testes (e não o 4º) falham, e por que os 3 falhavam de forma intermitente antes do B188 (run `a4d7b883`, 03:27, passou na retry) e determinística depois.

## Dados (intenção)

Dados: N/A — não é item de métrica; é confiabilidade da esteira (o CI é o dado).

## Direção no codebase (hipótese)

Evidência já levantada (pistas para o executor, não contrato):

- **Janela da quebra:** último verde `46e93c14` (05:47) → primeiro vermelho `07464b88` (05:54, merge do B188 — PR #548, "contexto da conversa do Sollinha persiste na sessão da janela/tab"). Dif do merge: só `src/components/campaign/shell/ai/CampaignAIChat.tsx` (links internos via `next/link`), `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx` (restaura sessão de chat no mount via sessionStorage, persiste no settle, gate do settle) e `src/lib/sollinhaChatSession.ts` (novo). Nada na agenda/calendário/spec.
- **Falhas exatas (run `31379810869`):** teste `:96` falha na linha 126 (após `touchSwipe` CDP, o título não avança para o dia seguinte — o título do hoje, linha 109, aparece); teste `:242` falha na linha 267 (`combobox "Filtrar agenda"` nunca visível, embora o label sr-only do strip exista — linha 265 passa); teste `:295` falha no clique do seletor de visualização (linha 29 — botão nunca visível), mas a navegação por teclado ArrowLeft/ArrowRight funciona (linhas 321-326 passam).
- **Áreas prováveis:** `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx`, `src/lib/sollinhaChatSession.ts`, layout/shell mobile (`src/components/campaign/shell/CampaignMobileTopBar.tsx`, `use-mobile`, `useNarrowMeasured`), `tests/e2e/fixtures/campaignE2EFixtures.js` e o próprio spec — o executor deve reproduzir localmente (worktree e2e) antes de decidir o fix.
- **Precedente a olhar:** o comentário no spec (teste `:242`) registra que o painel de chat já roubou largura do layout mobile no primeiro frame (B167) — o chat é o suspeito natural; verificar contaminação de sessão entre testes no mesmo worker e o efeito dos novos efeitos de mount no settle do layout.
- **Risco de acoplamento:** os 3 testes são o contrato e2e da UX mobile da agenda (C101/C101-ux) — enfraquecer asserções de contorno (swipe, strip, seletor) só é aceitável se o comportamento do app provado correto; leader lockdown e demais convenções de acesso não são tocadas (sem mudança de schema).

## Dependências

- Nenhuma.

## Fora de escopo

- Outros flakes de carga registrados (#553 — campaignSuggestions/testDatabaseLease): destino #553, não este item.
- Refatorar o spec `campaignAgendaMobile` ou os helpers de gesto/touch além do mínimo necessário ao fix.
- Mudanças no pipeline de deploy/CI além do necessário (subir artefatos de diagnóstico do e2e no CI é opcional — ver Questões).

## Rabbit holes de produto

- **"Só aumentar timeout / dar retry".** Se alguém "só completar" com o teste passando por sorte ou tempo maior: mascaramos o defeito e o próximo B (chat/layout) reacende o vermelho. **Corte neste item:** o mecanismo raiz tem que estar documentado e o fix endereça a causa; estabilidade comprovada em runs consecutivos.
- **"Reverter o B188 inteiro".** Desbloqueia rápido, mas devolve a perda de contexto da conversa do Sollinha (funcionalidade entregue e desejada). **Corte neste item:** revert é fallback de emergência só se o diagnóstico estourar o appetite e produto concordar.

## Questões em aberto (produto)

- **Root cause é defeito real de produto (chat interferindo no mobile) ou só regressão de teste?** **Opções:** (a) tratar como defeito de produto até prova em contrário; (b) tratar como flake de teste e estabilizar o spec. **Recomendação:** (a) — o CI é a sentinela; se o app regrediu, o usuário mobile vê o problema (ex.: chat abrindo/cobrindo a agenda, header sem ações). _(assumido — validar no gate)_
- **Corrigir no lugar vs reverter o B188 para desbloquear?** **Opções:** (a) corrigir o mecanismo dentro do appetite; (b) reverter e re-planejar o B188. **Recomendação:** (a) — B188 é produto entregue; se o diagnóstico estourar ~1 dia, subir revert como opção de emergência com o produto. _(assumido — validar no gate)_
- **Subir os `test-results` do e2e como artefato no CI (diagnóstico futuro)?** **Opções:** (a) incluir neste item se barato; (b) OPS separado. **Recomendação:** (a) — sem artefato, todo diagnóstico de e2e é cego (este item sofreu exatamente isso); custo de uma action de upload no passo de falha. _(assumido — validar no gate)_

## Referências

- Runs de CI: último verde `31359727440` (46e93c14) · primeiro vermelho `31360089829` (07464b88) · run do usuário `31379810869` (733b019f) — logs com stacks das 3 falhas
- Merge suspeito: `07464b88` (PR #548, B188) — dif completo vs `46e93c14`
- Spec: `tests/e2e/campaignAgendaMobile.e2e.spec.ts` (testes :96, :242, :295; 4º teste :173 passa)
- Domínio: `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx`, `src/lib/sollinhaChatSession.ts`, `src/components/campaign/shell/CampaignMobileTopBar.tsx`, `src/components/campaign/activity/ActivityAgendaFilters.tsx`, `src/components/campaign/activity/AgendaViewSelector.tsx`, `tests/e2e/fixtures/campaignE2EFixtures.js`
- `AGENTS.md` (seção "Campaign auth" e "Posts & Tags" não são tocadas; convenção de e2e/worktree sim — verificar `pnpm worktree next` para reprodução local)
