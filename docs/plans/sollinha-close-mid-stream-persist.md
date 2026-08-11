# Sollinha: fechar o drawer durante streaming pode reabri-lo num reload (race de persistência)

Status: registrado
Atualizado em: 2026-08-11
Issue: #<N>
Priority: P3
Model: composer-2.5
Impeccable: B — comportamento do drawer existente, sem nova superfície
Appetite: ~0,5 dia eng; um ajuste no persist effect do provider

## Intenção

O persist effect do chat (`CampaignAISidebarContext.tsx`) só grava a sessão quando `status === 'ready'`. Se o usuário fecha o drawer enquanto a resposta ainda está chegando (X manual, swipe — ou, desde B198, um toque num link da resposta que fecha o drawer no mesmo tab) e um reload acontece antes do settle, o `sessionStorage` ainda carrega o estado velho `open: true` — o restore reabre o drawer "sozinho" na próxima página (mesma classe OPS22 que o repo já caça).

Pré-existente (o X tinha a mesma janela), mas o link-navegação do B198 torna o fechamento-durante-streaming um fluxo normal de campo: o usuário toca no link no meio da resposta, o drawer fecha, ele navega; um reload (ou o próprio fluxo de volta) não deve ressuscitar o drawer.

## Persona e fluxo

- **Persona / contexto:** assessor/liderança no celular; toca num link interno enquanto o Sollinha ainda está respondendo.
- **Job principal:** fechar o drawer em qualquer momento (mesmo mid-stream) e ter um reload sem drawer fantasma.
- **Fluxo desejado:** resposta em streaming → toque no link → drawer fecha → reload → drawer continua fechado, conversa restaurada.
- **Anti-goal:** não reabrir a raça de restore (OPS22/B188): fechar mid-stream não pode ser tratado como "estado velho válido".

## Objetivo e aceite

- Fechar o drawer com `status !== 'ready'` persiste `open: false` mesmo antes do settle — um reload imediato não reabre o drawer.
- A conversa em andamento continua persistindo normalmente (nada de descartar mensagens do stream em andamento).
- O mecanismo `openBy`/`userToggledOpenRef` continua governando o restore como hoje (não inverter intenção).

## Dados (intenção)

Dados: N/A — persistência client-side (`sessionStorage`), sem servidor.

## Direção no codebase (hipótese)

- **Área provável:** `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx` — o persist effect (linhas ~116-121) hoje early-returna com `status !== 'ready'`. Hipótese: persistir `open` em mudanças imediatas (efeito separado só para `open`, sem gate de status, reusando `writeSollinhaChatSession` com as mensagens atuais do último commit), deixando o gate de `status` apenas para as mensagens do stream. Validar interação com `sessionRestored` e com o write do settle (que já escreve tudo junto).
- **Precedente a olhar:** `src/lib/sollinhaChatSession.ts` (write/read fail-closed), `docs/plans/sollinha-contexto-sessao-janela.md` (B188) e `sollinha-drawer-fecha-link-mobile-impl.md` (B198).
- **Risco:** escrever a sessão com um `messages` mid-stream congelaria uma resposta pela metade no storage — se o write de `open` e o write de `messages` forem o mesmo `writeSollinhaChatSession`, o gate de mensagens precisa continuar (ou o write de close pode usar o último snapshot `ready` de mensagens).

## Dependências

- #660 (B198) — o fluxo de fechamento por link é o amplificador; destrava sozinha quando o pai flipar `done`.

## Fora de escopo

- Mudar o mecanismo de restore/`openBy` (OPS22/B188) — só o write de fechamento.
- Persistir mensagens mid-stream (mantém a regra atual de só gravar stream completo).

## Rabbit holes de produto

- **Escrever o stream pela metade.** Se o ajuste gravar `messages` mid-stream, um reload perde a cauda do turno. **Corte:** fechamento persiste `open: false` com o snapshot de mensagens do último estado `ready` (ou o array atual se vazio/estável).
- **Reabrir a raça de restore.** Mexer em `openBy` para "consertar" isto troca um bug raro por outro. **Corte:** só o `open` muda; `openBy` continua como hoje.

## Questões em aberto (produto)

- Nenhuma — comportamento: fechar é fechar, em qualquer fase do turno.

## Referências

- GitHub Issue #<N> (pai: #660)
- `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx`, `src/lib/sollinhaChatSession.ts`
- `docs/plans/sollinha-contexto-sessao-janela.md`, `docs/plans/sollinha-drawer-fecha-link-mobile-impl.md`
