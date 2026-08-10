# Sollinha: follow-ups sugeridos após cada resposta (instruídos no prompt, extraídos pela UI)

Status: rascunho
Atualizado em: 2026-08-09
Issue: #533
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na superfície existente do chat (painel desktop / drawer mobile)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-18/canvases/plan-b192-ui-draft.canvas.tsx
Appetite: ~1 dia eng; instrução no prompt de sistema + extração no cliente + chips; sem migration/schema/Consent

## Intenção

Depois que o Sollinha responde, a conversa muitas vezes **morreria por falta de continuidade**: o usuário lê a resposta, acha interessante, mas não sabe o que perguntar em seguida. Queremos que cada resposta traga **sugestões de continuação** — 2–3 perguntas curtas de follow-up, clicáveis, que disparam no chat. A decisão de mecanismo (validada no gate): **as sugestões vêm na própria resposta** — o prompt de sistema instrui o Sollinha a encerrar a resposta com um bloco de sugestões em formato estável, e a UI do chat **extrai esse bloco do texto** e o transforma nos chips, sem exibi-lo como prosa. Uma única chamada ao modelo: sem segunda chamada, sem endpoint novo, sem modelo menor — o custo é só o punhado de tokens do bloco.

**Decisão de lugar (gate):** os chips de follow-up aparecem **no mesmo lugar dos chips de abertura do B191 — logo acima do input** — e não junto da bolha da resposta. Um único slot de chips do chat: vazio de conversa → chips de abertura (B191); depois da primeira resposta → follow-ups da resposta atual no mesmo slot. Cria aderência visual/funcional: o gesto "toco num chip ali e ele envia" é o mesmo a vida toda do chat.

## Persona e fluxo

- **Persona / contexto:** assessor/coordenador que recebeu uma resposta útil sobre um município/deputado/liderança e quer aprofundar, mas sem formular a próxima pergunta do zero.
- **Job principal:** continuar a conversa na direção certa com um toque, sem digitar.
- **Fluxo desejado:**
  1. Usuário pergunta; o Sollinha responde (streaming termina) e, por instrução do prompt, encerra com um bloco de sugestões.
  2. A UI extrai o bloco, mostra a resposta **sem o bloco** e renderiza 2–3 chips de follow-up **acima do input, no mesmo slot dos chips de abertura do B191**.
  3. Usuário toca num chip → vira a mensagem e é enviada; a próxima resposta substitui os chips do slot.
- **Anti-goals de produto:** follow-ups que não têm relação com a resposta (ruído); chips dentro da bolha da resposta (quebra a aderência com o B191); o bloco aparecendo como texto na conversa; espera do usuário por sugestões (elas chegam junto da resposta, sem turno extra).

## Objetivo e aceite

- A cada resposta final do Sollinha que **inclua** o bloco, o slot de chips acima do input mostra 2–3 follow-ups relacionados ao conteúdo da resposta; a resposta exibida não contém o bloco.
- **Mesmo slot do B191:** conversa vazia → chips de abertura; após a primeira resposta → follow-ups da resposta atual, substituindo os de abertura. O slot reflete sempre a conversa atual — respostas antigas não guardam chips.
- **Fail-closed:** resposta sem bloco, bloco malformado ou truncado → **sem chips, sem erro** — a resposta aparece normalmente como hoje. Nenhum caminho em que a extração estrague a mensagem.
- Tocar num chip envia a pergunta como mensagem do usuário (mesmo mecanismo do B191).
- O prompt instrui o Sollinha a só sugerir perguntas que ele **consegue responder com as próprias ferramentas** e a respeitar o papel do usuário (leader não recebe sugestão eleitoral — lockdown B180).
- A geração não consome cota de mensagens do usuário nem adiciona latência (vem no mesmo stream).

## Dados (intenção)

- **Vou apresentar dados?** Não — chips são textos; nenhuma superfície de dados nova.
- **Decisões desbloqueadas:** a direção de continuidade é decidida pelo próprio Sollinha no momento de responder (o modelo conhece as ferramentas e o que acabou de dizer). O produto define o **contrato do formato** (extraível + degradação legível) e o **teto** (2–3 por resposta).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/ai/systemPrompt.ts` (instrução do bloco: quando incluir, teto, regra de respondibilidade e papel, proibição de repetir o bloco em prosa); `src/components/campaign/shell/ai/CampaignAIChat.tsx` (extração do bloco do texto da mensagem **antes** do render do markdown + render dos chips **no mesmo slot do B191**, acima do input); o slot é um único componente de chips do chat alimentado por duas fontes: catálogo curado (B191, estado vazio) e bloco extraído da última resposta (B192).
- **Precedente a olhar:** `docs/plans/ai-chat-sollinha.md` (v1 — `in-prod`, imutável); `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180 — regra de papel que a instrução do prompt herda); `docs/plans/sollinha-genero-masculino.md` (B179 — precedente de "a voz nasce no prompt", com regra explícita).
- **Risco de acoplamento:** mesma área de render de B187/B188/B191 — sequenciar; a extração deve rodar no texto **antes** de qualquer transformação (links B187, markdown), para não duplicar pós-processamento.

## Dependências

- Soft: **B191** (mesma superfície e primitivo de chip; sequenciar para reusar, não duplicar). Nenhuma dura.

## Fora de escopo

- Segunda chamada de IA para gerar sugestões (inclusive "modelo menor") — dispensada: o bloco vem na mesma resposta.
- Histórico de follow-ups por mensagem antiga (só a resposta atual).
- Personalização por usuário; persistência dos chips (B188 cobre o estado da conversa).
- Enviar follow-up como "sugestão do sistema" (a mensagem enviada é do usuário, sempre).

## Rabbit holes de produto

- **Aderência probabilística do modelo.** Um modelo barato pode esquecer o bloco ou formatá-lo errado em respostas longas e cheias de ferramentas. **Corte:** fail-closed no cliente (sem bloco = sem chips, resposta normal); instrução curta no fim do prompt; smoke com o modelo real antes de confiar.
- **O bloco vaza como texto.** Se a extração falhar e o bloco aparecer na bolha, parece bug. **Corte:** extração antes do render do markdown + formato que, se malformado, degrada legível (parece uma lista comum), nunca uma tag quebrada.
- **Follow-up que o Sollinha não consegue responder.** Modelo sugere "qual a previsão para 2026?" sem ferramenta. **Corte:** regra explícita no prompt ("só perguntas que você responde com suas ferramentas") + teto de 3 — aceita-se risco residual pequeno, menor que o custo de um mecanismo determinístico rígido.
- **Chips em toda resposta, inclusive no meio de cadeia de ferramentas.** **Corte:** a extração só considera a mensagem **final** do turno; o bloco no meio é ignorado.
- **O bloco contamina o histórico.** A mensagem com o bloco volta ao modelo no próximo turno. **Corte:** instrução no prompt de que o bloco é instrução de formato para a interface, não conteúdo da conversa; se o executor preferir, pode limpar o bloco do texto reenviado (detalhe de implementação).

## Questões em aberto (produto)

- **Formato do bloco.** **Opções:** (A) bloco delimitado com rótulo estável no fim da resposta (ex.: uma linha de seção "Sugestões de continuação:" seguida de lista markdown de 2–3 itens) — degrada legível se a extração falhar; (B) comentário HTML/XML (invisível se renderizado cru, porém ilegível se a extração falhar); (C) JSON no fim da resposta (preciso, feio se vazar). **Recomendação:** (A) — o contrato do produto é "extraível **e** degrada legível"; o marcador exato é decisão do executor. _(assumido — validar)_
- **Sempre incluir ou só quando útil?** **Opções:** (A) instrução de sempre incluir 2–3 em respostas factuais; (B) a critério do modelo. **Recomendação:** (A) com teto — a consistência ensina o gesto; o fail-closed cobre os esquecimentos. _(assumido — validar)_
- **Quantos follow-ups por resposta?** **Opções:** (A) 2; (B) 3. **Recomendação:** (B) no desktop, (A) no mobile (largura), igual ao B191. _(assumido — validar)_
- **O slot durante o streaming?** **Opções:** (A) chips somem enquanto a resposta está sendo gerada e os novos entram quando pronta; (B) os chips antigos ficam visíveis até a resposta nova chegar. **Recomendação:** (A) — durante a geração os chips não são acionáveis (input travado); mostrá-los mortos confunde, e a substituição súbita na chegada da resposta é justamente o momento em que o usuário olha o slot. _(assumido — validar)_
- **O clique precisa de confirmação?** **Opções:** (A) envia direto; (B) preenche o input para o usuário revisar (como a transcrição de voz do B173 faz). **Recomendação:** (A) — o chip **é** a escolha; pré-preencher o input quebraria o "um toque". _(assumido — validar)_

## Referências

- `src/utilities/ai/systemPrompt.ts` — onde a instrução do bloco nasce (a voz do Sollinha)
- `src/components/campaign/shell/ai/CampaignAIChat.tsx` — render de mensagens e área do input
- `src/app/(campaign)/campanha/api/ai-chat/route.ts` — endpoint atual (não muda: mesma chamada)
- `docs/plans/sollinha-acoes-rapidas-chat.md` (B191) — irmão: primitivo de chip + curadoria do estado vazio
- `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180) — regra de papel
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-18/canvases/plan-b192-ui-draft.canvas.tsx`
