# Brief de engenharia (carregar antes do plano de implementação)

Leia o que for relevante **antes** de travar a abordagem no `*-impl.md`. Não invoque jornadas inteiras de skills — aplique o princípio no momento da decisão.

## Skills sob demanda (não tour)

| Situação | Skill / princípio |
| -------- | ----------------- |
| Onde colocar lógica / dependência | `clean-architecture` — Dependency Rule; core testável |
| Complexidade de módulo / API | `software-design-philosophy` — deep modules, anti-classitis |
| Escopo v1 / cortar especulação | `37signals-way` / `pragmatic-programmer` — build less, tracer bullet, DRY de conhecimento |
| Schema Payload | skill `payload-migrations` |
| DB local / Cloud sem Docker | skill `local-database` |
| KPI/mapa/série na UI | [data-presentation.md](../plan-issue/data-presentation.md) pergunta 3 no impl |
| Domínio `/campanha` específico | rules `projects/*` se o item tocar aquele projeto |

## Invariantes que o impl plan não pode violar

- Local API com `user` → `overrideAccess: false`
- Escrita multi-collection → transação + `req: { transactionID }`
- Pessoa → join com `Contact` (não collection paralela)
- Opt-in/PII → `Consent` por chave estável, fail-closed
- `leader` lockdown; sem `estimatedVotes` para liderança
- Copy pt-BR / identificadores em inglês

## Sistema de listas

Se a superfície for lista/tabela: reusar shells (`CampaignTable`, URL canônica, column visibility, pending boundary) — ver codebase-map. Não reinventar.
