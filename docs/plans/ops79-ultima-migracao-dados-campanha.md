# Última migração de dados em produção: plataforma antiga → nova (vertical campanha)

Status: rascunho
Atualizado em: 2026-08-23
Issue: #797
Priority: P1
Impeccable: A — sem UI
Rascunho UI: N/A — sem UI
Appetite: ~2–3 dias eng; um outcome verificável (nenhum dado de operação de campanha viver só na plataforma antiga antes do desligamento)
Responsável: —

## Intenção

Durante a transição, o site continuou vivo em DUAS plataformas: a antiga `pt.jorgesolla.com.br` (Vercel + banco Neon) e a nova `jorgesolla1313.com.br` (homeserver, banco próprio). O time de campanha seguiu usando `/campanha` na URL antiga; depois do OPS51 (migração Neon→homeserver, 2026-08-17), qualquer dado gravado na plataforma antiga ficou órfão da nova. **OPS80 desativa a URL antiga primeiro, congelando a fonte** (nenhuma escrita nova). Este item roda DEPOIS da desativação: trazer para o banco novo o estado final da plataforma antiga, PRINCIPALMENTE a vertical campanha (lideranças, pledges, apoiadores, atividades, usuários da campanha, etc.) — para nenhuma operação de campanha viver só na plataforma antiga no momento em que ela for desligada.

## Persona e fluxo

- **Persona / contexto:** coordinator e staff de campanha que operam `/campanha` diariamente em janela eleitoral ativa; engenharia/ops responsável pelo desligamento da plataforma antiga.
- **Job principal:** nenhum dado de campanha — nem um pledge, apoiador, liderança, atividade ou usuário — viver só na plataforma antiga no momento do desligamento.
- **Fluxo desejado:** OPS80 desativa a URL antiga (fonte congelada, sem escritas novas) → este item captura o estado final da plataforma antiga → o residual é reconciliado e trazido para a nova → contagens conferem (nada órfão, nada duplicado) → `/campanha` segue operando só na plataforma nova, sem perda e sem regressão → a URL antiga permanece desligada.
- **Anti-goals de produto:** NÃO re-migrar tudo por desconfiança; NÃO duplicar municípios/seed nem dados públicos já sincronizados; NÃO virar "conserto" de divergências históricas; NÃO criar superfície nova de edição de dados (isso é planilha-modo).

## Objetivo e aceite

- Após o item, todos os dados de operação de campanha existentes na plataforma antiga existem e estão íntegros na nova — contagens conferem e nenhum registro ficou para trás.
- Nenhuma operação de campanha registrada na plataforma antiga (pledges, apoiadores, lideranças, atividades, demandas, decisões de alocação) precisa ser refeita manualmente na nova.
- Usuários da campanha continuam acessando `/campanha` na plataforma nova sem perda de acesso (senhas/sessões preservadas ou re-emitidas sem re-cadastro).
- Guardrails: dados nominais de cidadãos (PII/LGPD) só migram com o mesmo fail-closed do app (consentimento por chave estável); municípios/semeados não são duplicados; a vertical não regride (assimetria de votos, lockdown de liderança, leitura relativa/local preservadas).

## Dados (intenção)

- **Vou apresentar dados?** Não — migração move dados, não apresenta superfície de decisão.
- **Decisões desbloqueadas:** nada novo que dependa de um dashboard; o que importa é que decisões JÁ existentes continuem íntegras pós-migração: (a) conta da cadeira, (b) mapas e leitura territorial, (c) pledges com `declaredVotes` vs `estimatedVotes` e seus agregados devem refletir o MESMO estado que o time via na plataforma antiga.
- **Forma:** *adiada ao plano de implementação* — aqui só a restrição de produto: o pós-migração precisa produzir a mesma leitura relativa/local que a plataforma antiga mostrava (sem "conserto" silencioso de números).

## Direção no codebase (hipótese)

- **Áreas prováveis:** coleções da vertical campanha (`src/collections/`) e a área de campanha (`src/app/(campaign)/…`, `src/utilities/access/*`); precedente de tooling de dados em `scripts/` (ex.: `scripts/db-pull.mjs`, `pnpm db:pull`).
- **Precedente a olhar:** OPS51 (dump Neon→homeserver, contagens por coleção), OPS58 (sincronização de posts públicos), OPS52 (media) — docs de ops em `docs/ops/` e `docs/plans/`.
- **Risco de acoplamento:** o executor deve respeitar as guardas de dev/test (nunca apontar dev/test para prod) e o fail-closed de consentimento/LGPD — esta migração é operação manual de infra em prod, fora dos guards de dev.

## Dependências

- **OPS80 (duro):** a desativação/congelamento da URL antiga vem ANTES — a fonte precisa estar quiescida para que nenhum dado novo entre entre a última migração e o desligamento.
- Nenhuma dependência suave.

## Fora de escopo

- Cutover de DNS/hospedagem de `pt.jorgesolla.com.br` (OPS80 desativa + OPS81 redireciona).
- Migração de media — já feita em OPS52 (Garage S3); referências antigas são exceção a registrar, não re-migração.
- Cancelamento da conta Neon (pós-OPS80).
- Dados públicos já sincronizados (ex.: posts — OPS58).

## Rabbit holes de produto

- **Merge de delta vs reconciliação limpa.** Se alguém "só completar" com o delta pós-OPS51, uma divergência silenciosa anterior continua escondida; se reconciliar tudo, vira re-migração completa. **Corte neste item:** reconciliar a vertical inteira uma última vez (contagens vs dump OPS51 como linha de base), com o delta como piso — sem re-migrar o que já está íntegro.
- **Copiar dados públicos duplicados.** Trazer posts/assinaturas/signatures de novo criaria duplicidade com o que já foi sincronizado. **Corte:** apenas a vertical campanha é o foco; o resto só se aparecer residual real e verificável.
- **"Consertar" divergências históricas de IDs.** Em vez de aceitar que a fonte de verdade é a nova, alguém pode tentar reconciliar históricos de IDs que já divergiram. **Corte:** nenhuma correção de IDs pós-fato; o aceite é integridade de dados de campanha, não identidade perfeita entre plataformas.
- **Scope creep para re-migrar tudo.** A desconfiança pós-OPS51 pode inflar o item para "re-fazer a migração inteira". **Corte:** escopo é o residual + reconciliação da vertical campanha; fora disso, OPS80 decide.

## Questões em aberto (produto)

- **Qual é a base real da plataforma antiga hoje (Vercel ainda aponta para o Neon)?** **Opções:** (a) Neon — assumir que toda escrita pós-OPS51 foi no Neon e migrar esse residual; (b) outra base — a plataforma antiga já foi repontada e o gap é outro; (c) plataforma antiga inativa desde o OPS51. **Recomendação:** verificação viva (read-only, escrita de teste e leitura de volta em ambas as plataformas) ANTES do cutoff de OPS80 — sem essa verificação, a migração pode estar varrendo o banco errado. A cópia em si roda depois, sobre a fonte congelada. _(assumido — validar com engenharia no momento do desligamento)_
- **Migrar só o delta pós-OPS51 ou reconciliar a vertical inteira?** **Opções:** (a) só delta — rápido, mas deixa divergência silenciosa possível; (b) reconciliar a vertical inteira — mais demorado, mas fecha o risco de dado órfão anterior ao OPS51; (c) delta + reconciliação por contagem. **Recomendação:** (c) — reconciliar por contagem (a mesma verificação do OPS51) com o delta como objeto da cópia. É o único caminho que dá o aceite "nada órfão, nada duplicado" sem re-migrar tudo.
- **O que fazer com senhas/sessões de usuários da campanha?** **Opções:** (a) preservar hashes e sessões como estão — nenhuma interrupção no meio da janela eleitoral; (b) exigir re-login após a migração; (c) re-emitir convites. **Recomendação:** (a) — campanha em janela eleitoral ativa; forçar re-login em massa seria a pior hora para interromper operação. Se a base de origem não for confiável para credenciais, cair em (b), nunca em (c).
- **Referências a media antiga em registros migrados?** **Opções:** (a) migrar apontando para o objeto já no Garage S3; (b) manter URL antiga e registrar exceção; (c) quebrar a referência. **Recomendação:** (a) quando houver equivalente já migrado (OPS52), (b) como exceção registrada caso contrário — nunca (c), imagem quebrada é regressão visível.

## Referências

- GitHub Issue #— (após `pnpm agent:register`)
- OPS51 (migração Neon→homeserver, contagens por coleção) e seu rollback documentado em `docs/ops/teqo-1313-deploy.md`
- OPS52 (media → Garage S3), OPS58 (sincronização de posts públicos), OPS80 (desativa a URL antiga — pré-requisito que congela a fonte), OPS81 (redireciona a URL antiga — roda após esta migração)
- `AGENTS.md` / `AGENTS-campaign.md` — vertical campanha, LGPD (fail-closed de consentimento), guardas de dev/test
