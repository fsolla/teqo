# Atividades — presets e busca na omnibox

Status: registrado
Atualizado em: 2026-08-02
Issue: #306
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe na lista `/campanha/atividades` (omnibox existente)
Appetite: ~0,5–1 dia eng; um outcome verificável na lista de atividades
Responsável: —

## Intenção

Na lista de atividades, o staff ainda escolhe a janela de trabalho (Próximos / Todos / Realizados / Rascunhos) num seletor **acima** da omnibox, enquanto tipo/status/município já vivem na barra. Isso duplica o padrão das outras listas e esconde o modo ativo fora dos chips. Além disso não há busca por texto — achar uma atividade pelo título (ou responsável) exige varrer cards.

Queremos **uma** barra: presets de janela como chips/sugestões (com a semântica atual de “Próximos”), busca livre, e o seletor de abas de cima some.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral ou Assessor na mesa ou no celular, montando a agenda do dia ou achando um evento pelo nome.
- **Job principal:** escolher a janela de atividades e/ou achar por texto sem sair da omnibox.
- **Fluxo desejado:**
  1. Abre `/campanha/atividades` → default continua **Próximos** (chip ou equivalente legível na barra).
  2. Digita “realizados” / “rascunhos” / “todos” / “próximos” → sugere o preset → escolhe → chip; lista atualiza; abas de cima já não existem.
  3. Digita parte do título (ou responsável, se fizer sentido no aceite) → chip **Busca: …** → cards filtrados.
  4. Remove o chip de janela ou de busca → aquele recorte some; demais filtros (tipo, município) permanecem.
- **Anti-goals de produto:** segundo seletor paralelo às abas; diluir “Próximos” em só status sem a janela temporal; inventar filtro de intervalo de datas genérico neste item; spreadsheet mode.

### Esboço de fluxo (B)

```text
[lista atividades]
  → foca omnibox (sem abas acima)
  → digita "próximos" | "realizados" | texto do título
  → escolhe sugestão → chip na barra + lista coerente
  → outcome: uma barra só; semântica de Próximos intacta
```

## Objetivo e aceite

- O seletor de abas **acima** da omnibox **não** aparece mais; a janela ativa é comunicada e alterável **só** pela omnibox (chips + sugestões).
- Presets disponíveis com a **mesma semântica de produto** de hoje: Próximos (status planejado/confirmado + data ≥ agora), Todos, Realizados, Rascunhos.
- Default ao abrir a lista sem params continua **Próximos**.
- Texto livre confirmado vira chip **Busca: …** e restringe os cards (pelo menos por título; responsável se couber sem inflar o appetite).
- Tipo / município (e status quando a janela permitir) continuam na omnibox; limpar não inventa comportamento novo fora do padrão B128.
- Leader lockdown inalterado (liderança não usa esta lista).

## Dados (intenção)

- **Vou apresentar dados?** Não — só muda como o staff monta o recorte sobre a lista já existente.
- **Decisões desbloqueadas:** staff — “qual janela / qual atividade estou vendo agora?” com uma barra.
- **Forma:** _adiada ao plano de implementação_ — restrição: chip de janela legível (não esconder “Próximos” como status cru).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `/campanha/atividades`, `ActivityFilters`, `activityOmnibox`, `activityUi` (tabs/params), cards da lista.
- **Precedente a olhar:** B127 mapa (preset de aba) + B128 adoção; decisão de produto 2026-08-02 = mover preset **para dentro** da omnibox.
- **Risco de acoplamento:** contrato de URL da lista de atividades; não quebrar deep-links/`tab` existentes sem migração de produto clara; chassis `CampaignListOmnibox`.

## Dependências

- Nenhuma dura. Soft: B127/B128 ✓ (chassis). Soft paralelo: B137 (colunas ao lado da omnibox) — não bloqueia.

## Fora de escopo

- Filtro genérico de intervalo de datas além da semântica de Próximos.
- Filtro por “deputado presente”, progresso de tarefas, organizações da atividade.
- Saved filters B18 nesta lista.
- Mudanças nas outras listas (Issues irmãs B139+).

## Rabbit holes de produto

- **Virar só Status + “data futura”.** Se alguém “só completar”: perde o modo diário nomeado. **Corte:** preset **Próximos** permanece nomeado.
- **Busca global / command palette.** **Corte:** busca filtra a lista corrente, não navega o Início.

## Questões em aberto (produto)

- **Busca inclui responsável além do título?** **Opções:** A) só título · B) título + nome do responsável. **Recomendação:** B se o campo já aparece no card; senão A. _(assumido B se trivial — validar na execução)_

## Referências

- Inventário colaborativo (plan-issue 2026-08-02) — gaps 1–2
- `docs/plans/barra-filtros-omnibox-listas.md` (B127)
- `docs/plans/adotar-barra-filtros-omnibox-listas.md` (B128)
- `src/components/campaign/activity/ActivityFilters.tsx`
- `src/utilities/activityOmnibox.ts`
- `src/utilities/activityUi.ts`

- GitHub Issue #306
