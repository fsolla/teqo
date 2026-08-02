# Município detalhe v2 — plano master

Status: registrado
Atualizado em: 2026-08-02
Issue: — (lote: #330–#335 / B147–B152; sem Issue-pai no GitHub)
Priority: P1 (lote)
Model: — (por filho)
Impeccable: C — superfície nova em rota paralela
Appetite: lote ~4–6 dias eng em fatias; cutover só após OK produto
Responsável: —

## Intenção

O detalhe atual de município (`/campanha/municipios/[slug]`) tem **6 abas** e uma Visão geral em torre de cards. O **Coordenador Geral** não explora bem abas nem scroll longo: lideranças, conta e próximo passo ficam fora do caminho.

Queremos um **briefing de operação em um olhar** — status → conta → rede → agora — com **edit where you see**, motivo opcional nas mudanças de conjuntura, e ações secundárias no FAB. Desenvolvemos em rota paralela **`/campanha/municipio/<slug>/v2`**; só após confirmação de produto a v2 substitui a canônica.

Este arquivo é o **pai de intenção** do lote. Cada Issue filha tem plano próprio e aponta para cá. Planos de **implementação** (`*-impl.md`) nascem em `work-issue` / `agent-work-issue`, não aqui.

## Persona e fluxo (lote)

- **Persona / contexto:** Coordenador Geral (e Candidato / assessor staff) na mesa ou no celular, vindo da lista ou do mapa, com pouco tempo.
- **Job principal do lote:** abrir um município e, sem trocar aba, saber como estamos, quem segura, o que falta na meta, e o que fazer agora — e agir no lugar.
- **Fluxo desejado (lote):**

```text
[Lista/mapa] → /campanha/municipio/<slug>/v2
  → STATUS (nível · tendência · sinal · classe · agregado)
  → CONTA (meta P/M/O · cobertura do cenário ativo · classe)
  → REDE (lista; votos na célula)
  → AGORA (encaminhamento · sugestão · visita condensada)
  → FAB (dossiê / eleições / …)
[Outcome] decide ou age sem explorar abas
```

- **Anti-goals de produto (lote):** não redesign do shell inteiro; não spreadsheet mode; não segundo cadastro de pessoa; não % estadual absoluto; não obrigar motivo nas mudanças; não expor estimado a `leader`; não matar a rota antiga até o cutover.

## Filhos do lote

| ID | Plano | Outcome em uma linha |
| ---- | ----- | -------------------- |
| B147 (#330) | [municipio-v2-shell-status.md](municipio-v2-shell-status.md) | Rota v2 + faixa de status operável |
| B148 (#331) | [municipio-v2-conta-local.md](municipio-v2-conta-local.md) | Meta P/M/O + cobertura + classe na 1ª dobra |
| B149 (#332) | [municipio-v2-rede.md](municipio-v2-rede.md) | Rede em lista editável (sem aba) |
| B150 (#333) | [municipio-v2-agora.md](municipio-v2-agora.md) | Encaminhamento + sugestão + visita condensada |
| B151 (#334) | [municipio-v2-fab-secundario.md](municipio-v2-fab-secundario.md) | Secundárias no FAB (não na dobra) |
| B152 (#335) | [municipio-v2-cutover.md](municipio-v2-cutover.md) | v2 vira canônica após OK produto |

**Ordem:** B147 primeiro (shell). B148–B151 dependem de B147 e **serializam** entre si na mesma rota v2 (um agente de cada vez no surface). B152 por último, após validação humana.

## Decisões de produto do lote _(confirmadas no gate 2026-08-02)_

1. Rota paralela: `/campanha/municipio/<slug>/v2` (singular) até B152.
2. Sinal = **mesmo padrão de seletor** que nível e tendência (não pill → fluxo distinto).
3. Mudança de nível / tendência / sinal → **modal de motivo opcional** (política alinhada a B134).
4. Texto sob o status = **agregado** das últimas notas (nível · tendência · sinal).
5. Explicações = **tooltip** + link para `/campanha/conceitos#…` (não painel inline).
6. Clique no campo P/M/O **ativa** aquele cenário na cobertura.
7. Classe territorial visível na 1ª dobra (Expansão / Reduto / …).
8. Nome / TI **não** competem no corpo — soft-dep B145 (título no header).
9. Página antiga intacta até B152.

## Soft-deps externos

- **B145** (#315) — título da entidade no header; v2 não redesenha chrome de nome.
- **B134** (#288) — motivo opcional (wizard/nível); v2 **herda a política**, não espera o merge para começar o shell.

## Dados (intenção do lote)

- **Vou apresentar dados?** Sim, nas fatias B148 (conta/classe) e B149 (pledges); status qualitativo em B147.
- **Decisões desbloqueadas:** ver planos filhos.
- **Forma:** adiada aos `*-impl.md`. Restrição de produto: leitura relativa/local; sem % estadual absoluto.

## Direção no codebase (hipótese do lote)

- **Áreas prováveis:** nova rota sob `src/app/(campaign)/campanha/(app)/`, composição em `src/components/campaign/municipality/`, loaders já usados pelo detalhe atual / dossiê / conta / pledges / sugestões / visita.
- **Precedente:** detalhe atual + E16 dossiê + E8 conta + lista B9 edit-in-place + FAB B126; canvas de produto na sessão de shaping.
- **Risco de acoplamento:** `leader` lockdown; não duplicar política de voto estimado; não quebrar links da rota antiga até o cutover.

## Fora de escopo (lote)

- Implementação técnica detalhada (fica nos `*-impl.md`).
- Redesign de lista/mapa/Início.
- Mudança de glossário de conceitos (só linkar).
- Import CSV, demandas embutidas, comparativo eleitoral na 1ª dobra.

## Rabbit holes de produto

- **Epic único “refazer detalhe”.** Explode appetite e review. **Corte:** seis Issues com aceite próprio.
- **Trazer o dossiê inteiro para a dobra.** Mata densidade. **Corte:** dossiê/eleições só no FAB até cutover decidir destinos.
- **Auto-save ao tocar o select.** Perde o rito de motivo. **Corte:** select abre modal; confirmação grava.

## Referências

- Issues: [#330](https://github.com/fsolla/teqo/issues/330)–[#335](https://github.com/fsolla/teqo/issues/335) (B147–B152)
- Gate / shaping: sessão canvas `municipio-detalhe-briefing` (ajustes Select+tooltip na intenção).
- Soft: `docs/plans/motivo-opcional-tendencia-e-nivel.md` (B134), issue B145.
- Entregas reusadas: E8, E10/E11, E13, E14, E16, B9, B126.
- Rotas atuais: `/campanha/municipios/[slug]` (abas).
