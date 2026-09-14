# Relatório de cidade pré-viagem (agente + skill → PDF A4)

Status: rascunho
Atualizado em: 2026-09-14
Issue: #1007
Priority: P1
Impeccable: B — superfície nova (documento A4), sem tela de app
Rascunho UI: docs/plans/relatorio-cidade-viagem-a4-draft.html
Appetite: ~2–3 dias eng; um outcome verificável — chamar com uma cidade e sair o PDF
Responsável: —

## Intenção

A eleição é em ~3 semanas e o candidato viaja quase todos os dias. Ao chegar numa cidade, ele precisa saber sem garimpo: quem manda ali (prefeito aliado ou oposição? de que federação?), quem são as lideranças, o que o mandato já entregou (emendas, falas no acervo, menções na imprensa), o que está quente na região e — decisivo em ano eleitoral — o que pode e o que não pode ser anunciado. O pedido é explícito desde a sessão de campo de 2026-07-23 (O6; caso Nazaré das Farinhas). O E16 entregou a tela/print interno; falta o **documento de viagem**: um PDF por cidade, gerado sob demanda por um **agente + skill**, cruzando a base interna do Teqo (lida direto da produção) com pesquisa web e **fontes oficiais datadas e com fonte**.

## Persona e fluxo

- **Persona / contexto:** o **candidato** (Almerindo Vasconcelos) no deslocamento/véspera da visita — lê no celular, uma passada de olho; e o **CG/assessor** (Nivaldo Cerqueira) que prepara a agenda e confere as fontes.
- **Job principal:** chegar na cidade sabendo "quem é quem, o que entreguei, o que está quente, o que posso/não posso anunciar" — sem depender de memória, WhatsApp ou garimpo manual.
- **Fluxo desejado:** pede o relatório com o nome da cidade → o agente exporta a base, pesquisa a web com data/URL e gera o PDF → o candidato lê o resumo de 1 página antes de desembarcar, decide o tom do palanque e o que acionar; o aprofundamento fica com o assessor.
- **Anti-goals de produto:** virar relatório de 40 páginas; inventar dado sem fonte; virar segundo cadastro/fonte de verdade; tentar cobrir toda a internet; prometer anúncio que o defeso não permite.

### Esboço de fluxo (B/C/D)

```text
[pede: "relatório de Teixeira de Freitas"] → [export read-only da base + pesquisa web datada]
→ [template A4] → [PDF datado: página 1 = resumo; 2+ = aprofundamento]
→ [candidato lê no deslocamento e decide tom/anúncio] → [assessor usa o aprofundamento na agenda]
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/relatorio-cidade-viagem-a4-draft.html` (página 1, início do aprofundamento, lacuna explícita e leitura de bolso ~390px)

## Objetivo e aceite

- Chamar o agente/skill com um município e sair um **PDF A4 datado** (+ companion `.md` com números e proveniência) com **resumo de 1 página** + seções de aprofundamento, lendo a **base de produção diretamente (read-only)** no estado atual do dado (**snapshot do momento**).
- A página 1 responde sozinha o job: conta eleitoral 2022, quem é quem, o que foi entregue, o que anunciar × o que NÃO anunciar, riscos.
- Toda afirmação não trivial tem **fonte visível** (base Teqo com data de leitura; web/fonte oficial com data + URL); o que não foi encontrado aparece como **lacuna explícita** — nunca preenchido por inferência.
- Guardrails de produto: "sem fonte, não publica"; não anunciar empenho como pagamento (defeso/ano eleitoral); sem despejo de PII desnecessária (contatos completos não entram); PDF datado e **completo para o candidato** (estimativas e nível N0–N4 incluídos, sem marca de restrição).

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o PDF é documento de dados.
- **Decisões desbloqueadas:**
  - Candidato: o que falar/evitar no palanque e o que é seguro anunciar na cidade.
  - CG/assessor: se aciona/agradece prefeito e lideranças na agenda — e com que pedido.
  - Assessor: qual lacuna atacar primeiro (rede sem responsável, disputa local, cobertura de meta).
- **Restrições de produto (forma adiada ao impl):** leitura **relativa** (% do próprio voto, LQ, rank — nunca % estadual absoluto); separar visualmente "base Teqo" de "pesquisa web/fonte oficial (com data + URL)"; lacuna explícita em vez de invenção; **conteúdo completo para o candidato** (estimativas e nível N0–N4 entram, sem marca de restrição); emendas lidas da fonte oficial **em tempo de geração, sem persistir na base**.

## Dados da decisão (literais)

- **Estrutura do relatório (contrato de conteúdo).**
  - **Página 1 = "Resumo de uma olhada"**, blocos nesta ordem: (1) identificação/prioridade/classe; (2) conta eleitoral 2022 — votos, % do próprio voto, rank, meta/cobertura; (3) quem é quem — prefeito/vice/partido/federação/relação, principais lideranças, dobradinhas; (4) o que Solla entregou — emendas (`budgetNotes`) + falas + notícias; (5) o que anunciar × o que NÃO anunciar; (6) riscos — oposição/disputa local.
  - **Páginas 2+ = aprofundamento**, seções: conta eleitoral completa 2014/2018/2022; rede/lideranças com responsável e frescor; conjuntura (`politicalTrend`, forças/riscos, dobradinhas); sinais recentes (`municipalityUpdate`); demandas e visitas (`campaignDemand`/`activity`); demografia; acervo de falas (`Speech.mentionedMunicipalities`/`SpeechSegment`, com data e link); notícias internas e imprensa local; panorama regional da TI; **fontes e limites**.
- **Checklist mínimo de pesquisa web** (cada item com data + URL): prefeito/vice (nome, partido, federação, situação, relação com o campo); vereadores/dobradas; disputa local; quem mais investe na praça (bancada/adversários); notícias da cidade/região (janela ≤90 dias); emendas (fontes oficiais quando possível); imprensa/rádio local.
- **Guardrails literais:** "sem fonte, não publica"; nada de "anunciar empenho como pagamento" (defeso/ano eleitoral); PII desnecessária fora (contatos completos não entram); PDF datado e completo para o candidato.
- **Fonte interna v1:** base E16 (TSE, pledges, lideranças, sinais, demografia) + `Speech.mentionedMunicipalities`/`SpeechSegment` + `municipality.budgetNotes` ("Emendas aportadas", notas manuais) — leitura **direta à produção, read-only**, sem criar/alterar nada na base.
- **Emendas:** número/estado vêm da **fonte oficial em tempo de geração** (Câmara/Portal da Transparência — fonte exata verificada na implementação), com URL + data da consulta + fase (empenhada/paga); **sem collection, migration ou persistência** no app.
- **Entrega:** PDF + companion `.md` (números e proveniência, revisável em diff) commitados em `docs/research/` — precedente C157.
- **Precedente de render:** Chromium do Playwright `page.pdf` A4 (`printBackground`) — sem lib server-side (decisão de E16/C157).

## Direção no codebase (hipótese)

- **Áreas prováveis:** script de leitura **direta da produção read-only** (transação `read_only`, opt-in explícito; receita do proxy socat `127.0.0.1:5433` do runbook — túnel/execução remota é decisão de implementação; **sem `db:pull`/snapshot**); skill + agente/command (`.agents/skills/<nome>/SKILL.md`, `.opencode/agent/<nome>.md`); fetch da fonte oficial de emendas em runtime (sem persistência); template HTML do relatório; renderizador PDF reusando a mecânica do C157; saída `docs/research/relatorios-cidade/<slug>-<data>.pdf` + `.md`.
- **Precedente a olhar:** `scripts/build-solla-ceuci-salvador-report.mjs` (`page.pdf`), `src/utilities/municipality/municipalityDossierData.ts`, `src/utilities/ai/tools/` (queries por `mentionedMunicipalities`); runbook `docs/ops/teqo-1313-deploy.md` (acesso read-only à prod).
- **Risco de acoplamento:** compor o E16, não duplicar; leitura read-only sem tocar guards locais (nunca apontar dev/test para a prod); nenhum schema/migration novo (emendas só em memória do relatório).

## Dependências

- Nenhuma dura — E16 ✓, acervo de falas C153/C155 ✓, precedente de PDF C157/C161 ✓.
- Suave: a **persistência** de emendas (G11 estrutural) segue fora; esta entrega lê a fonte oficial apenas em runtime.

## Fora de escopo

- Persistir emendas na base (collection/migration — G11 estrutural); UI nova em `/campanha`; publicação no site; histórico comparativo entre relatórios; mapas/gráficos ricos por cidade (fatias futuras); fato por bairro/zona.

## Rabbit holes de produto

- **Relatório de 40 páginas.** Se alguém "só completar": cada seção quer crescer. **Corte:** teto de itens por seção e página 1 fechada em 1 página.
- **"IA inventa" sem fonte.** Se alguém "só completar": texto plausível sem lastro. **Corte:** "sem fonte, não publica" + separação base/web + lacuna explícita.
- **Segundo cadastro/fonte de verdade.** Se alguém "só completar": base paralela para prefeito/vereador. **Corte:** compõe E16; emendas seguem G11 manual.
- **Cobrir toda a internet.** Se alguém "só completar": research infinito e cara de dossiê de consultoria. **Corte:** checklist fixo, janela ≤90 dias, lacuna explícita.
- **Prometer o que não saiu.** Se alguém "só completar": anúncio de empenho como entrega. **Corte:** bloco "anunciar × não anunciar" com defeso; empenho nunca tratado como pagamento.

## Questões em aberto (produto)

- ~~**Acesso à base real?**~~ **Resolvida (2026-09-14):** leitura **direta à produção, read-only** (opção C) — sem snapshot/`db:pull`; mecânica de conexão (proxy/túnel/execução remota) é da implementação. **Rejeitadas:** export no homeserver e `db:pull` local.
- ~~**Destino do PDF?**~~ **Resolvida (2026-09-14):** PDF + companion `.md` **commitados em `docs/research/`** (opção B), precedente C157.
- ~~**Ferramenta de PDF?**~~ **Resolvida (2026-09-14):** Chromium do Playwright `page.pdf` (opção A); MCP/ferramenta externa e lib nova rejeitados.
- ~~**Campos staff-only (estimativas/nível N0–N4) no PDF?**~~ **Resolvida (2026-09-14):** **incluir tudo, sem marca** (opção A) — o relatório é do candidato e ele vê/sabe de tudo.
- ~~**Emendas estruturadas?**~~ **Resolvida (2026-09-14):** **fonte oficial em tempo de geração, sem persistir**; a estrutura persistida segue G11 (fora).
- **Fonte oficial de emendas (Câmara × Portal da Transparência)?** **Recomendação:** verificar na implementação (skill `source-driven-development`); critério: valor por município/ano + fase + URL estável. _(assumido — validar na implementação)_

## Referências

- GitHub Issue #1007.
- Rascunho UI (gate): `docs/plans/relatorio-cidade-viagem-a4-draft.html`.
- `docs/CUSTOMER.md` (O6 — dossiê pré-agenda) e personas: `docs/research/persona-emendas-parlamentar.md`, `docs/research/persona-emendas-coordenador-campanha.md`, `docs/research/persona-cientista-politico-campanha-ba.md`.
- Entrega vizinha: `docs/plans/dossie-municipio.md` (E16); precedente de PDF: `docs/plans/relatorio-sobreposicao-solla-ceuci-salvador{,-impl}.md` + `scripts/build-solla-ceuci-salvador-report.mjs`.
- Fontes internas: `src/utilities/municipality/municipalityDossierData.ts`, `src/collections/Speech.ts`, `src/collections/Municipality.ts` (`budgetNotes`), `docs/plans/inteligencia-campanha.md` (G11).
