# C87 — Atualização unificada (texto + polaridade + urgente)

Status: ready
Atualizado em: 2026-08-06
Issue: #396
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: C — reformula o formulário/feed/wizard de atualização do município (não é só copy)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-hin1/canvases/plan-c87-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; um outcome verificável (registrar o que aconteceu sem escolher tipo de registro)
Responsável: —

## Intenção

Hoje o staff escolhe entre semanal / urgente / nota / sinal (e, no sinal, ainda um tipo). Em campo isso atrasa e confunde. Queremos **um** jeito de anotar o que aconteceu: texto livre, classificação boa / neutra / ruim, e um toggle urgente. Tendência política do município (favorável / neutra / desfavorável) continua onde já está — não é este seletor.

## Persona e fluxo

- **Persona / contexto:** Alex (coordenador) e Casey (assessor) no detalhe do município, na lista (“último sinal”) ou no wizard “Registrar o que aconteceu”, sob pressão de tempo.
- **Job principal:** registrar o fato do dia em poucos segundos, sem taxonomia de tipo.
- **Fluxo desejado:** escolhe o município (se ainda não estiver nele) → escreve o texto → marca Boa / Neutra / Ruim → opcionalmente liga Urgente → registra → o feed e o frescor refletem o registro.
- **Anti-goals de produto:** segundo seletor que copie a Tendência; spreadsheet de atualizações; reabrir os cinco tipos de sinal; relatório semanal de três caixas obrigatórias; misturar deliberação (responsável / thread / resolvido) neste item — isso é **C88**.

### Esboço de fluxo (C)

```text
[detalhe / lista / wizard]
  → formulário único: texto + polaridade + urgente?
  → Registrar
  → feed mostra chip polaridade (+ Urgente) e o texto
```

## Objetivo e aceite

- Staff registra atualização com **apenas** texto livre + polaridade (Boa / Neutra / Ruim) + toggle Urgente.
- Não há mais escolha de “tipo de registro” (semanal / urgente / nota / sinal) nem tipo de sinal tipado na UI de campanha.
- Polaridade da atualização **não** altera nem substitui a Tendência do município.
- Frescor / “último sinal” continua refletindo o registro (e pledges, como já faz).
- Leader lockdown intacto (liderança não entra no fluxo staff de atualização).
- Decisão explícita no gate sobre o que substitui o gatilho E11 de “sinal de adversário” (ver questões).

## Dados (intenção)

- **Vou apresentar dados?** Sim, só aggregate para outro consumidor (frescor; eventualmente sugestões E11).
- **Decisões desbloqueadas:**
  - Coordenação: “o que ouvi hoje é bom, neutro ou ruim — e é urgente?”
  - Fila: onde o município ficou sem registro recente (inalterado em intenção).
- **Forma:** _adiada ao plano de implementação_ — restrição: sem % estadual absoluto; polaridade é classificação do **registro**, não KPI estadual.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/schemas/municipalityUpdate.ts`, collection/form/feed de atualização do município, wizard `registrar-sinal` / ações rápidas, loaders do detalhe/dossiê, gatilhos em `municipalityTriggers` / catálogo de sugestões, notificações de criação de atualização.
- **Precedente a olhar:** C12 / B62 (modelo de sinal), B26 / B63 (lista + wizard de sinal), formulário e feed atuais de `municipalityUpdate`.
- **Risco de acoplamento:** E11 lê presença de sinal tipado de adversário; wizards e copy do Início ainda falam “sinal”; imutabilidade histórica do registro staff.

## Dependências

- Nenhuma dura. Suave: alinhar copy do catálogo de ações do Início e wizards encadeados depois do cutover.
- **C88** depende deste item (deliberação assume o modelo unificado).

## Fora de escopo

- Thread de discussão, responsável e “resolvido” → **C88**.
- Mudar Tendência política do município (já existe; wizard B64).
- Redesign do shell do município v2 além do bloco de atualizações.
- Backfill semântico fino de registros antigos além do mínimo para o feed não quebrar (executor decide migração de dados no impl).

## Rabbit holes de produto

- **"Já que unificou, coloca responsável e thread aqui."** Vira dois jobs. **Corte:** C88.
- **"Polaridade = Tendência."** Confunde estado do município com tom do fato. **Corte:** rótulos Boa/Neutra/Ruim na atualização; Tendência intacta.
- **"Mantém os tipos de sinal como opcional."** Volta a complexidade. **Corte:** fora da UI de campanha neste item.
- **"Relatório semanal estruturado volta como template."** **Corte:** um campo de texto; quem quiser estrutura escreve no próprio texto.

## Questões em aberto (produto)

- **Com a saída do sinal tipado, o que alimenta o nível 1 do E11 (adversário)?** **Opções:** A) polaridade Ruim + Urgente conta como alerta frouxo; B) um único toggle extra “Alerta de adversário?” (ainda mais simples que 5 tipos); C) dropar o gatilho automático — só frescor/silêncio. **Recomendação:** B se a coordenação ainda quer fila de risco confirmado; C se o custo de um campo a mais não vale na mesa. _(assumido B — validar)_
- **Polaridade é obrigatória?** **Opções:** A) sim; B) opcional (default Neutra). **Recomendação:** A — força o gesto de classificar sem custo real. _(assumido)_
- **Registros antigos (semanal/sinal/…)** no feed: **Opções:** A) mostrar como atualização genérica com polaridade Neutra + texto concatenado; B) badge “legado” até sumirem. **Recomendação:** A — sem segunda UI. _(assumido)_

## Referências

- GitHub Issue: [#396](https://github.com/fsolla/teqo/issues/396)
- Canvas UI (gate): [/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-hin1/canvases/plan-c87-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-hin1/canvases/plan-c87-ui-draft.canvas.tsx)
- `docs/plans/simplificar-modelo-sinal.md` (B62, entregue) · `docs/plans/registro-fundacao.md` (C12) · `docs/plans/wizard-registro-sinal.md` (B63)
- Superfícies vivas: formulário/feed de atualização do município, coluna “Último sinal”, wizard de registrar sinal, `campaignIntelligenceConcepts` (pauta do silêncio)
