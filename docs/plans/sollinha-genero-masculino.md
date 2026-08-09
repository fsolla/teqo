# B179 — Sollinha: persona no gênero masculino (prompt + referências .md)

Status: entregue (2026-08-09 — prompt + UI no masculino)
Atualizado em: 2026-08-09
Issue: #462
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (édito de texto/persona; sem superfície visual tocada)
Canvas UI: N/A — sem UI
Appetite: ~0,25–0,5 dia eng; texto de persona; sem migration / Consent / collection
Responsável: —

## Intenção

O usuário observou que o Sollinha **às vezes se refere a si mesmo no feminino** — e deveria falar de si no masculino (nome é diminutivo de Jorge Solla; persona percebida como masculina). A causa provável está na definição da voz (o prompt de sistema abre como “Você é **a** Sollinha, assistente virtual…”) e em documentos .md que descrevem a persona no feminino (“**a** Sollinha”). Decisão de produto no gate: corrigir o **texto** (runtime + referências editáveis), sem guarda automatizada — basta o édito de conteúdo.

## Persona e fluxo

- **Persona / contexto:** não é nova persona — o Sollinha existente; o “fluxo” é a própria conversa (qualquer pergunta em `/campanha`).
- **Job principal:** o Sollinha se apresentar e se referir a si **no masculino** (ex.: “sou o Sollinha”, “estou à disposição”) — sem renomear o produto.
- **Fluxo desejado:** abrir o chat → primeira mensagem/tom → o Sollinha usa flexões masculinas de primeira pessoa de forma estável.
- **Anti-goals de produto:**
  - Não renomear o produto (o nome “Sollinha” continua — só o gênero da voz muda).
  - Não reescrever planos entregues/frozen (histórico imutável — ver referências).
  - Não mudar tom/formalidade (a entrega é só gênero).
  - Sem guarda automatizada (decidido no gate).

## Objetivo e aceite

- O **prompt de sistema** (fonte real da voz) define “Você é **o** Sollinha” e inclui regra explícita: referir-se a si no masculino na primeira pessoa, nunca flexionando adjetivos/particípio no feminino sobre si.
- As referências .md **editáveis** (rascunhos/ready desta família) usam “o Sollinha”; novos planos/blocos também.
- Verificação: conversa de exemplo apresenta “sou o Sollinha” / flexões masculinas; sem regressão das tools/RBAC (nenhuma lógica muda).

## Dados (intenção)

- **Vou apresentar dados?** N/A — sem números; é persona/édito de texto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/ai/systemPrompt.ts` (a voz nasce aqui — não é .md, mas é onde a mudança tem efeito real no runtime); docs/planos da família Sollinha **não-frozen** (ex.: [`sollinha-tool-urls-navegacao.md`](sollinha-tool-urls-navegacao.md), [`sollinha-cidades-mais-votado.md`](sollinha-cidades-mais-votado.md)); sem tocar teste de convenção (fora do escopo decidido).
- **Precedente:** [`ai-chat-sollinha.md`](ai-chat-sollinha.md) (v1 — frozen, não editar).
- **Risco de acoplamento:** não “caçar” “a Sollinha” em planos entregues (frozen — imutáveis); o que é **delivered/histórico** fica como está e conta como referência de época.

## Dependências

- Nenhuma. Soft: chore independente da família Sollinha (B162/B177/B178 não dependem dele).

## Fora de escopo

- Renomear o produto / mudar identidade visual.
- Reescrever planos e documentos **entregues** (“a Sollinha” histórico fica como está; o que vale é a voz no runtime e o que se escreve daqui pra frente).
- Mudanças de tom, formalidade, humor ou demais traços de voz.
- Guarda automatizada / teste de convenção (decidido no gate: só édito de texto).
- Tocar tools, RBAC, rate limit ou fluxo do chat.

## Rabbit holes de produto

- **“Reescrever todo histórico de docs da Sollinha.”** Planos entregues são congelados (regra do repo). **Corte:** runtime + docs editáveis; histórico permanece.
- **“Ajustar o modelo/empresa de LLM para mudar o gênero.”** A voz vem do prompt. **Corte:** prompt basta; se ainda houver deriva, reavaliar com exemplo gravado (registro no plano, sem projeto).

## Questões em aberto (produto)

Resolvidas no gate (2026-08-09):

- **Além do gênero, ajustar outro traço de voz agora?** **Decisão:** só gênero (foco no relato observado).
- **Vale guarda automatizada contra regressão do feminino?** **Decisão:** **não** — só édito de texto (conforme pedido).
- **O nome visível do produto muda?** **Decisão:** não — só o gênero da voz.

## Referências

- Canvas UI (gate): N/A
- `src/utilities/ai/systemPrompt.ts` (linha 1: “Você é o Sollinha…” — corrigido no B179)
- Planos da família: [`ai-chat-sollinha.md`](ai-chat-sollinha.md) (frozen), [`sollinha-tool-urls-navegacao.md`](sollinha-tool-urls-navegacao.md) (ready/editable), [`sollinha-cidades-mais-votado.md`](sollinha-cidades-mais-votado.md) (novo)
- AGENTS.md — convenções de naming/idioma (rótulos visíveis em pt, identificadores em inglês); regra de planos frozen
