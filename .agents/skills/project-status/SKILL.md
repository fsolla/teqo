---
name: project-status
description: 'Show Teqo project status from trackable GitHub Issues.'
---

# Status do projeto (read-only)

Esta skill apresenta o estado do projeto a partir das Issues do GitHub rastreáveis — a fonte canônica de spec/status/deps/prio/modelo. **Read-only por contrato:** nenhuma Issue é criada, editada ou relabelada aqui, e Issues `in-progress` são intocáveis (risco de conflito com o agente que está executando).

## Fluxo

1. Rode o script e leia a saída inteira:

```bash
pnpm agent:status
```

2. Apresente ao usuário, em pt-BR, nesta ordem:
   - **Overview** — contadores por estado/prio/kind; últimas concluídas; `needs:migration|consent` abertas.
   - **Fila atual** — a ordem exata do claim (prontas desbloqueadas por prio), topo destacado, `model:` por linha. Se o usuário perguntar "qual a próxima?", a resposta é o topo desta fila — não existe mais skill de sugestão: o próximo é o `pnpm agent:claim`.
   - **Mermaid** — reproduza o grafo das abertas (setas de `depends`, estado/prio no label).
   - **Bloqueios** — cada `blocked` com o motivo (dep aberta, jurídico, `requirements-changed`).
   - **Sugestões de consolidação** — as heurísticas do script (merge por domínio+prio; break-down por gargalo de depends) como **texto para o usuário decidir**. Nunca aplique consolidação aqui: aplicação é manual ou via `plan-issue`/`pnpm agent:register`. Nunca proponha nada sobre Issues `in-progress`.

3. Se o usuário pedir interpretação além da saída (ex.: "o que destrava mais coisa?"), responda a partir do grafo — sem inventar dados que o script não imprimiu; se faltar dado, leia a Issue via API do Forgejo (MCP/`pnpm issue`) somente-leitura.

**NÃO faz:** editar `docs/roadmap.md` (legado congelado), claim, registro, qualquer escrita de Issue.
