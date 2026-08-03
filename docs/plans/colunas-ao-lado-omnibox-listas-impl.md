# Impl: B137 — Colunas ao lado da omnibox (e fim do “Ordenado por …” residual)

Status: aprovado
Atualizado em: 2026-08-02
Issue: #304
Intenção: docs/plans/colunas-ao-lado-omnibox-listas.md
Appetite restante: herdado (~0,5–1 dia eng)

## Leitura da intenção

- **Outcome:** Em todas as listas com seletor de colunas (B17), o botão **Colunas** fica na mesma fileira da omnibox (`trailing`); dados começam logo abaixo da barra. O span visível **“Ordenado por …”** some em Territórios, Lideranças e Dobradinhas (sort continua na omnibox/header + caption `sr-only`).
- **O que NÃO negociar:** persistência/contrato do picker (cookie B17); `hidden md:flex` no mobile (gate 2026-08-02 opção A); lockdown de liderança; não mover sort para fora da omnibox/header.
- **O que reavaliar:** hipótese de editar só `CampaignTable` — o picker precisa sair da tabela e entrar nos `*Filters` via `trailing`, porque a omnibox já vive nos filtros.

## Abordagem recomendada

**Opções consideradas:**

- A) Manter picker em `CampaignTable` com CSS `absolute` ao lado da omnibox — rejeitada: DOM distinto, frágil entre listas com/sem cards mobile.
- B) Slot `trailing` nos `*Filters` + remover picker de `CampaignTable` — **recomendada**: precedente B127 (`SaveMunicipalityFilterControl`), boundary de pending intacto.
- C) Novo shell `CampaignListToolbar` — rejeitada: twin desnecessário.

**Recomendação:** B — extrair `CampaignColumnPickerTrailing` (wrapper `hidden md:flex` + `CampaignColumnPicker`), helper `toCampaignColumnPickerColumns`, exportar metadados de colunas onde a tabela é dinâmica (municípios/apoiadores/territórios), páginas estáticas mapeiam `demandColumns`/`organizationColumns`/etc.

### Componentes / mudanças

- **`CampaignColumnPickerTrailing`** (`shared/CampaignColumnPickerTrailing.tsx`): client; encapsula breakpoint B17.
- **`toCampaignColumnPickerColumns`** (`lib/campaignColumnVisibility.ts`): puro; mapeia `{id,label,mandatory}`.
- **`CampaignTable`**: remove render do picker; mantém `columnVisibility` só para `resolveVisibleColumns`.
- **`*Filters.tsx` (7 listas)**: prop opcional `trailing?: ReactNode` composta com trailing existente.
- **Páginas/listas**: passam picker no `trailing` dos filtros; removem `<p>Ordenado por…</p>` visível.
- **Exports:** `municipalityListPickerColumns`, `supporterPickerColumns`, `territoryListPickerColumns`.
- **Migration:** sem migration.

### Dados → forma

N/A — só chrome de layout.

## Fases verificáveis

1. **Chassis** — helper + trailing component + remover picker de `CampaignTable`.
2. **Wire-up** — 7 listas + organizações; remover sort span residual.
3. **Gates** — `pnpm gate:fast`; push via `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Picker mobile abaixo de `md` — fora (B17 lacuna).
- Reordenar colunas / export / cenário na barra.

## Riscos e mitigação

- **Picker fora de `CampaignListResults`:** filtros já estão dentro de `CampaignListPendingBoundary` — `useCampaignListTransition` continua correto.
- **Colunas dinâmicas (staff vs leader):** `municipalityListPickerColumns({ isStaffView })` espelha a mesma bifurcação da tabela.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto
- [x] Invariantes AGENTS/engineering-standards
- [x] Testes de domínio previstos (unit existentes do picker; sem mudança de access/write)
