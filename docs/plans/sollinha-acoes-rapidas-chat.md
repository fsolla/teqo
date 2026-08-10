# Sollinha: ações rápidas de abertura no chat (chips de pergunta)

Status: rascunho
Atualizado em: 2026-08-09
Issue: #532
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na superfície existente do chat (painel desktop / drawer mobile)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-18/canvases/plan-b191-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; chips acima do input + envio como mensagem do usuário; sem migration/schema/Consent

## Intenção

O Sollinha abre com uma tela em branco: o usuário precisa **inventar a primeira pergunta** do zero. Para quem está conhecendo o assistente (ou voltando com pressa), isso é atrito — o chat existe justamente para economizar tempo. Queremos que o chat abra com **sugestões de próxima ação prontas**: chips logo acima do input, com perguntas como "Quais as prioridades da campanha agora?", "Alguma demanda em aberta?" ou "Como está o município de X?". O clique **dispara a pergunta diretamente no chat** — o chip não navega para lugar nenhum, apenas vira a mensagem do usuário, como se tivesse sido digitada.

## Persona e fluxo

- **Persona / contexto:** assessor/coordenador abrindo o chat pela primeira vez na sessão ou após uma pausa; não sabe o que o Sollinha sabe fazer, ou sabe mas não quer digitar.
- **Job principal:** fazer a primeira pergunta útil em um clique, descobrindo de relance o que dá para perguntar.
- **Fluxo desejado:**
  1. Abre o chat (painel desktop ou drawer mobile) — conversa vazia.
  2. Acima do input aparecem 3–4 chips com perguntas prontas.
  3. Usuário toca num chip → o texto vira a mensagem e é enviada como se digitada; os chips de abertura somem (a conversa começou).
- **Anti-goals de produto:** chips que **navegam** (isso é busca/FAB, não chat); chips que persistem depois que a conversa começou; lista infinita de sugestões; personalização por histórico de uso no v1.

## Objetivo e aceite

- Com a conversa vazia, o chat mostra chips de pergunta acima do input, em vez de só o placeholder vazio.
- Tocar num chip envia aquela pergunta como mensagem do usuário e remove os chips de abertura.
- Cada chip sugere uma pergunta que o Sollinha **consegue responder bem hoje** (nada de sugerir o que o assistente não tem ferramenta para responder).
- Chips respeitam o papel: um leader não vê chip que aciona ferramenta eleitoral travada para ele (fail-closed, precedente B180).
- Funciona no painel desktop e no drawer mobile; tema claro e escuro.

## Dados (intenção)

- **Vou apresentar dados?** Não — chips são textos; nenhuma métrica ou superfície de dados nova.
- **Decisões desbloqueadas:** nenhuma nova. A curadoria de chips segue a capacidade real das ferramentas do Sollinha (a lista vive como dado de configuração, não em código espalhado).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/ai/CampaignAIChat.tsx` (área do input — o slot de chips fica acima do `InputGroup`, ocupado pelos chips de abertura quando `messages.length === 0` e `status === 'ready'`); a lista de perguntas como catálogo estático (molde: `src/lib/sollinhaChatPanelWidth.ts` para persistência local / catálogos em `src/lib/`). **O slot é compartilhado com o B192** (follow-ups da última resposta ocupam o mesmo lugar acima do input) — o componente de chips nasce aqui e o B192 o reusa.
- **Precedente a olhar:** `docs/plans/ai-chat-sollinha.md` (v1 — `in-prod`, imutável); `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180 — leader não acessa ferramentas eleitorais; a curadoria dos chips herda essa regra); `docs/plans/sollinha-contexto-sessao-janela.md` (B188 — irmão na mesma superfície).
- **Risco de acoplamento:** mesma área de render de B187 (links) e B188 (sessão) — os três mudam `CampaignAIChat.tsx`; feitos em sequência, sem conflito. B192 (follow-ups) reusará o primitivo de chip deste item.

## Dependências

- Nenhuma dura. Soft: B188 (se o estado vazio sobreviver à navegação, os chips aparecem de novo no mesmo estado — sem conflito).

## Fora de escopo

- Follow-ups após cada resposta (item irmão **B192**).
- Sugestões personalizadas por histórico/uso do usuário; chips que navegam para telas.
- Adicionar chips que dependem de ferramentas ainda não entregues (ex.: "prioridades do momento" e "demandas em aberto" entram quando B186 e uma ferramenta de demandas existirem — ver Questões em aberto).

## Rabbit holes de produto

- **Chip que sugere pergunta sem resposta.** Se um chip disparar "Quais as prioridades agora?" e o Sollinha não tiver ferramenta para isso, a primeira impressão do produto vira frustração. **Corte:** curadoria por capacidade real das ferramentas; chips questionáveis só entram junto com a ferramenta.
- **Virar um gerador de sugestões complexo.** Personalização, ML, ordenação por frequência — tudo isso custa caro para pouco ganho. **Corte:** lista estática curada de ~4 chips, em configuração, sem inteligência no v1.
- **Chips atrapalhando quem já sabe o que quer.** **Corte:** aparecem só com conversa vazia; somem no primeiro envio; não roubam altura do input.

## Questões em aberto (produto)

- **Qual o conjunto de chips do v1?** As três perguntas do pedido ("Qual minha próxima ação de maior valor?", "Alguma demanda em aberta?", "Quais as prioridades da campanha agora?") dependem de ferramentas ainda não entregues (B186 + uma tool de demandas não existe). **Opções:** (A) v1 só com perguntas que o Sollinha responde bem hoje (votos por município, deputado mais votado, dobradinhas, lideranças, situação do município), com a lista em configuração para crescer; (B) incluir as três do pedido mesmo assim, aceitando respostas fracas; (C) travar este item até B186/tool de demandas. **Recomendação:** (A) — entrega valor imediato sem queimar a primeira impressão; as três do pedido entram no catálogo assim que as ferramentas existirem. _(assumido — validar)_
- **Um conjunto para todos os papéis?** **Opções:** (A) mesma lista para todo mundo; (B) lista filtrada por papel (coordinator/candidate: conjunto cheio; advisor: conjunto cheio do seu escopo; leader: conjunto mínimo seguro, sem eleitoral). **Recomendação:** (B) — é a leitura da regra de lockdown existente (B180) aplicada ao que se **sugere**, não só ao que se responde. _(assumido — validar)_
- **3 ou 4 chips?** **Opções:** (A) 3, sempre; (B) 4 no desktop e 3 no mobile (largura). **Recomendação:** (B) — o drawer mobile é estreito; o catálogo decide por viewport. _(assumido — validar)_

## Referências

- `src/components/campaign/shell/ai/CampaignAIChat.tsx` — área do input (estado vazio + envio)
- `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx` — `messages`/`status`/`sendMessage` (chips usam exatamente `sendMessage({ text })`)
- `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180) — regra de papel que a curadoria herda
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-18/canvases/plan-b191-ui-draft.canvas.tsx`
