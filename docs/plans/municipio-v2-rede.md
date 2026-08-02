# Município v2 — rede (lista edit-in-place)

Status: registrado
Atualizado em: 2026-08-02
Issue: #332
Priority: P1
Model: composer-2.5
Impeccable: B — bloco na rota v2
Appetite: ~1 dia eng; top-N + edição no lugar
Responsável: —

**Plano pai:** [municipio-detalhe-v2.md](municipio-detalhe-v2.md) (lote B147–B152)

## Intenção

Hoje as lideranças do município moram numa **aba** que o coordenador não abre. Na v2, a **rede** precisa estar na dobra principal, em **lista densa**, com declarado/estimado editáveis **onde se vê** — sem card por pessoa e sem mandar para outra rota só para ajustar um número.

## Persona e fluxo

- **Persona / contexto:** CG / assessor no detalhe v2, depois de status/conta (ou direto na rede).
- **Job principal:** ver quem segura o município e ajustar pledges sem mudar de aba.
- **Fluxo desejado:**
  1. Vê lista (desktop: tabela; mobile: lista densa) com top-N lideranças relevantes (ex. por estimado/declarado).
  2. Edita declarado e estimado **na célula / na linha** (auto-save no espírito B9).
  3. “Ver todas” / criar liderança **não** incham a dobra (CTA ou FAB — B151).
- **Anti-goals de produto:** card empilhado por liderança; spreadsheet de todas as colunas da ficha; expor estimado a `leader`; edição em massa sem pedido.

### Esboço de fluxo (B)

```text
[Rede]
  → lista top-N (nome · status · declarado · estimado)
  → edita número na célula → grava / feedback
  → [Ver todas] / [Nova] → fora da dobra principal (CTA/FAB)
```

## Objetivo e aceite

- Rede visível na v2 sem aba “Lideranças”.
- Forma de **lista** (não cards), utilizável no mobile.
- Declarado e estimado (staff) editáveis no lugar, com feedback de pending/erro.
- `leader` não vê nem edita estimado (assimetria intacta).
- Top-N com caminho claro para o restante do cadastro.
- Não substitui a ficha completa da liderança (link para detalhe da pessoa quando fizer sentido).

## Dados (intenção)

- **Vou apresentar dados?** Sim — pledges por liderança × município.
- **Decisões desbloqueadas:**
  - Staff: “quem está abaixo do combinado?” / “atualizo a estimativa agora?”
  - CG: “a rede cobre o discurso da meta (B148)?”
- **Forma:** _adiada ao impl_. Restrição: lista densa; sem dashboard de vaidade de rede.

## Direção no codebase (hipótese)

- **Áreas prováveis:** painel/lista na composição v2; loaders de leaderships/pledges do detalhe atual; padrões de edit-in-place da lista de municípios / painel de pledges.
- **Precedente:** aba Lideranças do detalhe atual; B9 edit-where-you-see; assimetria de votos.
- **Risco de acoplamento:** access de pledge; não abrir escrita a quem não pode; não duplicar ficha de liderança.

## Dependências

- Hard: **B147**.
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md).
- Soft: B151 para “nova liderança” no FAB (CTA textual nesta Issue basta se FAB ainda não existir).
- Serializes com B148/B150/B151 na rota v2.

## Fora de escopo

- Wizard completo de nova liderança (pode só encaixar entrada).
- Feed de atualizações / sinais (status B147 + FAB).
- Conta P/M/O (B148).
- Import CSV de apoiadores.

## Rabbit holes de produto

- **Trazer todas as colunas da lista global de lideranças.** **Corte:** nome, status de apoio, declarado, estimado.
- **Optimistic UI sem refresh do agregado da conta.** **Corte:** honestidade do resultado (Feel the action) — conta pode atualizar após revalidate.

## Decisões de produto (fechadas)

- **Ordenação default do top-N?** **Decisão:** A — estimado (senão declarado) desc. _(confirmado produto 2026-08-02)_

## Referências

- GitHub Issue #332
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md)
- Detalhe atual: aba leaderships / pledges panel
