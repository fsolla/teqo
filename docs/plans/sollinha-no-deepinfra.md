# Sollinha no Deep Infra (LLM) — mesma API e chave dos agentes

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-08
Issue: #449
Priority: P2
Model: composer-2.5 (pool) / deepseek-v4-flash-high (local)
Impeccable: A — sem UI
Canvas UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

A Sollinha hoje fala com a API oficial da DeepSeek (`@ai-sdk/deepseek` → `api.deepseek.com`), enquanto os agentes do time já usam a Deep Infra. O usuário quer consolidar num só provedor/chave. Avaliado o catálogo de texto da Deep Infra: **DeepSeek-V4-Flash permanece o modelo**, servido pela Deep Infra (US$ 0,09/M input, US$ 0,18/M output, 1 M ctx) — nenhum modelo deles é mais barato no total input+output mantendo tool calling/pt-BR/contexto (Qwen3-32B só ganha no input e perde no output e em capacidade; Qwen3-30B/235B A3B empatam ou pagam 2–6× o output; GLM-4.6 é 4–5×). Este item é só o **movimento de provider**, mantendo o modelo e o comportamento.

## Persona e fluxo

- **Persona / contexto:** dev/equipe Teqo — reduzir superfície operacional (um provedor, uma chave, uma fatura) sem mudar nada para o assessor.
- **Job principal:** continuar perguntando à Sollinha e receber as mesmas respostas, agora roteada pela Deep Infra, com as tools funcionando igual.
- **Fluxo desejado:** deploy com o `route.ts` apontando para a Deep Infra → smoke das tools com a chave nova → assessor usa o chat sem notar diferença → rollback imediato (reverter baseURL) se qualquer tool falhar.
- **Anti-goals de produto:** trocar de modelo (fica V4-Flash); reescrever tools "porque mudou a API"; mexer em UI; migrar dados.

## Objetivo e aceite

- A Sollinha é servida pela Deep Infra usando o mesmo modelo (DeepSeek-V4-Flash) e as mesmas tools, com respostas equivalentes.
- Smoke explícito das tools de dados antes de tocar produção (Sollinha já está em prod; o routing de tools é o músculo dela).
- Rollback barato e documentado: uma chave/baseURL antiga faz o chat voltar ao estado atual.
- Nenhuma mudança visível para o assessor; env/e2e com o endpoint mockado continua sem chave real no CI.

## Dados (intenção)

- **Vou apresentar dados?** Não — melhoria operacional.
- **Decisões desbloqueadas:** uma única credencial para agentes + Sollinha + STT futuro (B173).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/api/ai-chat/route.ts` (o `deepSeek('deepseek-v4-flash')` vira o caminho OpenAI-compatível da Deep Infra — p.ex. `@ai-sdk/deepinfra` com `deepseek-ai/DeepSeek-V4-Flash`, ou baseURL `https://api.deepinfra.com/v1/openai`); env `DEEPINFRA_API_KEY` em Vercel produção + `.env.example`.
- **Precedente a olhar:** `docs/plans/ai-chat-sollinha.md` (decisão "modelo deepseek-v4-flash" mantida; só o provedor muda).
- **Risco de acoplamento:** mesmo arquivo que B173 (voz) toca — fazer antes ou em acordo para não conflitar; verificar no smoke se o tool calling do V4-Flash se comporta igual pela Deep Infra antes de flipar.

## Dependências

- Nenhuma dura. Soft: B173 (voz) reaproveita a mesma chave Deep Infra para o STT.

## Fora de escopo

- Trocar o modelo (continua DeepSeek-V4-Flash).
- Reescrever as tools / sistema da Sollinha.
- Qualquer UI.

## Rabbit holes de produto

- **"Aproveita e troca o modelo também".** Explosão de risco sem ganho de custo. **Corte:** modelo fixo; reavaliar só com evidência de qualidade nova.
- **"Reescrever as tools pro formato novo".** API é OpenAI-compatível; se algo falhar é smoke/downgrade, não refactor. **Corte:** teste, não reescreva.

## Questões em aberto (produto)

- Nenhuma bloqueadora. Confirmação de escopo: manter como **chore separado (B174)** — recomendado, pois o swap tem blast radius próprio (Sollinha em produção) independente da feature de voz; ou dobrar dentro do B173.

## Referências

- GitHub Issue: #449 (B174)
- `src/app/(campaign)/campanha/api/ai-chat/route.ts` — ponto do swap
- `docs/plans/sollinha-consulta-por-voz.md` (B173) — onde a chave Deep Infra é reaproveitada no STT
- `docs/plans/ai-chat-sollinha.md` — precedente (imutável)
