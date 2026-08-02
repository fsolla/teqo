# Impl: B125 — Município mais próximo no topo das sugestões (busca geral + wizard)

Status: aprovado
Atualizado em: 2026-08-02
Issue: #254
Intenção: docs/plans/municipio-geo-topo-sugestoes-busca.md
Appetite restante: ~1 dia — restauração B117 + alinhamento wizard

## Leitura da intenção

- **Outcome:** Na busca geral (Início + drawer) e no passo município do wizard, com query vazia, o município operacional mais próximo no escopo do ator aparece como **1ª linha normal** da lista — sem grupo geo, sem copy “Perto de você”, sem km.
- **O que NÃO negociar:** prompt geo 1×/sessão de aba (`GEO_PROMPT_SESSION_KEY` B14); matching só no cliente; leader lockdown; Salvador multi-ZE omitir prefixo quando `zoneCity`; sem migration/Consent/POST lat/lng.
- **O que reavaliar:** B117 (`fe2748c5`) é referência de restauração para home search, não contrato; wizard B94 deve **parar** de usar reason geo na UI; hooks finos compartilhados vs duplicar prompt.

## Abordagem recomendada

```mermaid
flowchart LR
  focus[Focus busca / idle wizard] --> hook[useNearestMunicipalitySlug]
  hook --> prompt[Prompt 1x sessão B14]
  prompt --> resolve[resolveNearbyMunicipality client]
  resolve --> merge[merge prefix dedup]
  merge --> row[HomeSearchHitRow normal]
```

**Opções consideradas:** A) GeoProvider global; B) restaurar B117 + patch wizard separado; C) hook geo compartilhado + dois merges (home + wizard).  
**Recomendação:** C — um `useNearestMunicipalitySlug` com política B14/B117; `mergeHomeSearchNearestMunicipality` (restaurar) e `mergeWizardMunicipalitySuggestions` com `geoSlug` sem override de region.  
**Rejeitadas:** A (refactor grande); duplicar prompt em dois hooks (twin).

### Componentes / mudanças

- **`useNearestMunicipalitySlug`** (`src/components/campaign/shared/`): resolve nearest slug; prompt `hasPromptedThisSession` / `markPromptedThisSession`; fail-soft.
- **`useHomeSearchNearestMunicipality`**: re-export ou uso direto do shared hook em `HomeSearchMunicipalityGroup`.
- **`homeSearchNearestMunicipalityMerge`**: restaurar prefix + dedup sem geo copy.
- **`loadHomeSearchSuggestions`**: devolver `scopeMunicipalities` com `ibgeCode` para merge client.
- **`wizardMunicipalitySuggestMerge`**: `geoSlug` em vez de objeto com distance; remover `formatWizardGeoSecondary` / `WIZARD_GEO_NEARBY_REASON`.
- **`useWizardNearestMunicipality`**: substituir por shared hook ou delegar.
- **Migration:** sem migration
- **Access / Consent:** staff-only loaders existentes; geo client-only
- **UI:** mesma `HomeSearchHitRow`; Impeccable B — empty/suggest only

### Dados → forma

- Proximidade só ordena; row usa `hit.region` normal — rejeitada copy geo na secondary (produto gate 2026-08-02).

## Fases verificáveis

1. **Server + lib** — `scopeMunicipalities`, merges, shared hook, wizard merge sem copy
2. **UI** — `HomeSearchMunicipalityGroup` wiring; wizard step usa slug hook
3. **Gates** — unit merges + int suggest scope; `pnpm gate:fast`; `pnpm push`

## Rabbit holes / Não escopo (engenharia)

- GeoProvider global; CTA retry quando denied; alterar `NearestMunicipalityCard` (B14).

## Riscos e mitigação

- **Prompt duplicado Quadro × busca:** mesma `GEO_PROMPT_SESSION_KEY` — já compartilhada.
- **Salvador zoneCity:** `resolveNearbyMunicipality` retorna `zoneCity` → hook retorna null — aceite.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto
- [x] Invariantes AGENTS/engineering-standards
- [x] Testes unit merges + int scopeMunicipalities
