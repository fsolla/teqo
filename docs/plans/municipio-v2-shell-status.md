# Município v2 — shell + faixa de status

Status: registrado
Atualizado em: 2026-08-02
Issue: #330
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: C — fluxo novo na rota `/campanha/municipio/<slug>/v2`
Appetite: ~1–1,5 dia eng; rota + status operável (sem conta/rede/agora)
Responsável: —

**Plano pai:** [municipio-detalhe-v2.md](municipio-detalhe-v2.md) (lote B147–B152)

## Intenção

Abrir o município na v2 e, na **primeira dobra**, ler e alterar a conjuntura (nível, tendência, sinal) sem abas, sem `/editar` e sem scroll de cards. Esta fatia entrega o **chão** da v2: rota paralela + faixa de status densa. Conta, rede, agora e FAB ficam nos filhos.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral (e staff unrestricted / assessor no município), vindo da lista ou do mapa, com pressa.
- **Job principal:** em poucos segundos responder “como estamos neste município?” e registrar mudança de nível, tendência ou sinal.
- **Fluxo desejado:**
  1. Abre `/campanha/municipio/<slug>/v2`.
  2. Vê três **seletores** equivalentes (nível, tendência, sinal) + classe territorial + indicador de silêncio/frescor.
  3. Ao mudar qualquer um dos três → **modal de motivo opcional** → Confirmar (vazio OK).
  4. Sob os controles, lê o **agregado** das últimas notas (nível · tendência · sinal).
  5. Hover/focus em cada chip/controle → **tooltip** com one-liner + link para o conceito em `/campanha/conceitos`.
- **Anti-goals de produto:** painel de ajuda inline no lugar de tooltip; fluxo de sinal diferente do de nível/tendência; motivo obrigatório; hero com nome/TI no corpo (B145); auto-gravar ao tocar o select.

### Esboço de fluxo (C)

```text
[Abrir v2]
  → faixa: [Select nível] [Select tendência] [Select sinal] [Classe] …
  → [mudou select] → [Modal motivo opcional] → [Confirmar]
  → agregado atualiza
  → (placeholders ou vazio para conta/rede/agora — filhos)
```

## Objetivo e aceite

- Rota v2 acessível a staff do município; **leader** não entra (lockdown).
- Nível, tendência e sinal usam o **mesmo padrão de seletor** + modal de motivo opcional.
- Agregado de texto mostra as últimas notas disponíveis dos três eixos (e ausência de sinal / idade quando couber).
- Tooltips nos sinais da faixa (nível, tendência, sinal, classe) com resumo + link a conceitos.
- Página `/campanha/municipios/[slug]` **intacta**.
- Mobile: faixa legível sem exigir scroll horizontal de abas.
- Nome do município / TI não competem como hero no corpo (respeitar B145 / chrome existente).

## Dados (intenção)

- **Vou apresentar dados?** Sim, sobretudo qualitativos (nível, tendência, tipo/idade de sinal, classe).
- **Decisões desbloqueadas:**
  - CG: “subo/desço envolvimento?” / “marco conjuntura?” / “registro sinal agora?”
  - Staff: “este município está frio (silêncio)?”
- **Forma:** _adiada ao plano de implementação_. Restrição: silêncio/frescor alinhado à regra de produto já usada na lista (ordem de grandeza de dias frios).

## Direção no codebase (hipótese)

- **Áreas prováveis:** nova rota sob `src/app/(campaign)/campanha/(app)/municipio/…/v2`; composição em `components/campaign/municipality/`; reuso de loaders/view models de detalhe/estratégia/updates; tooltips no precedente de hover da campanha; glossário via conceitos.
- **Precedente a olhar:** detalhe atual; B134 (motivo opcional); B145 (título no header); E14 nível; registro de sinal na lista.
- **Risco de acoplamento:** escrita de nível só unrestricted; não expor campos staff a leader; não quebrar rota antiga.

## Dependências

- Soft: B145 (chrome de título), B134 (política de motivo opcional).
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md).
- Filhos que esperam este: B148–B151 (hard), B152 (hard).

## Fora de escopo

- Conta P/M/O e cobertura (B148).
- Lista de lideranças / pledges (B149).
- Encaminhamento, sugestões, visita (B150).
- FAB de secundárias (B151).
- Cutover (B152).
- Comparativo eleitoral / dossiê completo na dobra.

## Rabbit holes de produto

- **Reimplementar o dossiê na home da v2.** **Corte:** só status nesta Issue.
- **Wizard completo de nível (histerese/override) redesenhado do zero.** **Corte:** respeitar ritos de produto já decididos (E14 + B134); só o encaixe na faixa.
- **Tooltip = página de conceito embutida.** **Corte:** one-liner + link.

## Decisões de produto (fechadas)

- **Select de sinal com município “frio” mostra o quê como valor atual?** **Decisão:** A — valor sentinela “Sem sinal / frio (N dias)” na faixa; idade no agregado/tooltip. _(confirmado produto 2026-08-02)_

## Referências

- GitHub Issue #330
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md)
- B134 / `docs/plans/motivo-opcional-tendencia-e-nivel.md`
- Conceitos: `#nivel-de-envolvimento`, `#classe-territorial`, `#pauta-do-silencio`
