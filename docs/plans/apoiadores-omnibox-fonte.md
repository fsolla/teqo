# Apoiadores — filtro por fonte na omnibox

Status: registrado
Atualizado em: 2026-08-02
Issue: #309
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na lista `/campanha/apoiadores`
Appetite: ~0,5 dia eng
Responsável: —

## Intenção

Apoiadores têm **fonte** no modelo (import CSV, manual, convite, evento, liderança, …) e isso aparece no trabalho diário (qualidade do cadastro, auditoria de import), mas a omnibox só oferece intenção de voto, cidade e município. Falta recortar “só importados” / “só da liderança X-path” pela barra.

Queremos dimensão **Fonte** na omnibox.

## Persona e fluxo

- **Persona / contexto:** Coordenador (ou assessor no escopo) revisando a base de apoiadores.
- **Job principal:** ver só apoiadores de uma origem de cadastro.
- **Fluxo desejado:** digita “import” / “liderança” / “fonte” → escolhe → chip → lista; remove → volta ao recorte anterior; demais filtros permanecem.
- **Anti-goals de produto:** filtro por quem importou o lote (auditoria fina); edição em massa; expor PII extra.

## Objetivo e aceite

- Omnibox sugere e aplica **Fonte** com os valores de produto já usados no cadastro (rótulos pt-BR legíveis).
- Comportamento exclusivo ou inclusivo: seguir o padrão mais próximo das outras dims desta lista (hoje intenção/cidade/município são únicos) — **recomendação: exclusivo** num primeiro corte.
- Ausência de chip = todas as fontes.
- KPIs da lista continuam refletindo o recorte ativo (já o fazem).

## Dados (intenção)

- **Vou apresentar dados?** Não — filtro sobre dados já listados; KPIs já são aggregate da lista.
- **Decisões desbloqueadas:** staff — “esta fatia da base veio de onde?”
- **Forma:** _adiada_.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `SupporterFilters`, `supporterOmnibox`, parsers em `supporterUi` / `supporterPageData`, enum de `source` no schema de apoiador.
- **Precedente:** omnibox B128 apoiadores; Consent/LGPD inalterado (só filtra linhas já autorizadas ao papel).
- **Risco:** leader lockdown — liderança só vê o que já pode; não ampliar acesso via filtro.

## Dependências

- Nenhuma. Soft: bloqueio jurídico de dados reais de apoiador permanece política do repo (não muda neste item).

## Fora de escopo

- Filtro por lote de import / token.
- Ordenação na omnibox.
- Novas fontes de cadastro.

## Rabbit holes de produto

- **“Fonte = liderança específica”.** **Corte:** filtrar pelo enum de origem (`lideranca`), não por ID de liderança neste item.

## Questões em aberto (produto)

- **Exclusivo vs OR multi-fonte?** **Opções:** A) exclusivo (como intenção) · B) inclusivo OR. **Recomendação:** A. _(assumido)_

## Referências

- Inventário plan-issue 2026-08-02 — gap 5
- `src/utilities/supporter/supporterOmnibox.ts`
- `src/components/campaign/supporter/SupporterFilters.tsx`
- AGENTS.md — Campaign supporters (C2) `source`

- GitHub Issue #309
