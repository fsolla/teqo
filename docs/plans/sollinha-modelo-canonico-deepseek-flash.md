# Sollinha no nome canônico `deepseek-flash` (DeepSeek V4.1 Flash)

Status: rascunho
Atualizado em: 2026-09-12
Issue: #945
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng — troca de literal + verificação
Responsável: —

## Intenção

O DeepSeek lançou o V4.1 Flash em 2026-09-10 e o nome canônico na API passou a ser `deepseek-flash` (model version DeepSeek-V4.1-Flash). Os nomes legados `deepseek-v4-flash` e `deepseek-v4-flash-vision-exp` continuam aceitos, mas os modelos foram aposentados: requisições no nome legado são servidas pelo V4.1-Flash ao preço Flash (fonte oficial: https://api-docs.deepseek.com/quick_start/pricing, verificada em 2026-09-12). O humano quer o Sollinha no modelo novo do DeepSeek. Como o alias já entrega o V4.1-Flash, o ganho aqui é ficar no nome canônico antes que o legado suma — não é mudança de comportamento nem economia.

## Persona e fluxo

- **Persona / contexto:** equipe de campanha (coordenação, assessoria, candidato) usando o Sollinha no `/campanha`; em paralelo, o gerador automático de título de demanda.
- **Job principal:** continuar conversando com o Sollinha sem se preocupar com qual nome de modelo está por baixo.
- **Fluxo desejado:** abrir o chat → perguntar → receber a mesma resposta de sempre; internamente o servidor passa a chamar o nome canônico. Nada visível muda.
- **Anti-goals de produto:** não habilitar imagem/visão no chat; não mexer em prompt, tools, rate limit ou sessão; não trocar de provider; não mexer no default do worktree.

## Objetivo e aceite

- O chat do Sollinha passa a chamar `deepSeek('deepseek-flash')` (nome canônico) no lugar do literal legado.
- O gerador de título de demanda acompanha a mesma troca.
- Comportamento visível do chat idêntico: gate de papel (leader lockdown), tools, prompt e sessão intocados.
- Nenhuma capacidade nova exposta: visão do V4.1 continua desligada no chat; provider segue `api.deepseek.com`.

## Dados (intenção)

- **Vou apresentar dados?** Não — troca de literal de modelo em código server-side, sem superfície para o usuário.
- **Decisões desbloqueadas:** N/A.
- **Forma:** N/A.

## Dados da decisão (literais)

- `deepseek-flash` — nome canônico novo (model version `DeepSeek-V4.1-Flash`): 1M contexto, 384K output, thinking mode default, tool calls, JSON, visão (imagem disponível, não habilitada aqui).
- `deepseek-v4-flash` — nome legado ainda aceito; modelo aposentado, requisições servidas pelo V4.1-Flash ao preço Flash.
- Trocar `deepSeek('deepseek-v4-flash')` → `deepSeek('deepseek-flash')` em `src/app/(campaign)/campanha/api/ai-chat/route.ts:62` (chat do Sollinha).
- Trocar `deepSeek('deepseek-v4-flash')` → `deepSeek('deepseek-flash')` em `src/utilities/ai/campaignDemandTitle.ts:31` (título de demanda).
- SDK `@ai-sdk/deepseek` 3.0.19 (package.json) e chave `DEEPSEEK_API_KEY` server-side — nenhum dos dois muda.
- Preço inalterado: tabela Flash (input cache-hit US$0,003/M off-peak e US$0,006/M peak; cache-miss US$0,15/M off-peak e US$0,3/M peak; output US$0,6/M off-peak e US$1,2/M peak; peak = 01:00–04:00 e 06:00–10:00 UTC, seg–sex).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/api/ai-chat/route.ts` e `src/utilities/ai/campaignDemandTitle.ts`.
- **Precedente a olhar:** nenhum específico — troca de string em call site já existente; SDK e fluxo ficam como estão.
- **Risco de acoplamento:** o chat é 100% server-side e o modelo entra só como string; não tocar em gate de papel, tools, prompt ou sessão.
- **Testes:** nenhum teste pina a string do modelo (e2e mockam a rota HTTP; unit/int cobrem só o fallback sem `DEEPSEEK_API_KEY`) — a troca não deve quebrar a suíte.

## Dependências

- Nenhuma.

## Fora de escopo

- Habilitar envio/aceitação de imagem (visão do V4.1) — feature nova, outro item.
- Qualquer mudança em prompt, tools, rate limit ou sessão do Sollinha.
- Troca de provider ou de SDK; default de modelo do worktree (OPS101).
- Editar planos históricos congelados de IA.

## Rabbit holes de produto

- **"O V4.1 tem visão, então já dá para mandar foto".** Se alguém “só completar”: upload, storage, moderação, UI e custo viram um item inteiro. **Corte neste item:** visão continua desligada; só o literal muda.
- **"Modelo novo pede prompt/tools novos".** Se alguém “só completar”: reescrever system prompt e catálogo de tools sem pedido. **Corte neste item:** prompt e tools intocados.
- **"Já que está mexendo, atualiza a SDK".** Se alguém “só completar”: bump de dependência com risco próprio. **Corte neste item:** SDK fica em 3.0.19.

## Questões em aberto (produto)

- Nenhuma — a única pergunta (incluir também o `campaignDemandTitle.ts`?) foi decidida no gate de 2026-09-12: **opção A (sim, os dois call sites)**.

## Referências

- GitHub Issue #945 (B201, após `pnpm agent:register`)
- Rascunho UI (gate): N/A
- Fonte oficial do modelo/preço: https://api-docs.deepseek.com/quick_start/pricing (verificada em 2026-09-12)
- `src/app/(campaign)/campanha/api/ai-chat/route.ts:62` e `src/utilities/ai/campaignDemandTitle.ts:31` — call sites vivos do nome legado.
