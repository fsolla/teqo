# B125 — Município mais próximo no topo das sugestões (busca geral + wizard)

Status: ready
Atualizado em: 2026-08-02
Issue: #254
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe no empty/suggest da busca geral (`CampaignStaffGlobalSearch` / Início + drawer) e do passo município do wizard (`WizardMunicipalitySearchStep`)
Appetite: ~1 dia eng; reuso B14 (`campaignGeolocation` + `municipalityProximity`); sem migration / Consent
Responsável: —

## Intenção

Em campo, ao escolher município na busca geral do Início ou no passo de município do wizard de ação, a primeira sugestão do empty state deve ser o município operacional mais próximo da posição do aparelho — **como item normal da lista**, não um grupo/card separado. Se a permissão de localização ainda não foi concedida, o app pede.

Hoje o wizard (B94) só prefixa quando a permissão já está `granted` (prompt vive no Quadro) e marca a linha com reason “Perto de você”. A busca geral já teve B117 (#204) com o comportamento desejado (prefixo + prompt 1×/sessão, sem copy geo), marcado `done`/`in-prod`, mas o código **não está** em `main` atual — este item restaura e alinha as duas superfícies à mesma intenção.

## Persona e fluxo

- **Persona / contexto:** staff (assessor / CG / candidato) em deslocamento, celular, abrindo busca ou uma ação rápida.
- **Job principal:** com um toque, escolher o município onde está (ou o mais próximo no escopo), sem digitar.
- **Fluxo desejado:**
  1. Foca a busca geral (query vazia) **ou** abre o passo município do wizard (idle).
  2. Se a sessão de aba ainda **não** pediu localização, o browser pede permissão **uma vez**; se já pediu nesta sessão, **não** pede de novo (`sessionStorage`, mesma chave do Quadro B14).
  3. Com fix válido, o município mais próximo **no escopo do ator** sobe para a **1ª** posição da lista de sugestões — mesma row das outras.
  4. Sem permissão / negado / fora da BA / sem match: lista segue como hoje; usuário digita.
- **Anti-goals de produto:** grupo/seção “Perto de você”; card GPS; mapa embutido; lista dos N mais próximos; POST de lat/lng; Consent novo; superfície para `leader`; prompt em loop a cada focus / a cada abertura de busca ou wizard.

### Esboço de fluxo (B)

```text
[focus busca geral OU idle wizard município]
  → (se ainda não prompted nesta aba e permission ≠ denied) pedir geo
  → resolver nearest no escopo
  → lista: [nearest] + demais sugestões (dedup por slug)
  → toque → abre município / avança wizard
```

## Objetivo e aceite

- Empty state da **busca geral** (Início + drawer) e do **passo município do wizard**: 1ª sugestão = município mais próximo no escopo, item visualmente igual aos outros (sem grupo novo; sem heading geo; **sem** “Perto de você” / km).
- **Prompt geo = 1× por sessão de aba** via `sessionStorage` (chave compartilhada com o Quadro B14). Se já pediu nesta sessão → não pedir de novo, mesmo ao focar busca ou abrir o wizard. Se ainda não pediu e permission ≠ `denied` estável → pedir.
- `denied` / unsupported / fora da BA / sem nearest in-scope: silêncio — demais sugestões intactas.
- Matching só no cliente; coordenadas não vão ao servidor; sem migration / Consent.
- Staff only; leader lockdown intacto.
- Salvador multi-ZE: se não houver um município atômico claro no escopo, omitir o prefixo (não inventar ZE).

## Dados (intenção)

- **Vou apresentar dados?** Sim — 0–1 município resolvido por geo, usado só para **ordenar** a lista.
- **Decisões desbloqueadas:** staff — “escolho **este** município agora (onde estou / mais perto no meu escopo)?”
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: proximidade **não** vira copy/KPI na row (só ordem); sem % estadual; sem telemetria de posição.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/dashboard/` (busca geral / results), `src/components/campaign/shared/WizardMunicipalitySearchStep.tsx` + `useWizardNearestMunicipality.ts`, `src/lib/municipalityProximity.ts`, `src/utilities/campaignGeolocation.ts`, merge de suggest (`wizardMunicipalitySuggestMerge` / home-search suggest), loaders de scope em `utilities/homeSearch/`.
- **Precedente a olhar:** B14 Quadro (`NearestMunicipalityCard`); B94 wizard geo (`docs/plans/wizard-municipio-sugestoes-geo.md`); commit histórico B117 `fe2748c5` (`useHomeSearchNearestMunicipality`, `homeSearchNearestMunicipalityMerge`) como referência de restauração — **não** como contrato.
- **Risco de acoplamento:** um prompt por sessão de aba (não duplicar Quadro × busca × wizard); leader lockdown; não enviar lat/lng ao servidor.

## Dependências

- Soft: B14 ✓ (utils + chave de sessão). B94 parcialmente no wizard (ajustar política de prompt + tratamento visual). B117 #204 fechada — **reimplementar** na `main` atual, não reabrir como se o código ainda existisse.

## Fora de escopo

- Mudanças no card “Onde estou” do Quadro (B14).
- Ranking “esquecidos” / continuity do wizard (B92/B93) além do slot de ordenação do nearest.
- Reverse-geocode vendor / PostGIS / artefato de centroides.
- Geo para `leader`.

## Rabbit holes de produto

- **GeoProvider global unificando Quadro + busca + wizard.** Se alguém “só completar”: refactor grande sem ganho de aceite. **Corte neste item:** hooks finos + chave B14 compartilhada.
- **Explicar GPS na row (“Perto de você”, km).** Contradiz “só mais um item”. **Corte:** zero copy de proximidade nas duas superfícies neste item (wizard deixa de depender do reason geo como sinal de UI).
- **CTA “Usar localização” quando denied.** Útil, mas outro job. **Corte:** silêncio; retry só em sessão nova / Quadro.

## Decisões de produto (gate)

- **Prompt 1×/sessão de aba via `sessionStorage`.** Confirmado 2026-08-02: se já pediu nesta sessão, não pedir de novo; reusar a chave/helpers do Quadro (B14). Quadro, busca geral e wizard compartilham o mesmo “já pediu”.
- **Sem copy geo nas duas superfícies.** Confirmado 2026-08-02 (opção A): busca geral e wizard mostram o nearest só como **ordem** (1º item, mesma row); sem “Perto de você”, sem km, sem grupo/heading geo. O reason B94 no wizard deixa de ser requisito de produto neste item.

## Questões em aberto (produto)

- Nenhuma após gate 2026-08-02.

## Referências

- GitHub Issue #254
- GitHub Issue #204 (B117 — histórico; código ausente em `main` atual)
- GitHub Issue #94 (B94 — wizard geo `granted`-only)
- `docs/plans/wizard-municipio-sugestoes-geo.md`
- `docs/plans/municipio-mais-proximo.md` (B14)
- `src/utilities/campaignGeolocation.ts` · `src/lib/municipalityProximity.ts`
- Commit `fe2748c5` (implementação B117 de referência)
