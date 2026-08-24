# Verificação de VALORES (não só entidades) da migração pt.jorgesolla.com.br → jorgesolla1313.com.br — foco nas estimativas de votos

Status: rascunho
Atualizado em: 2026-08-24
Issue: #828
Priority: P1
Impeccable: A — sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia; um outcome verificável
Responsável: —

## Intenção

Após a migração final para `jorgesolla1313.com.br` (vindo de `pt.jorgesolla.com.br`), usuários reportaram que "alguns dados estão desatualizados" — especificamente os VALORES das estimativas de votos. O OPS79 reconciliou a vertical campanha entre a fonte (Neon, congelada pelo OPS80) e a nova base — mas conferiu apenas CONTAGENS e CONJUNTOS DE IDs (a ferramenta lê só `SELECT id FROM …`; nunca valores de colunas). Ou seja: as entidades foram conferidas; os valores (ex.: votos declarados e os três cenários de estimativa de cada compromisso de votos) NÃO foram. Este item verifica de novo se "migramos tudo" — agora no nível de valores — e, havendo divergência, abre uma decisão pontual de fonte de verdade, sem re-migrar tudo.

## Persona e fluxo

- **Persona / contexto:** coordinator e staff de campanha que leem/ajustam estimativas de votos por município em `/campanha` (janela eleitoral ativa) e reportaram números "desatualizados"; engenharia/ops responsável pelo fechamento da plataforma antiga.
- **Job principal:** saber, com evidência, se os números que o time vê hoje são os mesmos que foram gravados até o congelamento da plataforma antiga — e, se não, o que exatamente divergiu.
- **Fluxo desejado:** o item roda uma verificação read-only comparando os valores das tabelas da vertical campanha entre a fonte congelada e a base nova → produz um relatório de divergência por tabela/coluna (foco: estimativas de votos) → ou "zero divergência" (dúvida dos usuários encerrada com evidência) ou "N divergências listadas" → humanos decidem pontualmente o que fazer com o delta → `/campanha` segue operando sem re-migração e sem escrita automática de números.
- **Anti-goals de produto:** NÃO re-migrar tudo por desconfiança; NÃO "consertar" IDs; NÃO criar superfície nova de edição de dados (planilha-modo); NÃO corrigir divergências históricas de valores sem evidência — este item VERIFICA e REPORTA; conserto é decisão posterior.

## Objetivo e aceite

- Relatório read-only comparando os VALORES (todas as colunas de conteúdo, não só ids) das tabelas da vertical campanha entre fonte (Neon congelado) e base nova, com divergência por tabela/coluna — foco confirmado em `vote_pledge` (votos declarados + 3 cenários de estimativa).
- Aceite: **ou** "0 divergência de valores" (responde a dúvida dos usuários com evidência) **ou** "N divergências listadas" → decisão humana pontual sobre o delta (documentada no relatório).
- Guardrails: nenhuma reescrita silenciosa de números; leitura relativa/local preservada; assimetria de votos preservada (líder não vê estimativas); nenhum dado nominal de cidadão (PII) sai do homeserver; verificação é somente leitura.

## Dados (intenção)

- **Vou apresentar dados?** Não — o relatório de divergência é artefato de verificação (ops, sem UI), não superfície de dados do produto.
- **Decisões desbloqueadas:** engenharia/coordenação — (a) confirmar com evidência que os valores migrados estão íntegros, encerrando a dúvida reportada; (b) havendo divergência, escolher pontualmente a fonte de verdade (antiga vs nova), nunca copiando às cegas.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: comparação 1:1 por registro/coluna, sem julgamento de "certo/errado" no relatório, sem % estadual absoluto, leitura relativa/local preservada.

## Direção no codebase (hipótese)

- **Áreas prováveis:** ferramenta herdada do OPS79 em `scripts/reconcile-campaign-vertical.mjs` (hoje só compara ids/counts; extensão natural para valores); helpers compartilhados em `scripts/lib/cli.mjs`; a vertical campanha em `src/collections/` (schema de `vote_pledge` com os 3 cenários de estimativa).
- **Precedente a olhar:** OPS79 (baseline + ferramenta read-only), OPS80 (congelamento da fonte), padrão de scripts com guarda explícita de escrita (ex.: `*_CONFIRM=1` + flag `--dry-run`/`--apply`).
- **Risco de acoplamento:** script de dados de prod roda 100% no homeserver; nunca apontar dev/test para prod; PII nunca sai do homeserver (o relatório não deve imprimir dados nominais — só ids/counts/valores não nominais); janela crítica: rodar ANTES do OPS81 desligar o Neon.

## Dependências

- **OPS79 (duro):** baseline e ferramenta herdada — este item estende o que ele entregou.
- **OPS80 (duro):** congelamento da fonte já ocorrido (2026-08-23) — pré-condição para uma comparação estável.
- **Janela operacional (não é dependência de issue):** o OPS81 (desligamento do Neon) encerra a janela de acesso à fonte viva — registrar no plano; se o Neon estiver inacessível, usar o dump do OPS51 como base de comparação.

## Fora de escopo

- OPS81 — desligamento/redirect da plataforma antiga (issue própria).
- Re-migração da vertical campanha — só se a decisão humana pós-relatório apontar isso, como item novo.
- Correção de IDs ou de divergências históricas de valores — a decisão é posterior ao relatório, nunca automática neste item.
- Auditoria de dados públicos já sincronizados (posts/assinaturas) sem evidência de problema — OPS58 já cobriu.
- Migração de media — já feita (OPS52).

## Rabbit holes de produto

- **"Consertar" a divergência no próprio item.** Se alguém "só completar" o desejo de verificação com correção automática, vira re-migração silenciosa de valores — exatamente o que os usuários não pediram. **Corte neste item:** verificar e reportar; qualquer cópia de valores é decisão humana pontual, item separado.
- **Comparar valores "com julgamento".** Normalizar, arredondar ou escolher o "certo" durante a verificação esconde o delta em vez de revelá-lo. **Corte:** divergência 1:1 crua por tabela/coluna; interpretação fica para a decisão humana.
- **Estender para tudo que existe.** "Já que vamos conferir, audita o site inteiro". **Corte:** escopo é a vertical campanha (foco declarado: estimativas de votos); público só se houver evidência de problema, em item próprio.
- **Vazar PII ou rodar fora do homeserver.** Verificação "mais rápida" localmente arrastaria dados nominais para fora do ambiente seguro. **Corte:** execução 100% no homeserver; relatório sem dados nominais.

## Questões em aberto (produto)

- **Se houver divergência de valores em compromissos de votos, qual é a fonte de verdade?** **Opções:** (a) Neon/antiga — o time editou lá até o congelamento; (b) base nova — edições legítimas feitas após a migração; (c) decidir por recência de atualização, registro a registro. **Recomendação:** (c) — comparar a data de atualização dos registros divergentes para classificar o delta (só se houver), com decisão humana pontual sobre cada caso; nunca copiar às cegas nem "consertar" silenciosamente. _(assumido — validar com produto)_
- **Escopo da verificação: só estimativas de votos ou a vertical inteira?** **Opções:** (a) só a tabela de compromissos de votos (o reportado); (b) as 13 tabelas da vertical com divergência de TODAS as colunas de conteúdo; (c) vertical + amostragem de dados públicos. **Recomendação:** (b) — comparação registro a registro por id com divergência de colunas nas 13 tabelas da vertical (mesmo custo da verificação do OPS79); responde "verificamos tudo, não só entidades" sem inflar; estimativas de votos são o foco declarado do relatório. _(assumido — validar com produto)_
- **O que fazer se o Neon não estiver mais acessível quando o item rodar?** **Opções:** (a) verificar contra o dump da migração inicial (base gravada); (b) abortar e reabrir o OPS81; (c) assumir que a base nova é a fonte. **Recomendação:** (a) — dump como base de comparação, mas o ideal é rodar com o Neon vivo; o item DEVE ser agendado antes do OPS81, e o relatório deve declarar qual base foi usada. _(assumido — validar com produto)_

## Referências

- GitHub Issue #828
- OPS79 (#797 — baseline + ferramenta de reconciliação herdada) e seu impl `docs/plans/ops79-ultima-migracao-dados-campanha-impl.md`
- OPS80 (congelamento da fonte) e OPS81 (desligamento — encerra a janela de acesso ao Neon)
- OPS51 (migração Neon→homeserver; dump como base de comparação de fallback) e runbook em `docs/ops/teqo-1313-deploy.md` (envs no homeserver: `NEON_DATABASE_URL` em `~/stack/.env`; `DATABASE_URL` em `~/stack/teqo-1313.env`)
- `AGENTS.md` — guardas de dev/test, PII, convenções de scripts de dados (escrita exige guarda explícita)
