# Briefing de capacitação Solla 1313 — até 4 páginas para quem vai pedir voto no recorte (cidade · instituição · tema)

Status: rascunho
Atualizado em: 2026-09-22
Issue: #1252
Priority: P1 (assumido — prazo de campanha 2026; a família de dossiês é P2)
Impeccable: C — fluxo/entregável novo (briefing de capacitação por recorte); design hi-fi obrigatório no gate
Design UI: docs/plans/briefing-capacitacao-solla-ui-design.html
Appetite: ~3–4 dias eng; um briefing por recorte (até 4 páginas A4) derivado do dossiê, com roteiro de pedido e Q&A
Responsável: —

## Intenção

Os dossiês dizem o que Solla **fez** e — a partir do C209 — o que ele **defende** por recorte. Falta a peça entre o documento e a pessoa que pede o voto: quem vai panfletar e pedir voto a amigos e colegas hoje improvisa o pedido e trava nas objeções ("é do PT", "não gosto do Lula", "o governo não fez nada aqui"). O pedido é um **briefing de capacitação** por recorte, **até 4 páginas**, derivado dos artefatos do dossiê — sem segunda pesquisa factual —, com roteiro de pedido de voto e perguntas prováveis × melhores respostas, dos dois lados (direita e esquerda), para transformar simpatia em compromisso nomeado com o número. É **insumo interno de capacitação**, não peça publicável: defeso 2026, sem CTA público, sem marca de campanha publicável. Não substitui o dossiê nem o boletim.

## Persona e fluxo

- **Persona / contexto:** militante/voluntário que vai panfletar e pedir voto no recorte; e quem coordena essa militância. Celular na mão, antes do contato (estudo) e durante (consulta rápida); estado de espírito: quer pedir o voto, mas teme bater de frente ou não saber responder.
- **Job principal:** sair do "vou falar bem do Solla" para **pedir o voto 1313 explicitamente**, com plano de voto e compromisso nomeado, tendo resposta pronta, honesta e ancorada em fato local para as objeções.
- **Fluxo desejado:** escolhe o recorte → lê/estuda o briefing uma vez (≤4 páginas) → ensaia o pedido e o Q&A → em campo, consulta no celular → o que não soube responder volta como lacuna para o próximo levantamento do dossiê.
- **Anti-goals de produto:** não virar peça publicável, manual de debate confrontativo, dossiê resumido, guia de promessas, nem exposição de cenário eleitoral/números staff-only.

### Esboço de fluxo (C)

```text
[escolhe o recorte] → [lê o briefing (essencial + defesas + roteiro + Q&A + evitar)]
→ [ensaia pedido explícito + plano de voto + compromisso nomeado]
→ [campo: conversa, escuta, responde sem repetir o ataque, fecha no pedido]
→ [dúvida nova → anota → próximo ciclo do dossiê]
```

### Design UI (C)

- Design UI (gate): `docs/plans/briefing-capacitacao-solla-ui-design.html` — o `designer` produz o hi-fi (PDF A4 de até 4 páginas, legível no celular) **antes** da implementação; o HTML é a fonte de verdade do port.

## Objetivo e aceite

- Um briefing por recorte (cidade · instituição · tema), PDF A4 de **até 4 páginas** + companion `.md`, derivado do dossiê daquele recorte, **sem segunda pesquisa factual**.
- **Integrado ao fluxo dos dossiês:** as três skills de dossiê passam a apontar a skill de briefing, e o fluxo do dossiê entrega o **terceiro entregável** — dossiê + boletim + briefing — na mesma invocação (a skill de briefing segue invocável sozinha por recorte).
- Rótulo literal em todas as páginas: **"Insumo interno de capacitação — não publicar"**; artefato gitignored; sem CTA público.
- Seções mínimas: identificação do recorte; "o essencial do recorte" (fatos-âncora com fonte); "o que Solla defende" (herdado da dimensão que nasce no C209); **roteiro do pedido de voto**; **perguntas prováveis × melhores respostas**; **o que evitar**; **o que conferir no dossiê** (não prometer sem lastro).
- Q&A cobre os dois lados: ataques da direita **e** da esquerda, incluindo associação PT/Lula/Jerônimo e ataques ao governo do PT **no recorte**.
- Régua de resposta: reconhecer a acusação em uma frase sem repeti-la → fato local verificável do recorte → fechar no pedido; sem confronto nem humilhação; sem prometer entrega sem lastro; sem números staff-only.
- Teto de 4 páginas **rígido**, com corte por prioridade declarada (o impl define a ordem).
- Guardrails herdados intactos: sem fonte não publica; empenho ≠ pagamento (fase por valor); esfera explícita nunca somada; leitura relativa/local (nunca % estadual absoluto); PII mínima; **nunca expor cenários de votos/estimativas staff-only**.

## Dados (intenção)

- **Vou apresentar dados?** Sim, derivado — o briefing reapresenta fatos-âncora já com fonte do dossiê para um novo consumidor (quem pede voto); não produz dado novo nem agrega.
- **Decisões desbloqueadas:** quem pede voto escolhe o que citar e o que evitar no contato; o coordenador decide onde reforçar capacitação (perguntas sem resposta boa); a comunicação vê que resposta não tem fato-âncora e vira pauta do dossiê.
- **Forma:** _adiada ao plano de implementação_ — restrições: números com fonte e contexto; esfera explícita por item, nunca somada; leitura relativa; Q&A em prosa curta, sem gráfico ou placar.

## Dados da decisão (literais)

- ID **C210** · slug `briefing-capacitacao-solla` · arquivo `docs/plans/briefing-capacitacao-solla.md` · UI `docs/plans/briefing-capacitacao-solla-ui-design.html`.
- Nome do artefato: **"Briefing de capacitação"** — nunca "Briefing por era" (colide com `.agents/skills/dossie-solla-{cidade,instituicao,tema}/SKILL.md` §"Briefing por era").
- **Integração (literal):** `.agents/skills/dossie-solla-{cidade,instituicao,tema}/SKILL.md` citam a skill `briefing-capacitacao-solla` e entregam o briefing junto do dossiê e do boletim; o fluxo reusa a mesma skill/build — nunca um segundo pipeline.
- Rótulo literal: `Insumo interno de capacitação — não publicar`; teto de **4 páginas A4**; saída PDF + companion `.md`.
- Roteiro do pedido (literais): pedido explícito **"vote 1313"** + **plano de voto** (onde/quando/como) + **compromisso nomeado** — base: Nickerson & Rogers 2010 (+4,1 p.p.).
- Princípios de persuasão como conteúdo do briefing (com citação): contato pessoal mobiliza, persuasão ≈ 0 em eleição geral (Gerber & Green 2000; Kalla & Broockman 2018); relacional amigo-a-amigo > broadcast (Schein et al. 2021; Michelson et al. 2024); entorno vota junto (~60% no outro adulto da casa, Nickerson 2008) e norma alta "a maioria vota" (Gerber & Rogers 2009); pressão leve e não humilhante — exposição pesada gera reactance (Gerber, Green & Larimer 2008; Mann 2010; Matland & Murray 2012); compromisso/coerência, prova social, afeição/unidade (Cialdini & Goldstein 2004); escuta/narrativa > argumento puro (Broockman & Kalla 2016; Kalla & Broockman 2020); credibilidade por fato local concreto e repetido — credit claiming verificável (Grimmer, Messing & Westwood 2012; Wood & Porter 2019).
- "O que evitar" (anti-padrões literais): confrontar em território hostil (Lau, Sigelman & Rovner 2007); envergonhar/expor o eleitor (reactance); repetir o ataque/mito — não liderar com o mito, dar explicação alternativa (Ecker et al. 2022; Debunking Handbook 2020); broadcast impessoal como substituto do pessoal (robocall ≈ 0, texto de massa ≈ 0,29 p.p.); inflar/antecipar entrega sem confirmação.
- Canal de campo: WhatsApp 1-a-1 e encaminhamento por pessoa de confiança > corrente em massa; lembrete perto da eleição.
- Personas internas (citar por path): `docs/research/persona-cientista-politico-campanha-ba.md:21` "Campanha não persuade; campanha organiza e orienta"; `:23` "Na Bahia, o voto do campo é de Lula e do governador antes de ser seu"; `docs/research/relatorio-entrevista-persona-campanha.md:80` "1º pedido explícito (converter simpatia em compromisso nomeado com número)"; `:241` anti-goal "persuasão de território hostil (evidência ≈ 0)"; `docs/research/persona-emendas-coordenador-campanha.md:15` "ZAP é o campo. Tudo passa pelo ZAP."; `docs/research/persona-emendas-coordenador-comunicacao.md:18` "O anúncio vale mais que o valor"; `:22` trava jurídica "gabinete não é comitê" (material de mandato ≠ campanha).
- Tensão a registrar no briefing: a evidência é estrangeira (EUA, voto facultativo) e a persona avisa "EUA ≠ Brasil"; no Brasil o análogo é orientar o número na urna; **não misturar números de mobilização de estudos distintos**.
- Reuso de voz (dono único, sem gemar): `.opencode/skills/solla-comunicacao/SKILL.md`, `referencia/tom-e-exemplos.md` (rebates reais, §Combate/resposta) e agente `.opencode/agent/solla-comunicacao.md`.
- Perguntas prováveis derivam de: (a) objeções típicas ao voto no PT/Solla; (b) contexto/temas do recorte segundo o dossiê e as notícias já pesquisadas; o impl decide a profundidade.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/briefing-capacitacao-solla/SKILL.md`, `.opencode/commands/briefing-capacitacao-solla.md` (frontmatter só `description:`, corpo cita a skill por nome exato + `$ARGUMENTS`, **sem** `model:`), subagente `.opencode/agent/*` (mode subagent, sem pin openai), scripts de build do briefing.
- **Reuse surface:** JSONs `data/dossie-*/<slug>.{a,b,c}.research.json` + `<slug>.narrative.json` + `<slug>.snapshot.json`; `buildDossierReport` (`scripts/lib/dossieBlocks.mjs:222`) e `bulletinFacts` (só fatos com fonte); `scripts/lib/dossieResearch.mjs:422/497-515/599`; `dossieBlocks.mjs:432-442` (`opening.authored`); PDF via `scripts/lib/buildPdf.mjs` (`emitHtmlPairPdf:224` exige `[data-page="resumo"]` e `[data-page="boletim"]` — o briefing é documento único: editar o dono, não fork). **Teto de 4 páginas não é expressável hoje** (só fit por folha) — obrigação do impl.
- **Precedentes a olhar:** specs de skill de lote `tests/unit/dossieBatchSkill.unit.spec.ts` (+ irmãos institution/theme); registry `tests/unit/opencodeCommands.unit.spec.ts:13-24` (adicionar o novo command); `.opencode/skills/solla-comunicacao/` (voz/resposta a ataque); `/relatorio-cidade` (`research.approach`, `opposition`, "Pauta das lideranças") como precedente de cenário eleitoral — não copiar o dono.
- **Risco de acoplamento:** consumir os JSONs do dossiê, nunca um segundo pipeline de pesquisa/render; não tocar schema/migration/DB; não vazar `estimatedVotes` nem cenários staff-only.

## Dependências

- Nenhuma dura. **Soft com C209** (`docs/plans/dossies-sobrios-analiticos.md`): o briefing consome a dimensão "o que defende" que nasce lá; sem C209, deriva dos mesmos JSONs de notícias/acervo — C210 não bloqueia C209 nem vice-versa.

## Fora de escopo

- Redesenho do dossiê/boletim e a própria dimensão "o que defende" (C209).
- Publicar, veicular, impulsionar, CTA público ou qualquer peça de campanha em defeso; marca publicável.
- Segunda pesquisa factual do recorte; pesquisa eleitoral/quantitativa nova; cenário de votos.
- Promessas de entrega, agenda, posição não registrada; qualquer dado staff-only.
- Schema, migration ou escrita em banco; URL público.

## Rabbit holes de produto

- **"Já que tem pesquisa, faz o manual de campanha completo".** Vira treinamento/política de campanha inteira. **Corte:** até 4 páginas, roteiro + Q&A.
- **"Responde tudo com dado".** Vira dossiê resumido e mata o teto. **Corte:** Q&A curto, cada resposta com um fato-âncora.
- **"Inclui cenário eleitoral/números de voto".** Expõe staff-only e promete o que a militância não controla. **Corte:** só fatos do dossiê; cenário é C163.
- **"Pesquisa o recorte de novo".** Segundo pipeline e fonte divergente. **Corte:** deriva do dossiê; a única pesquisa nova é a de capacitação (já compilada).
- **"Faz uma peça bonita para divulgar".** Material publicável em defeso. **Corte:** insumo interno rotulado, consulta pessoal.

## Questões em aberto (produto)

- _(decidido no gate, 2026-09-22: **A** — uma skill `/briefing-capacitacao-solla <recorte>`, **integrada ao fluxo das skills de dossiê** — elas linkam a skill e entregam o briefing junto do dossiê e do boletim.)_
- _(decidido no gate: **A** — companion `.md` sim.)_
- _(decidido no gate: **A** — sem cenário eleitoral no briefing.)_
- _(decidido no gate: **A** — P1, prazo de campanha 2026.)_
- **Reaproveitar a voz do `solla-comunicacao`?** **Opções:** A) sim, para respostas a ataque | B) redação própria. **Recomendação:** A — dono existente evita gemar tom.
- **Teto de 4 páginas rígido?** **Opções:** A) rígido, corte por prioridade declarada | B) teto mole. **Recomendação:** A — o valor é ser curto para estudar e consultar.

## Referências

- Design UI (gate): `docs/plans/briefing-capacitacao-solla-ui-design.html` (+ assets em `docs/plans/briefing-capacitacao-solla-ui-design-assets/`).
- Plano irmão e fronteira: `docs/plans/dossies-sobrios-analiticos.md` (C209).
- Skills da família: `.agents/skills/dossie-solla-{cidade,instituicao,tema}/SKILL.md`; specs `tests/unit/dossieBatchSkill.unit.spec.ts`; registry `tests/unit/opencodeCommands.unit.spec.ts`.
- Engine: `scripts/lib/dossieBlocks.mjs`, `scripts/lib/dossieResearch.mjs`, `scripts/lib/buildPdf.mjs`; builders `scripts/build-dossie-solla-*.mjs`.
- Voz: `.opencode/skills/solla-comunicacao/SKILL.md` + `referencia/tom-e-exemplos.md`; agente `.opencode/agent/solla-comunicacao.md`.
- Personas: `docs/research/persona-cientista-politico-campanha-ba.md`, `docs/research/relatorio-entrevista-persona-campanha.md`, `docs/research/persona-emendas-coordenador-campanha.md`, `docs/research/persona-emendas-coordenador-comunicacao.md`.
- `AGENTS.md` (defeso, artefato gitignored); `.agents/skills/plan-issue/ui-design-html.md` (gate de design).

## Self-score (shaping, gate ≥4)

1. **Fatia = um outcome verificável?** Sim — um briefing de capacitação por recorte, ≤4 páginas, com roteiro de pedido e Q&A. — **5/5**
2. **Appetite declarado e a intenção cabe nele?** 3–4 dias; consomem quota a derivação das respostas com lastro, o Q&A dos dois lados e o teto de páginas. — **4/5**
3. **Persona + job + aceite claros (sem jargão de stack)?** Sim — quem panfleta/pede voto e quem coordena; job e aceite por seção e régua de resposta. — **5/5**
4. **Direção no codebase é hipótese (não contrato técnico)?** Sim — paths como pista; forma de render e corte de páginas adiada ao impl. — **4/5**
5. **Zero decisões duras de engenharia no plano?** Sim — sem schema/migration/signature; literais são conteúdo, rótulo e citações de produto. — **5/5**

**Total 23/25 (média 4,6/5) — passa o gate ≥4/5.**
