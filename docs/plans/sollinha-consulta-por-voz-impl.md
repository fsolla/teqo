# Impl: B173 — Sollinha: consulta por voz no chat

Status: aprovado
Atualizado em: 2026-08-08
Issue: #448
Intenção: docs/plans/sollinha-consulta-por-voz.md
Appetite restante: ~0,5–1 dia (herdado)
Impeccable: C — encaixe no input do chat (superfície que o usuário toca)

## Leitura da intenção

- **Outcome:** O assessor/coordenador fala a pergunta no chat da Sollinha; a transcrição vira **rascunho editável** no campo de texto; ele confere e envia pelo fluxo normal (mesma auth, rate limit, tools, streaming). Áudio nunca é armazenado. Sem mic/permissão → mensagem clara, chat por texto intacto.
- **O que NÃO negociar:** rascunho editável (sem auto-send); **sem TTS**; áudio processado e descartado (sem collection, sem Blob/media, sem Consent — nada persiste); STT servidor via **Deep Infra Whisper large-v3**, mesma chave `DEEPINFRA_API_KEY` do LLM (converge com B174); perdas/falha de transcrição nunca quebram o chat de texto; respostas de voz passam pelos mesmos guards (auth + rate limit + RBAC das tools).
- **O que reavaliar:** a "Direção no codebase" da intenção previa "botão no `InputGroup` + injeta transcrição como `sendMessage`" — a **decisão de produto confirmada** (2026-08-08) é **rascunho editável no input** (`setInput`), não auto-send. O provider STT é **Deep Infra** (REST direto no `route`), não Assembly AI do roadmap original. A hipótese de "uma nova rota irmã em `campanha/api/`" está correta.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph client [CampaignAIChat]
    useMicTranscript -- FormData(file) --> transcribe[POST /campanha/api/ai-transcribe]
    mic[botão mic no InputGroup]
    textarea[textarea rascunho editável]
    useChat -- sendMessage --> chat[/campanha/api/ai-chat]
  end
  subgraph server [Rota transcribe]
    auth[getCampaignUserRaw]
    rl[checkRateLimit user.id]
    origin[isSameOriginRequest]
    fwd[fetch Deep Infra /v1/openai/audio/transcriptions]
  end
  subgraph dl [Deep Infra]
    wh[whisper-large-v3]
  end
  mic --> useMicTranscript --> transcribe --> auth --> rl --> origin --> fwd --> wh
  transcribe --> textarea --> useChat --> chat
```

**Opções consideradas:**

- **A — Nova rota `POST /campanha/api/ai-transcribe`** (irmã de `ai-chat`, mesma pasta `campanha/api/`), auth cookie + rate limit mesmo balde + mesma-origem; recebe o blob em `FormData(file)` e faz `fetch` à Deep Infra. Retorna `{ text }`.
- **B — Server action** do lado do cliente chamando DirectDeep Infra. Rejeitada: body size limit de server actions no Next (clips longos batem no limite), e foge do padrão irmão de `ai-chat` (rota explícita com `maxDuration`, debugável/smokcável em prod).
- **C — STT direto do browser** (Web Speech / on-device / fetch direto com a chave). Rejeitada pela intenção (gate 2026-08-08): Web Speech inconsistente/sem contrato com o provedor; Whisper on-device só até `small` com 590 MB+ no celular; chave seria vazada no cliente. A Deep Infra em servidor é o desfecho decidido.

**Recomendação: A** — porque reusa o padrão canônico das rotas autenticadas de `/campanha` (`ai-chat` é a precedente), mantém a chave no servidor, permite `maxDuration` explícito e é a superfície mais fácil de smoke em produção (a mesma família que B174 toca, sem conflitar em arquivo).

**Decisões de engenharia (caras, com rejeitadas):**

1. **Rate limit no transcribe.** Opções: A) `checkRateLimit(user.id)` também no transcribe (pergunta por voz = 1 unidade no transcribe + 1 no send = **2 unidades** do balde 50/15min) | B) não limitar o transcribe (só o send conta; STT é ~US$0,00008/consulta). **Recomendação: A** — a intenção é explícita ("contar no mesmo balde para não virar bypass") e fail-closed; ~25 perguntas de voz/15min é folgado para assessor de campo. B rejeitada: endpoint de STT viraria superfície de custo sem freio (autenticado, mas spamável).
2. **Formato do áudio enviado.** o `MediaRecorder` do Chrome/Android (Field Desk — superfície principal) produz `webm/opus`; Safari produz `mp4/aac`. **Opções:** A) mandar o blob como está no `file` (OpenAI-compat aceita webm/aac via ffmpeg) | B) converter client-side para WAV 16kHz mono (~50 linhas, módulo puro testável) no hook. **Recomendação: A** — menos código, e Whisper lê webm/aac; o smoke em prod valida. **Gatilho de revisita:** se o smoke devolver 4xx de formato, adicionar o conversor WAV (opção B, módulo puro `lib/`, unit-testado) — registrado como débito/fix no impl, não bloqueia.
3. **Onde vive a lógica de captura.** Opções: A) hook `useMicTranscript` (`src/components/campaign/shell/ai/`) | B) inline em `CampaignAIChat`. **Recomendação: A** — encapsula getUserMedia/MediaRecorder/fetch/decode dos erros uma vez e deixa o componente render-only; é o caso "encapsulate once" do engineering-brief (conhecimento que vazaria no componente senão). Componente continua o dono da superfície (edita o owner, não cria twin).
4. **Same-origin no transcribe.** Embora a rota entre no allowlist do `campaignJsonMutationRoute` (multipart, não JSON), aplicar `isSameOriginRequest` explicitamente (403) como a rota membro de `/campanha` — barato, defense-in-depth.

### Componentes / mudanças

- **`src/app/(campaign)/campanha/api/ai-transcribe/route.ts`** (nova): `export const maxDuration = 60`; `getCampaignUserRaw()` → 401; `checkRateLimit(user.id)` → 429 (mesma mensagem do `ai-chat`); `isSameOriginRequest(request)` → 403; lê `FormData.file`; delega a transcrição; retorna `{ text }` (200) ou `{ error }` com status. **Não armazena nada** (áudio fica só na memória da função).
- **`src/utilities/ai/deepInfraTranscribe.ts`** (nova, sob `utilities/ai/` — subpasta, fora do pin top-level): função pura-ish `deepInfraTranscribe(file: Blob): Promise<string>` que monta o `FormData` (`file`, `model: 'openai/whisper-large-v3'`, `language: 'pt'`), `fetch('https://api.deepinfra.com/v1/openai/audio/transcriptions', { method: 'POST', headers: { Authorization: Bearer DEEPINFRA_API_KEY }, body })`, e devolve `response.text` (OpenAI JSON `{ text }`) — **única costura de rede**, 100% testável com `global.fetch` mockado. A chave vem de `process.env.DEEPINFRA_API_KEY`.
- **`src/components/campaign/shell/ai/useMicTranscript.ts`** (nova): estados `idle | recording | transcribing | error`; `transcript`, `errorMessage`, `elapsed` (timer), `start()`, `stop()`, `dismissError()`. Gerencia `getUserMedia({ audio: true })` + `MediaRecorder` (chunks → `Blob`), `URL.createObjectURL` não necessário; envia `FormData` ao transcribe; mapeia 401/429/502/'chave ausente' para pt-BR; faz cleanup (para tracks, revoga streams) em `stop`/unmount. Cap de segurança ~60 s de gravação (timer) para evitar clip infinito.
- **`src/components/campaign/shell/ai/CampaignAIChat.tsx`** (editar): botão mic (`InputGroupButton`, ícone `Mic`/`Square`/`Spinner`) antes do Send no `InputGroup`; `aria-label`/`aria-pressed`; estados visuais ("Ouvindo…" + timer pulsante, spinner em transcrição); ao obter `transcript` → `setInput(transcript)` (draft editável) + focus no textarea; erro → linha inline (`Marker`/status) com retry e **chat por texto funcional** (não desabilita o input). `disabled={busy}` (chat respondendo) e sem suporte a `MediaRecorder`. Cobre **as duas superfícies** de uma vez (sidebar desktop + drawer mobile renderizam o mesmo `CampaignAIChat`).
- **`codebaseConventions.unit.spec.ts`** (editar): adicionar `src/app/(campaign)/campanha/api/ai-transcribe/route.ts` ao allowlist do sweep "POST routes sob src/app" com justificativa ("multipart não-JSON irmão do ai-chat, auth cookie + same-origin").
- **`.env.example`** (editar): adicionar bloco `DEEPINFRA_API_KEY` (converge com B174; mantém `DEEPSEEK_API_KEY` atual enquanto o chat estiver no provider antigo em `main`).
- **Migration:** sem migration (nenhum schema/collection; áudio transiente).
- **Access / Consent:** intocados — auth/session do chat existente; **sem** nova chave Consent (nada persiste); RBAC das tools reusado no fluxo de envio final.
- **UI:** Impeccable C — shape→craft→polish no encaixe do input; tokens `data-theme='campaign'`; shells existentes (`InputGroup`, `Marker`); sem novo componente de página.

### Dados → forma

N/A — não apresenta métrica nova (intenção: "novo meio de entrada para o mesmo fluxo"). A única "forma" é o rascunho editável + estados do mic, descritos acima.

## Fases verificáveis

1. **Server / STT** — `deepInfraTranscribe.ts` + unit (mock `global.fetch`: header Bearer, model `openai/whisper-large-v3`, language `pt`, parse de `{ text }`, tratamento de erro HTTP) → rota `ai-transcribe` (auth/rate/origin/FormData). Gate: `pnpm gate:fast`.
2. **Client** — `useMicTranscript` + unit (stub `getUserMedia`/`MediaRecorder` no jsdom: transcribe ok -> `transcript`; permissão negada -> `errorMessage` pt-BR; stop/dispose) → `CampaignAIChat` (mic no InputGroup, estados, draft no textarea) → allowlist + `.env.example`.
3. **E2E + gates** — `tests/e2e/aiTranscribe.e2e.spec.ts`: `addInitScript` stub de `getUserMedia`/`MediaRecorder` + `page.route('**/campanha/api/ai-transcribe')` retornando `{ text: 'Quantos votos em Ilhéus?' }`; asserta rascunho no textarea → send → `ai-chat` mockado responde; caminho de erro (permissão negada → mensagem + chat texto segue usável). `pnpm gate:fast` na iteração; entrega via `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- VAD/detecção de silêncio — corte: tap-to-stop (o "confirmar" do fluxo da intenção); Whisper lida com pausas.
- TTS / responder por voz — item sucessor separado (fora de escopo da intenção).
- Converter webm→wav no cliente **por fazer** — só se o smoke reprovar o formato (ver decisão 2).
- Persistir histórico/áudio, telemetria de "quantas perguntas por voz", múltiplos provedores STT selecionáveis.
- Mexer no `ai-chat/route.ts` (LLM/tools) — não toca este item; B174 é chore separado.

## Riscos e mitigação

- **Deep Infra rejeita webm/opus/aac** → smoke em prod com 1 clip real; fallback documentado = conversor WAV em `lib/` (decisão 2, gatilho explícito).
- **Pré-condição operacional:** `DEEPINFRA_API_KEY` precisa existir na env de produção Vercel (mesma chave do B174); no env local teste/e2e **mockam** a rota → nenhuma chave real no CI (mesmo padrão do `ai-chat`).
- **`.env.example` converge com B174** (mesma var) → conflito trivial de merge, resolvido no rebase; ambos apontam para o mesmo name.
- **Chave ausente em produção** → rota responde 502/500 com mensagem pt-BR "Transcrição indisponível" e o chat por texto continua; nunca auto-send.
- **Rate limit 2-unidades por pergunta de voz** → intencional (decisão 1); reavaliar subindo `MAX_MESSAGES` se a telemetria de campo mostrar aperto (débito observável, não inflar agora).

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: mic → ouvir → transcrição como rascunho editável → envio pelo fluxo normal; áudio não persiste; sem TTS.
- [ ] Invariantes AGENTS/engineering-standards: auth cookie `campaign-token`; rate limit mesmo balde; `server-only` onde for preciso; `lib/` nunca importa `utilities`; zero dead code (knip); `pnpm gate:fast` + `pnpm push`.
- [ ] Testes de domínio previstos: unit `deepInfraTranscribe` (rede mockada) + `useMicTranscript` (stubs browser) + e2e do fluxo completo com a rota mockada.
- [ ] Conversão WAV adiada só com gatilho de smoke (decisão 2) — registrado como débito observável, não bloqueia.
