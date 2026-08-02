# Município v2 — conta local (P/M/O + cobertura + classe)

Status: registrado
Atualizado em: 2026-08-02
Issue: #331
Priority: P1
Model: composer-2.5
Impeccable: B — bloco na rota v2 (shell B147)
Appetite: ~1 dia eng; conta densa na 1ª dobra
Responsável: —

**Plano pai:** [municipio-detalhe-v2.md](municipio-detalhe-v2.md) (lote B147–B152)

## Intenção

Na v2, o coordenador precisa ver **meta nos três cenários**, **quanto já está comprometido** e **que classe territorial** é aquele município — sem abrir a conta da cadeira completa nem a aba de eleições. Esta fatia densifica a **conta local** na dobra principal.

## Persona e fluxo

- **Persona / contexto:** CG / Candidato / assessor staff no detalhe v2, depois de ler o status.
- **Job principal:** responder “qual a meta?”, “falta quanto no cenário que estou olhando?” e “isto é expansão, reduto, marginal…?”.
- **Fluxo desejado:**
  1. Vê P / M / O como campos editáveis no lugar.
  2. **Clicar** (ou focar) um dos três **ativa** aquele cenário para cobertura/déficit.
  3. Lê pledges (cenário de estimativa já usado na campanha) vs meta ativa → cobertura / déficit.
  4. Vê **classe territorial** com destaque (não só num canto do status).
  5. Hover → tooltip (meta, cobertura, classe) + link a conceitos.
- **Anti-goals de produto:** esconder P/M/O atrás de um único número; forçar a grade diagnóstica inteira (potencial, benchmark, etc.) na 1ª dobra; % estadual absoluto; gauge SaaS.

### Esboço de fluxo (B)

```text
[Status B147]
  → Conta: [P] [M] [O]  (clique ativa)
  → Meta ativa · pledges · déficit/cobertura
  → Classe (pill + fatores curtos opcionais)
  → “mais detalhe da conta” sob demanda (não obrigatório nesta Issue)
```

## Objetivo e aceite

- Três metas (pessimista / média / otimista) visíveis e editáveis no lugar (staff com permissão).
- Cenário ativo da cobertura = o P/M/O clicado/focado; feedback claro de qual está ativo.
- Cobertura e déficit/folga do cenário ativo legíveis sem sair da dobra.
- Classe territorial (Reduto / Expansão / Manutenção / Marginal / Sem base) visível nesta seção (além ou em conjunto com o status).
- Tooltips com one-liner + link `#meta`, `#cobertura-da-meta`, `#classe-territorial`.
- Não exige abrir aba Eleições para a leitura local básica.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item.
- **Decisões desbloqueadas:**
  - CG: “aperto ou alivio a meta neste cenário?”
  - CG/assessor: “a rede cobre a meta ou há déficit material?”
  - CG: “aloco perna como expansão ou defendo reduto?” (classe)
- **Forma:** _adiada ao impl_. Restrições: leitura relativa/local; classe nunca “órfã” sem poder explicar (tooltip/fatores); sem % estadual absoluto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** bloco na composição da rota v2; reuso da conta/goal coverage / expectedVotes / classificação territorial já usados no detalhe e na lista.
- **Precedente:** E8 conta da cadeira; coluna Classe na lista; edit-in-place de expectedVotes (B9).
- **Risco de acoplamento:** permissões de edição de meta; não inventar segundo significado de “cenário” divergente do resto da campanha.

## Dependências

- Hard: **B147** (shell v2).
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md).
- Serializes com B149–B151 na mesma rota v2.

## Fora de escopo

- Baseline TSE / comparativo de candidatos (permanecem secundários / FAB / cutover).
- Rede de lideranças (B149).
- Sugestões e visita (B150).
- Redesenhar o card completo da conta da cadeira na dobra (detalhe sob demanda OK).

## Rabbit holes de produto

- **Trazer todos os diagnósticos E8 para a dobra.** **Corte:** P/M/O + cobertura + classe; resto sob demanda.
- **Três coberturas simultâneas (uma por cenário) sempre.** **Corte:** uma cobertura do cenário ativo; os três números de meta ficam visíveis.

## Decisões de produto (fechadas)

- **Classe só na conta, só no status, ou nos dois?** **Decisão:** A — nos dois (status = glance, conta = com fatores). _(confirmado produto 2026-08-02)_

## Referências

- GitHub Issue #331
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md)
- `docs/plans/conta-da-cadeira.md` (E8, histórico)
- Conceitos: `#meta`, `#cobertura-da-meta`, `#classe-territorial`
