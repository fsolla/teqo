# Template de plano (`docs/plans/<slug>.md`)

Estrutura extraída dos planos existentes (`overview-lista-nucleos.md`, `visitados-recentemente.md`, etc.). Manter as seções nesta ordem; omitir "Design (Impeccable)" apenas na classe **A** (só backend); **sempre** incluir "Dados → decisão → apresentação" (`N/A` se não houver superfície de dados); omitir a subseção "Referência visual (UX Pilot)" quando não houver design-ref; omitir "Wireframe (texto)" quando não houver layout a posicionar (ver skill `work-issue`).

Filtros de decisão (caro vs barato, appetite, rabbit holes, depth, fatias, doubt): [decision-quality.md](decision-quality.md).
Filtro de dados (apresentar? decisão? forma?): [data-presentation.md](data-presentation.md) — obrigatório se houver KPI/mapa/série/ranking; senão `Dados: N/A`.
Mapa skills de planejamento: [skills-map.md](skills-map.md).

````markdown
# <Título do item em pt-BR>

Status: rascunho
Atualizado em: <YYYY-MM-DD>
Issue: #<N> (preencher após `pnpm agent:register`; enquanto não registrado: "—")
Priority: <P0 | P1 | P2 | P3>
Model: <slug sugerido por model-selection: composer-2.5 | cursor-grok-4.5-low|medium|high | kimi-k3-low>
Impeccable: <A | B | C | D> — <uma linha: N/A sem UI | encaixe em tela X | UI nova em rota Y | ref Nome.png>
Appetite: <ex.: ~1–2 dias eng; migration + 1 action + encaixe em lista existente>
Responsável: —

## Premissas

<!-- Obrigatório. O que o plano assume e o gate deve confirmar. Não omita. -->

1. <premissa de produto / papel / schema / escopo>
2. <…>
→ Corrija no gate ou o implementador segue com estas.

## Design (Impeccable)

<!-- Obrigatório se Impeccable = B, C ou D. Omitir inteiro se A. -->

Âncoras: `PRODUCT.md` / `DESIGN.md` (register <product|brand>) · tema `data-theme='campaign'` (ou tokens do site público).

Na implementação (`work-issue`): <shape → craft → critique → polish | craft compacto → critique → polish | shape compacto (ref) → craft → …>. Declarar `harden`/`optimize` só se o Passo 8 do implement acionar gatilho (não pipeline fixo).

Brief compacto (obrigatório em C; se B ambíguo):

- **Persona / contexto:** <quem, onde, estado de espírito>
- **Job principal:** <uma frase>
- **Estratégia de cor:** Restrained (default) | <exceção justificada>
- **Edit where you see** (só `/campanha` staff, UI B/C/D): <sim — affordance no contexto + actions existentes | não — só leitura / `/editar` justificado> — princípio 3 de `PRODUCT.md`; rabbit hole: spreadsheet mode
- **Anti-goals:** <o que esta superfície não deve ser>

### Wireframe (texto)

<!-- Opcional no plano durável; obrigatório no plano de implementação (skill work-issue)
     quando B/C/D posiciona blocos. Caixas ASCII + rótulos pt-BR; sem cores/pixels.
     Omitir se só copy/controle isolado ou se "seguir design-ref à risca" sem adaptação. -->

\```text
┌─ <rota ou superfície> ───────────────────────────────┐
│ <bloco / região>                                     │
│ <…>                                                  │
└──────────────────────────────────────────────────────┘
  Fora do frame: <chrome compartilhado / tabs fora do item>.
\```

### Referência visual (UX Pilot)

<!-- Só se existir design em docs/design-refs/latest/. -->

Design: [`<Nome>.png`](../design-refs/latest/<Nome>.png) · [`<Nome>.html`](../design-refs/latest/<Nome>.html)

![<alt em pt-BR>](../design-refs/latest/<Nome>.png)

Como usar:

- **Adotar a estrutura:** <o que do design corresponde aos objetivos deste plano>.
- **Fora deste plano:** <partes do design que pertencem a outros planos, com links>.
- **Ajustar cores e código:** o HTML/PNG usa a paleta antiga (vermelho escuro `#8E0E23`, navy `#1B2B4B`, dourado `#C8874B`) e Tailwind via CDN. Implementar com os componentes shadcn existentes (`src/components/ui`) e os tokens do tema `data-theme='campaign'` (`src/app/(frontend)/styles.css`): fundo branco, primário `#C51414`, superfícies neutras claras.

<!-- Se o item nasce de critique: cite `.impeccable/critique/<snapshot>.md` aqui; não rode critique novo neste fluxo. -->

## Dados → decisão → apresentação

<!-- Obrigatório em todo plano (também na classe A). Sem métrica/mapa/série/ranking nesta entrega: uma linha "Dados: N/A — <por quê>". Caso contrário as três perguntas. Ver data-presentation.md. -->

- **Vou apresentar dados?** <Não (N/A) | Sim, só aggregate para &lt;consumidor&gt; | Sim, superfície neste item>
- **Decisões desbloqueadas:** <ator + escolha; uma por bullet. Sem decisão nomeável → corte vaidade.>
- **Forma escolhida:** <degrau da escada: número+contexto | tabela/lista | série | mapa | chart | …> — **por quê.** **Rejeitado:** <chart/mapa/KPI alternativos e por quê>.
- **Profile (se Sim):** tipo / granularidade / tamanho típico / absoluto vs relativo.
- **Anti-goals de dado:** <ex.: sem % estadual absoluto; sem gauge SaaS — ou "N/A">.

## Contexto

<Estado atual do sistema (com caminhos de arquivo reais), o problema/oportunidade, e a decisão
de produto que originou o item, com data. Responde "por que isso existe".>

## Objetivos (critérios de aceite)

<!-- Cada bullet = condição testável / verificável ao fim da Issue — não wish-list.
     Incluir guardrails do item: access, migration sim/não, Consent, etc. -->

- [ ] <resultado verificável>
- [ ] <…>
- Guardrails: <access / migration / Consent / sem Neon / …>

## Boundaries (desta entrega)

<!-- Compacto. Defaults do repo não precisam de ensaio — só o que esta Issue reforça ou excepciona. -->

- **Always:** <ex.: queries com user + overrideAccess: false; pin unit do parser>
- **Ask first:** <ex.: collection nova; dependency nova; mudar URL pública>
- **Never:** <ex.: Consent por ID hardcoded; cadastro paralelo a Contact; tocar Neon>

## Decisões travadas

<!-- Só decisões caras de reverter. Formato: decisão + por quê + fonte/data + alternativas rejeitadas.
     Ver decision-quality.md. Decisão silenciosa ou sem alternativas rejeitadas é defeito.
     Decisão repo-wide além deste item → marcar "candidata a doc em docs/" (não criar ADR schema novo sem precedente).

     ANTI-PADRÃO (layout/UI): NÃO escreva "Item novo, não reabrir Bxx / Issues fechadas"
     como se isso proibisse tocar código antigo. Issue nova = tracking. Se o fix correcto
     exige reescrever o as-built de Issues fechadas (apagar bleed compensatório, mover
     ownership de padding), diga isso explicitamente aqui e autorize o work-issue a fazê-lo.
     "Não reabrir Issue no GitHub" ≠ "não mude o código daquela Issue". -->

- **<Decisão em negrito>.** <Racional e fonte com data.> **Rejeitado:** <alternativa A porque …; B porque …>.
- **i18n e naming** seguem o AGENTS.md: identificadores em inglês (<listar os principais
  nomes propostos>), strings visíveis em pt-BR.

## Questões em aberto

<!-- Formato: Opções + Recomendação. Nunca pergunta sem posição. -->

- **<Pergunta>?** **Opções:** A | B | C. **Recomendação:** <posição concreta e por quê>. <"Definir com
  produto" quando aplicável — mas nunca pergunta sem recomendação.>

## Abordagem proposta

\```mermaid
flowchart LR
<fluxo de dados/componentes da solução>
\```

Componentes:

<!-- Depth check: reusar módulos profundos existentes; não criar pass-through raso. -->

- **`<NomeDoComponente/função>`** (em `src/<caminho real>`): <responsabilidade, assinatura,
  o que reusa. Queries Payload com `user` levam `overrideAccess: false`; escrita
  multi-collection é transacional; hooks propagam `req`.>
- <um bullet por componente/arquivo novo ou alterado>
- **<Migration>**: <se houver: nome sugerido `pnpm migrate:create <nome>`, o que adiciona,
  se tem backfill. Se não houver: "Sem migration, sem collection, sem server action.">
- **Docs de framework (se couber):** <API Payload/Next/WebAuthn a verificar na implementação contra a versão em package.json — não citar blog/SO.>

## Fases verificáveis

<!-- Fatias VERTICAIS (não "toda DB → toda API → toda UI"). Quota do appetite.
     Fase 1 = tracer bullet. Cada fase: aceite + verify + files + tamanho S|M.
     Se só 1 fase óbvia, uma entrada basta. L/XL → partir ou Issue bipartida. -->

### Fase 1 — Tracer: <título curto>

- **Quota:** <ex.: ~0,3d do appetite>
- **Entrega:** <path fino ponta a ponta que prova a aposta>
- **Aceite:**
  - [ ] <condição testável>
- **Verify:** <pnpm gate:fast | pin unit/int path | check manual>
- **Files:** `src/…`, `tests/…`
- **Tamanho:** S | M

### Fase 2 — <título>

- **Quota:** …
- **Entrega:** …
- **Aceite:** …
- **Verify:** …
- **Files:** …
- **Tamanho:** S | M

### Checkpoint (se >2 fases)

- [ ] Aceites das fases 1–N verdes; sistema compilável; seguir ou cortar rabbit hole X.

## Dependências

- <Itens do roadmap dos quais depende (duras e suaves, identificadas) — ou "Nenhuma de
  outro plano." + o que reusa do código existente, com caminhos.>

## Não escopo

- <Cada exclusão explícita, citando o plano/item do roadmap para onde ela vai.>

## Rabbit holes

<!-- Armadilhas de escopo se tocadas "de passagem" — distinto de Não escopo. -->

- **<Risco>.** Se alguém “só completar”: <explosão>. **Mitigação neste item:** <corte / boundary / defer+gatilho>.

## Adiado com gatilho

<!-- Opcional. Barato demais para o appetite agora, mas com evidência que reabre. -->

- **<O quê>.** Revisitar quando: <evidência concreta — ex. 3º call site, QPS, item B3 entregue>.

## Referências

- GitHub Issue #<N> (spec + frontmatter `id/depends/serializes/priority/model`)
- <arquivos-fonte reais que o implementador vai abrir, um por bullet, com o porquê>
- AGENTS.md — <quais convenções se aplicam: Campaign auth, naming, overrideAccess, etc.>
- <!-- Se B/C/D: --> `PRODUCT.md` / `DESIGN.md` — <o que deste item herda do Field Desk / register>
````

Notas:

- No bloco mermaid acima, remover as barras invertidas dos fences internos (`\``` → ` ``` `).
- Nível de detalhe alvo: ~100–160 linhas (Premissas + Fases acrescentam estrutura, não prosa). Menos que ~80 costuma significar que o Passo 3 (exploração do código) foi pulado.
- Classe **A**: omita a seção "Design (Impeccable)" e use no cabeçalho `Impeccable: A — N/A (sem superfície UI)`.
- Seção **Dados → decisão → apresentação** é sempre presente (preenchida ou `Dados: N/A`); não omita.
- Seções **Premissas**, **Objetivos (critérios de aceite)**, **Boundaries**, **Fases verificáveis** são sempre presentes. Chore trivial: Premissas 1 linha, Boundaries defaults, Fases = 1 entrada.
- Não rode `/impeccable craft|critique|polish` ao criar o plano — só classifique e semeie; a skill `work-issue` executa o ciclo.
- Self-score de qualidade de decisão (0–5) antes de gravar: ver [decision-quality.md](decision-quality.md). Se Dados ≠ N/A, self-check em [data-presentation.md](data-presentation.md) (≥3/5). Se Rabbit holes ou Adiado com gatilho estiverem vazios de propósito, escreva `Nenhum neste item.` — não omita a seção.
