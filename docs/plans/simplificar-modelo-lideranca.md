# Simplificar modelo de liderança (exclusivo + limpeza)

Status: rascunho
Atualizado em: 2026-07-29
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B69 — UX-1 / A4)
Impeccable: B — schema + forms/lista/convite existentes; UI de grid do wizard = **B70**
Appetite: ~1–1,25 dia eng; uma migration (drop + `exclusive`); zod/collection/UI lista/forms/invite; access `OwnLeadership`
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · tema `campaign`. Superfícies tocadas = ficha/lista/convite já no Field Desk — craft compacto, não shape de rota nova.

Na implementação: craft compacto → critique → polish.

Brief compacto (B, direção clara):

- **Persona:** CG/assessor atualizando rede no ritual A4; formulário longo = abandono.
- **Job principal:** gravar só o que a mesa usa no dia a dia — contato, status, observação, exclusividade — sem setor/org/consentimento externo.
- **Estratégia de cor:** Restrained.
- **Edit where you see:** sim nas superfícies existentes (B32 status; forms `/liderancas`); exclusividade entra nos forms internos + no form do **B70**.
- **Anti-goals:** segundo cadastro de pessoa; dropar Consent do **convite** LGPD; inventar join exclusividade×município nesta fatia.

## Dados → decisão → apresentação

Dados: N/A como métrica nova — boolean categórico + remoção de campos. Decisão = “esta liderança ainda articula **só** conosco?” (sim/não) e menos atrito de cadastro.

## Contexto

`leadership` (`src/collections/Leadership.ts`) carrega hoje: `organizations`, `sector`/`sectorNotes`, `consentNote` (“Registro de consentimento **externo**”), além de `supportStatus`, `notes`, `stateDeputies`, municípios e o trio de Consent do **convite** (`consent` / `consentContentHash` / `consentedAt`).

Pedido de produto (2026-07-29), no pacote A4 / Cairu ([fluxos-acao-primeiro-inicio.md](fluxos-acao-primeiro-inicio.md)):

1. Conceito de parceria **exclusiva** (default = exclusivo): liderança que era a articuladora principal e passa a dividir votos com outro candidato deixa de ser exclusiva — e pode voltar. Não é “principal vs secundária” na v1 (ranking implícito); é **exclusividade do apoio**.
2. Remover da mesa os conceitos pouco usados: **organização**, **setor** (e notas de setor), **registro de consentimento externo** (`consentNote`).
3. “A própria liderança é a dobradinha” — `stateDeputy` hoje é entidade por **nome** (sem `Contact`); `leadership` tem `Contact` único. Não unificar collections neste item.

Lista `/campanha/liderancas` já filtra/ordena por `sector` (B29 ✓); coluna Organizações é texto morto. Invite autofill ainda pede `sector`/`sectorNotes`.

## Objetivos

- Migration `pnpm migrate:create simplify_leadership_fields` (nome sugerido):
  - **DROP** `organizations` (tabela de join), `sector`, `sector_notes`, `consent_note`.
  - **ADD** `exclusive` boolean **NOT NULL DEFAULT true** (backfill implícito = todos nascem exclusivos — honesto com o default de produto).
- Collection + zod (`src/lib/schemas/leadership.ts`): espelhar; `exclusive` staff-managed como `supportStatus`/`notes`.
- Remover de create/internal forms, list columns/filters/sort de setor, badges de org no `MunicipalityLeadershipsPanel`, `organizationNames` / `organizationIDs` do view model.
- Invite: dropar `sector`/`sectorNotes` do schema + `CampaignInviteForm` + redemption profile write (não tocar `consent*` do LGPD do convite).
- Access: `getOwnEngagedLeadership` deixa de selecionar/expor `organizationIDs` (`municipalities.ts`); qualquer leitor de org via liderança engajada ajusta ou morre.
- `organizationData` counts “lideranças da org” → **zero path** ou remover a métrica se só existia via esse join (verificar call sites; não inventar proxy).
- Labels: `exclusive` → “Apoio exclusivo”; false → leitura “Não exclusivo” / badge discreto na lista (opcional neste item; B70 mostra no tile/form).
- Sem Consent novo. Sem UI de grid do wizard (**B70**).
- Unit/int: create default `exclusive: true`; update para `false`; filtros de setor removidos; invite sem setor.

## Decisões travadas

- **Campo `exclusive: boolean`, default `true`, no documento `leadership`.** **Rejeitado:** `principal`/`prioritaria` (sugerem ranking 1º/2º, não o relato “dividiu apoio”); exclusividade por par liderança×município nesta fatia (caro — join/metadata; o relato do CG é sobre a parceria com a campanha, não nuance A vs B). Gatilho abaixo se a mesma pessoa precisar ser exclusiva em um município e não em outro.
- **Dropar `organizations`, `sector`, `sectorNotes`, `consentNote`.** **Rejeitado:** deixar opcionais “por se acaso” (pedido: simplificar; campos mortos travam atualização); dropar o trio `consent*` do **convite** (é LGPD `lideranca-autopreenchimento`, Onda 0 — distinto do `consentNote` externo).
- **“Liderança é a dobradinha” = reusar `stateDeputy` + `leadership.stateDeputies`.** Criar/vincular a ficha de dobradinha com o nome da pessoa; chips B31 ✓ já expressam a rede. **Rejeitado:** collection unificada; `Contact` obrigatório em `stateDeputy` agora; flag `actsAsStateDeputy` sem entity (segunda verdade). Atalho “criar dobradinha a partir desta liderança” → Adiado.
- **i18n:** identifier `exclusive`; copy “Apoio exclusivo” / “Não exclusivo”.

## Questões em aberto

- **Badge “Não exclusivo” na lista `/liderancas` neste item ou só no B70?** **Opções:** A lista + forms | B só forms/wizard. **Recomendação:** A — coluna ou chip discreto na lista (1 célula), senão o campo some da varredura. _(assumido)_
- **Exclusividade por município?** **Opções:** A documento (v1) | B join. **Recomendação:** A; revisitação no Adiado. _(assumido — validar com produto se Cairu tiver o mesmo nome em dois municípios com papéis diferentes)_

## Abordagem proposta

```mermaid
flowchart LR
  Mig["migration DROP + exclusive"] --> Zod["zod + Leadership.ts"]
  Zod --> UI["forms + lista + invite"]
  Zod --> Access["OwnLeadership sem orgs"]
  Zod --> Orgs["organizationData counts"]
```

Componentes:

- Migration + `Leadership.ts` + `src/lib/schemas/leadership.ts` (+ invite schema se setor sair).
- `LeadershipForm` / `LeadershipInternalForm` — remover org/setor/consentNote; toggle `exclusive` (default on).
- `liderancas/page.tsx` + `leadershipListUrl` / filters — dropar `sector`; opcional coluna/filtro `exclusive`.
- `leadershipData.ts` — view models sem org/setor; incluir `exclusive`.
- `CampaignInviteForm` + redemption — sem setor.
- `municipalities.ts` `getOwnEngagedLeadership` — só municípios.
- **Migration:** sim (drop + add boolean default true).

## Dependências

- Nenhuma de outro plano aberto. Soft: B29 ✓ / B31 ✓ / B32 ✓ (superfícies a limpar). Desbloqueia **B70**.

## Não escopo

- Grid de tiles + form do wizard A4 → **B70**.
- Wiring “quer também liderança?” no A1 → fatia A1.
- Unificar `stateDeputy` com `Contact` / atalho criar-dobradinha → Adiado.
- Collection `organization` em si (vertical `/campanha/organizacoes` permanece; só some o vínculo na liderança).

## Rabbit holes

- **Exclusividade por município + histórico de mudanças.** **Mitigação:** boolean no doc; nota em `notes` se precisar matizar.
- **Reescrever access de leader via organizações.** **Mitigação:** remover o ramo; leader continua lockdown em contatos — confirmar que `organizationIDs` não alimenta rota staff crítica antes de dropar.
- **Backfill `exclusive: false` a partir de texto em `notes`.** **Mitigação:** não — default true; mesa corrige no wizard.

## Adiado com gatilho

- **Exclusividade por município.** Revisitar quando a mesma liderança tiver papéis opostos em ≥2 municípios no mesmo ritual.
- **Atalho “Criar / vincular dobradinha” a partir da ficha/wizard.** Revisitar quando B70 shippar e a mesa pedir o gesto ≥2× na mesma semana.
- **`stateDeputy.contact` opcional.** Revisitar se dedupe nome↔pessoa virar dor (E4R / onboarding).

## Referências

- [fluxos-acao-primeiro-inicio.md](fluxos-acao-primeiro-inicio.md) (A4) · [simplificar-modelo-sinal.md](simplificar-modelo-sinal.md) (precedente B62) · [autosave-status-lista-liderancas.md](autosave-status-lista-liderancas.md) · [ordenacao-filtros-lista-liderancas.md](ordenacao-filtros-lista-liderancas.md)
- `src/collections/Leadership.ts` · `src/lib/schemas/leadership.ts` · `src/utilities/leadership/*` · `src/utilities/access/municipalities.ts` · `CampaignInviteForm.tsx`
- AGENTS.md — migrations; Contact único; Consent por chave (convite intacto)
- `PRODUCT.md` / `DESIGN.md`
