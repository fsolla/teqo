# Impl: RADIO — Rádio — Remover fundo cinza do logo no player

Status: aprovado
Atualizado em: 2026-09-22
Issue: #1247
Intenção: docs/plans/radio-logo-no-background-impl.md
Appetite restante: 30 min

## Leitura da intenção

- **Outcome:** O logo da rádio aparece circular, sem quadrado cinza atrás. Layout do player não quebra em mobile (390px) e desktop (1280px).
- **O que NÃO negociar:** Logo permanece circular, sem alterações de comportamento do player.
- **O que reavaliar:** A classe `bg-(--campaign-band)` em `RadioPlayer.tsx:302` é a única responsável pelo fundo cinza.

## Abordagem recomendada

```mermaid
flowchart LR
  A[Rádio Player] --> B[Remover bg-(--campaign-band) do logo]
  B --> C[Verificar mobile + desktop]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — Remover fundo completamente, porque o objetivo é eliminar o fundo cinza sem adicionar novos estilos.
**Rejeitadas:** B porque não resolve o pedido (opacidade reduzida ainda mostra o fundo); C porque adiciona complexidade desnecessária.

### Componentes / mudanças

- **`RadioPlayer`** (`src/components/jingles/RadioPlayer.tsx`): Remover `bg-(--campaign-band)` da classe em `RadioPlayer.tsx:302`
- **Migration:** sem migration
- **Access / Consent:** não aplicável
- **UI:** Manter estilos existentes em `RadioPlayer.tsx:305` e `:312` para garantir circularidade e sombra

### Dados → forma (não aplicável)

## Fases verificáveis

1. **Tracer / schema+server** — N/A (mudança apenas de estilo)
2. **UI** — Remover `bg-(--campaign-band)` de `RadioPlayer.tsx:302`
3. **Gates** — `pnpm gate:fast`; push via `pnpm push`

## Rabbit holes / Não escopo (engenharia)

- Não alterar estilos de sombra ou borda do logo
- Não modificar comportamento de áudio do player

## Riscos e mitigação

- **Risco:** Layout quebra em telas pequenas. **Mitigação:** Verificar mobile (390px) e desktop (1280px) após a mudança.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto
- [ ] Invariantes AGENTS/engineering-standards
- [ ] Testes de domínio previstos (unit/int) onde access/write paths mudam
