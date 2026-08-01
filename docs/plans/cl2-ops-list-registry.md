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
}

export const opsListRegistry: Record<OpsListDomainId, OpsListDomainMeta> = { … }

export const getOpsListDomain = (slug: string): OpsListDomainMeta | null => …
```

**Metas v1 (SSOT):** células travadas em [`lista-unificada-campanha-spec.md`](lista-unificada-campanha-spec.md) § Escopo travado — **não** duplicar a tabela aqui. Ordem de `opsListDomains` = por `routePath` (não alfabética). `CampaignListId` / `assessores` / `atividades` fora do registry: ver a mesma secção.

Cada meta no código inclui ainda `layout: 'table'` (implementação; sem `status: 'excluded'`).

- **`src/lib/opsListRegistry/opsListFlag.ts`** (novo): `resolveListUnifiedEnabled(env = process.env): boolean` — `true` se `LIST_UNIFIED` for `'1'`/`'true'`.

- **Sem migration, sem collection, sem server action.**

## Fases verificáveis

### Fase 1 — Tracer: registry + flag + pins

- **Quota:** 1 do appetite
- **Entrega:** os dois módulos + `tests/unit/opsListRegistry.unit.spec.ts`
- **Aceite:**
  - [ ] `opsListDomains` tem exactamente os 8 slugs v1 na ordem por `routePath` da SSOT (CL1)
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

- **Importar loaders/parsers no registry.** Se alguém “só referenciar”: `lib/` passa a depender de `utilities/` (ciclo + client-safe quebrado). **Mitigação:** o registry guarda **só metadados** (SSOT CL1); a resolução loader/parser acontece na page server por domínio — não criar `loaderKey`/`urlResolverKey` nesta versão do tipo (não há consumidor; seria inventário sem uso).
- **Adicionar `atividades` “só o meta”.** Factory passa a aceitar cards sem suporte. **Mitigação:** fora de `opsListDomains`.

## Referências

- Spec-mãe: [`lista-unificada-campanha-spec.md`](lista-unificada-campanha-spec.md)
- [`src/lib/campaignColumnVisibility.ts`](src/lib/campaignColumnVisibility.ts)
- [`src/utilities/campaignListUrl.ts`](src/utilities/campaignListUrl.ts)
- AGENTS.md — direção de dependência `lib/` → `utilities/`
