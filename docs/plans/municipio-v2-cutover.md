# Município v2 — cutover para detalhe canônico

Status: registrado
Atualizado em: 2026-08-02
Issue: #335
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (migração de rota / remoção do paralelo)
Appetite: ~0,5–1 dia eng; só após OK produto humano
Responsável: —

**Plano pai:** [municipio-detalhe-v2.md](municipio-detalhe-v2.md) (lote B147–B152)

## Intenção

Enquanto a v2 vive em `/campanha/municipio/<slug>/v2`, a campanha tem **dois detalhes**. Depois que produto confirmar que a v2 é melhor, **uma** URL canônica deve bastar: a experiência nova no lugar da de abas, sem obrigar o time a lembrar do `/v2`.

## Persona e fluxo

- **Persona / contexto:** time de campanha + agentes; CG não deve “escolher versão”.
- **Job principal:** passar a abrir sempre o briefing novo; links antigos não quebram.
- **Fluxo desejado:**
  1. Produto valida B147–B151 em uso real (demo / semana de paralelo).
  2. Cutover: canônica passa a ser a experiência v2; `/v2` redireciona ou some; links internos (lista, mapa, giros, dossiê, recentes) apontam certo.
  3. Abas antigas saem do caminho (não ficam como segunda UI).
- **Anti-goals de produto:** manter duas UIs indefinidamente; cutover sem OK humano; quebrar bookmarks sem redirect.

### Esboço de fluxo

```text
[OK produto] → canônica = briefing
  → redirects dos URLs antigos/paralelos
  → limpeza da UI de abas do caminho principal
  → smoke: lista → detalhe → leader lockdown → print dossiê
```

## Objetivo e aceite

- Após merge desta Issue, staff chega ao briefing **sem** precisar de `/v2` na URL.
- Links internos relevantes atualizados ou cobertos por redirect.
- Lockdown de `leader` intacto.
- Não reintroduz tab nav de 6 itens como modelo default.
- Critério de go/no-go: confirmação explícita de produto (comentário na Issue / checklist).

## Dados (intenção)

- **Dados: N/A** — roteamento e aposentadoria de UI.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rotas campaign município(s); links em lista/mapa/giros/quick actions/recent visits; remoção ou redirect da UI de abas.
- **Precedente:** renomes de rota na campanha (ex. planos→atividades); B129 remover overview.
- **Risco de acoplamento:** não deixar `/v2` e abas convivendo sem redirect; não esquecer print do dossiê.

## Dependências

- Hard: **B147, B148, B149, B150, B151** entregues.
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md).
- Gate humano: OK produto antes do claim/exec desta Issue (marcar blocked até lá, se útil).

## Fora de escopo

- Novas features de briefing (vão em Issues novas pós-cutover).
- Redesign do dossiê em si.

## Rabbit holes de produto

- **Big-bang sem semana de paralelo.** **Corte:** B152 só após OK; paralelo existe de propósito.
- **Preservar abas “por um tempo” ao lado da v2 canônica.** **Corte:** uma experiência; secundárias no FAB.

## Questões em aberto (produto)

- **URL canônica final?** **Opções:** A) `/campanha/municipios/[slug]` (plural histórico) com UI nova | B) `/campanha/municipio/[slug]` (singular da v2). **Recomendação:** A — menos churn de links externos/hábitos; singular `/municipio/.../v2` foi só paralelo. _(assumido — validar no OK de cutover)_

## Referências

- GitHub Issue #335
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md)
- Filhos B147–B151
