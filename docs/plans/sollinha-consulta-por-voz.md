# Sollinha — consulta por voz no chat

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-08
Issue: #448
Priority: P2
Model: composer-2.5 (pool) / deepseek-v4-flash-high (local)
Impeccable: C — encaixe no input do chat (superfície que o usuário toca)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b173-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Hoje a Sollinha (assistente de IA em `/campanha`) só aceita pergunta em texto digitado. O assessor/coordenador trabalha em campo, muitas vezes com uma mão ocupada ou em pé — digitar uma pergunta sobre dados é atrito. Queremos poder **falar a pergunta** e ela virar a mesma mensagem do chat, mantendo o cérebro atual (DeepSeek + tools de dados + RBAC) intacto.

Decisão de produto coberta aqui (com custo): **converter voz→texto (STT) e reutilizar o fluxo existente**, em vez de mandar o áudio a um modelo multimodal. O modelo atual é texto-only; levar áudio direto a um modelo "que aceita voz" exigiria trocar de provider/modelo, reescrever a camada de tools/RBAC e pagar 20–100× por consulta — tudo por um ganho que o STT bem-feito já entrega. Na prática, até os "voice agents" fazem STT+TTS em volta de um LLM de texto. Custo de STT é desprezível na escala desta equipe (~dezenas–centenas de perguntas/dia × ~10 s de áudio ≈ centavos de dólar/dia).

## Persona e fluxo

- **Persona / contexto:** assessor ou coordenador da campanha em `/campanha` (Field Desk/PWA) — no escritório ou em campo, com o celular ou notebook, sem vontade de digitar (ou com a mão ocupada).
- **Job principal:** fazer uma pergunta à Sollinha em voz, sem tocar no teclado, e receber a mesma resposta que receberia digitando.
- **Fluxo desejado:**
  1. No input do chat, toca no botão de microfone (painel desktop / drawer mobile — mesmas duas superfícies do chat atual).
  2. A barra entra em "Ouvindo…" com indicador + timer enquanto a pessoa fala.
  3. Ao parar (ou confirmar), o áudio vai para transcrição.
  4. A transcrição aparece como **rascunho editável** no campo de texto — a pessoa confere/corrige e envia.
  5. A pergunta segue exatamente o fluxo normal do chat (mesma auth, rate limit, tools, streaming). A resposta chega como hoje.
  6. Sem microfone/permissão negada → mensagem clara; chat por texto segue normal.
- **Anti-goals de produto:** não é "voice agent" conversacional; não é TTS (responder em voz); não armazena gravações; não usa voz como login/biometria; não redesenha o chat (muda só o input).

## Objetivo e aceite

- Fazer toda uma pergunta à Sollinha por voz: tocar no mic → falar → transcrição vira o conteúdo do input → enviar.
- A pergunta por voz passa pelos mesmos guards do chat de texto (autenticação, limite de mensagens, RBAC das tools).
- Áudio processado para transcrição e **não armazenado** — nenhuma gravação fica no banco.
- Perda de áudio / falha de transcrição → a pessoa pode tentar de novo ou digitar; nada quebra o chat de texto.
- Transcrito entra como rascunho editável, nunca enviado automático sem revisão (nomes de municípios/lideranças errados iriam para as tools como se fossem verdade).

## Dados (intenção)

- **Vou apresentar dados?** Não — este item não apresenta métrica nova; é um novo meio de entrada para o mesmo fluxo.
- **Decisões desbloqueadas:** ator digita menos em campo; a pergunta exata que o assessor fez (transcrição) chega às tools igual ao texto.
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** o input do chat vive em `src/components/campaign/shell/ai/CampaignAIChat.tsx` (a `InputGroup` atual já tem placeholder + botão Enviar); o fluxo de resposta é `src/app/(campaign)/campanha/api/ai-chat/route.ts` (o texto transcrito entra pela mesma via); keys de IA em env do Vercel.
- **Precedente a olhar:** `docs/plans/ai-chat-sollinha.md` (entrega original do chat — `in-prod`, imutável; o roadmap dela já previa "botão de microfone → envia para STT → injeta transcrição como sendMessage"); irmãos do mesmo painel: `docs/plans/largura-padrao-chat-sollinha.md` (B166), `docs/plans/migrar-chat-painel-drawer-resize.md` (B167).
- **Risco de acoplamento:** o rate limit (`src/utilities/ai/rateLimit.ts`) é por usuário — perguntas por voz devem contar no mesmo balde para não virar bypass. Nada de escrever áudio em `media`/Blob: transiente. O provider do LLM muda no chore B174 (mesmo `route.ts`/env) — em produção a troca precisa de smoke das tools; a voz não depende dela para existir (STT usa a chave Deep Infra de qualquer forma).

## Dependências

- Soft: **B174** (chore — mover o LLM da Sollinha para a Deep Infra), que o usuário pediu junto; a voz não depende dele, mas os dois compartilham `route.ts`/env e o B174 é pré-condição da consolidação de uma chave só.
- Soft: conviver com os irmãos de painel do chat (B166/B167 já `in-prod`/`in-progress` — a UI do input é compartilhada, cuidado com conflito de edição).

## Fora de escopo

- **TTS / responder por voz** → item sucessor separado (mesma família Sollinha).
- Gravação para reuniões/sumário (o roadmap do chat original pregava isso) → item separado, desbloqueia depois.
- Histórico/threads de conversa → já fora do v1 do chat (mantido).
- Múltiplos provedores selecionáveis → não agora; um único STT configurado.

## Rabbit holes de produto

- **"Voz direta para a IA multimodal".** Se alguém "só completar", troca o modelo e reescreve tools/RBAC por um ganho marginal. **Corte:** entrada por voz = STT + mesmo chat de texto; voz-direta só se um dia quisermos conversa falada completa (item separado, com orçamento próprio).
- **Auto-enviar sem revisão.** Listar como "funciona" sem edição mandaria transcrição errada para as tools. **Corte:** rascunho editável por default; auto-envio no máximo como opção avançada.
- **Persistir gravações "por segurança".** Áudio é dado pessoal de staff + custo/risco LGPD. **Corte:** processar e descartar; sem arquivo, sem collection.

## Decisões de produto (2026-08-08, confirmadas no gate)

- **A transcrição vira rascunho editável**, e o usuário envia — sem auto-send. STT em pt-BR erra nomes próprios (municípios, lideranças) e a pessoa quer conferir antes de virar "fato" para as tools.
- **Não há TTS neste item** — só entrada por voz. Responder em voz fica como item sucessor separado.
- **Fornecedor de STT: Deep Infra Whisper large-v3** (US$ 0,00045/min), mesma conta/chave do LLM — sem fornecedor novo. **Roda no browser foi avaliado e rejeitado:** Whisper via transformers.js/WebGPU é viável só até `small` (qualidade inferior ao large-v3 que a Deep Infra serve, ~590 MB de download, 2,5–3 GB inviável no celular); WebGPU é experimental no Safari e ausente no Firefox; no celular (principal superfície do Field Desk) é lento e pesado; e o chat já exige rede (DeepSeek/Payload), então on-device não compra nada — o custo servidor é desprezível (≈ US$ 0,00008/pergunta). Web Speech API nativa rejeitada: inconsistente, sem contrato com o fornecedor de voz e com suporte pt-BR local só experimental no Chrome.
- **Prioridade P2** — Sollinha v1 é recém-deployada e sem métricas de uso ainda; validar aderência de texto antes de acelerar voz.
- **LLM continua DeepSeek-V4-Flash, servido pela Deep Infra** (2026-08-08): avaliado o catálogo de texto da Deep Infra — Qwen3-32B (US$ 0,08/0,28) só é mais barato no input e perde no output e muito na capacidade (tool calling/pt-BR); Qwen3-235B/30B-A3B empatam ou pagam 2–6× o output; GLM-4.6 é 4–5×. V4-Flash (US$ 0,09/0,18, 1M ctx, MoE 13B ativos) segue imbatível no custo/poder pra ler dados com tools. A mudança é **mover o provider de `@ai-sdk/deepseek` (API oficial) para a Deep Infra** — mesmo endpoint OpenAI-compatível e mesma chave do STT — capturada no chore B174 (item separado; `smoke` das tools antes de prod, pois Sollinha já está em produção e o routing de tools é o músculo dela).

## Referências

- GitHub Issue: #448 (B173)
- Canvas UI (gate): /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b173-ui-draft.canvas.tsx
- `src/components/campaign/shell/ai/CampaignAIChat.tsx` — input do chat
- `src/app/(campaign)/campanha/api/ai-chat/route.ts` — fluxo da resposta
- `src/utilities/ai/rateLimit.ts` — balde por usuário
- `docs/plans/ai-chat-sollinha.md` — precedente (imutável)
