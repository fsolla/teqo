# CL2 — `opsListRegistry` + tipos + flag + slugs v1

Status: rascunho
Atualizado em: 2026-08-01
Issue: #156
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI)
Appetite: ~0,5–1 dia eng
Depends: CL1
Responsável: —

## Premissas

1. Registry vive em `src/lib/` (client-safe) e **não** importa loaders/parsers por valor — só chaves estáveis.
2. Nenhuma rota muda de comportamento nesta issue (só registry + flag + testes).

→ Corrija agora ou sigo com estas.

## Objetivos

- Módulo `src/lib/opsListRegistry/` com registry tipado dos 8 domínios v1 + flag `LIST_UNIFIED`.
- Pins unit que falham o build se faltar slug, coluna sem `label`, ou `columnListId` inválido.

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

Componentes:

- **`src/lib/opsListRegistry/opsListRegistry.ts`** (novo):

```ts
export const opsListDomains = [
  'municipios',
  'liderancas',
  'dobradinhas',
  'demandas',
  'assessores',
  'territorios',
  'apoiadores',
  'organizacoes',
] as const

export type OpsListDomainId = (typeof opsListDomains)[number]

export type OpsListDomainMeta = {
  id: OpsListDomainId
  routePath: string // ex.: '/campanha/municipios'
  gate: 'staff' | 'noLeader' | 'unrestricted'
  columnListId: CampaignListId | null
  savedFilters: boolean
  sortModel: 'url' | 'fixed' | 'memory'
  canonicalRedirect: boolean
  layout: 'table'
  status: 'v1' | 'excluded'
}

export const opsListRegistry: Record<OpsListDomainId, OpsListDomainMeta> = { … }

export const getOpsListDomain = (slug: string): OpsListDomainMeta | null => …
```

Metas v1 (valores travados — conferidos no código 2026-08-01):

| slug           | routePath                | gate           | columnListId                    | savedFilters | sortModel                | canonicalRedirect                        |
| -------------- | ------------------------ | -------------- | ------------------------------- | ------------ | ------------------------ | ---------------------------------------- |
| `municipios`   | `/campanha/municipios`   | `noLeader`     | `municipios`                    | `true`       | `url`                    | `true`                                   |
| `liderancas`   | `/campanha/liderancas`   | `noLeader`     | `liderancas`                    | `false`      | `url`                    | `true`                                   |
| `dobradinhas`  | `/campanha/dobradinhas`  | `noLeader`     | `dobradinhas`                   | `false`      | `url`                    | `true`                                   |
| `demandas`     | `/campanha/demandas`     | `staff`        | `demandas`                      | `false`      | `fixed` (`-createdAt`)   | `false`                                  |
| `assessores`   | `/campanha/assessores`   | `unrestricted` | `null` → `'assessores'` em CL5a | `false`      | `fixed` → `url` em CL5a  | `false` → `true` em CL5a                 |
| `territorios`  | `/campanha/territorios`  | `noLeader`     | `territorios`                   | `false`      | `memory` → `url` em CL6a | `true` (sem `page` → com `page` em CL6a) |
| `apoiadores`   | `/campanha/apoiadores`   | `staff`        | `apoiadores`                    | `false`      | `url`                    | `true`                                   |
| `organizacoes` | `/campanha/organizacoes` | `staff`        | `organizacoes`                  | `false`      | `fixed` (`name`)         | `false`                                  |

`CampaignListId` vive em [`src/lib/campaignColumnVisibility.ts`](src/lib/campaignColumnVisibility.ts) (`CAMPAIGN_LIST_IDS` — hoje: `municipios`, `liderancas`, `dobradinhas`, `organizacoes`, `demandas`, `apoiadores`, `territorios`). **Falta só `'assessores'`** — entra na allowlist em CL5a; até lá, `columnListId: null`.

`atividades` **não** entra em `opsListDomains` — documentar a razão em comentário (exceção cards, Pass 2 D5).

- **`src/lib/opsListRegistry/opsListFlag.ts`** (novo): `resolveListUnifiedEnabled(env = process.env): boolean` — `true` se `LIST_UNIFIED` for `'1'`/`'true'`.

- **Sem migration, sem collection, sem server action.**

## Fases verificáveis

### Fase 1 — Tracer: registry + flag + pins

- **Quota:** 1 do appetite
- **Entrega:** os dois módulos + `tests/unit/opsListRegistry.unit.spec.ts`
- **Aceite:**
  - [ ] `opsListDomains` tem exactamente os 8 slugs v1 (ordem alfabética ou por rota, estável)
  - [ ] cada meta tem `routePath` começando por `/campanha/` e `layout: 'table'`
  - [ ] `getOpsListDomain('municipios')` devolve meta com `savedFilters: true` e `canonicalRedirect: true`
  - [ ] `getOpsListDomain('atividades')` devolve `null`
  - [ ] `resolveListUnifiedEnabled()` respeita `LIST_UNIFIED` (`'1'`, `'true'`, ausente, `'0'`)
- **Verify:** `pnpm gate:fast`
- **Files:** `src/lib/opsListRegistry/opsListRegistry.ts`, `src/lib/opsListRegistry/opsListFlag.ts`, `tests/unit/opsListRegistry.unit.spec.ts`
- **Tamanho:** S

## Dependências

- CL1 (spec-mãe). Reusa [`src/lib/campaignColumnVisibility.ts`](src/lib/campaignColumnVisibility.ts) para o tipo `CampaignListId`.

## Não escopo

- `OpsListView`, `OpsListPage`, migração de qualquer rota — CL3 em diante.
- `atividades`.

## Rabbit holes

- **Importar loaders/parsers no registry.** Se alguém “só referenciar”: `lib/` passa a depender de `utilities/` (ciclo + client-safe quebrado). **Mitigação:** o registry guarda **só metadados** (tabela acima); a resolução loader/parser acontece na page server por domínio — não criar `loaderKey`/`urlResolverKey` nesta versão do tipo (não há consumidor; seria inventário sem uso).
- **Adicionar `atividades` “só o meta”.** Factory passa a aceitar cards sem suporte. **Mitigação:** fora de `opsListDomains`.

## Referências

- [`src/lib/campaignColumnVisibility.ts`](src/lib/campaignColumnVisibility.ts)
- [`src/utilities/campaignListUrl.ts`](src/utilities/campaignListUrl.ts)
- AGENTS.md — direção de dependência `lib/` → `utilities/`
