# Template de plano (`docs/plans/<slug>.md`)

Estrutura extraída dos planos existentes (`overview-lista-nucleos.md`, `visitados-recentemente.md`, etc.). Manter as seções nesta ordem; omitir "Design (Impeccable)" apenas na classe **A** (só backend); omitir a subseção "Referência visual (UX Pilot)" quando não houver design-ref.

Filtros de decisão (caro vs barato, appetite, rabbit holes, depth): [decision-quality.md](decision-quality.md).

````markdown
# <Título do item em pt-BR>

Status: rascunho
Atualizado em: <YYYY-MM-DD>
Item do roadmap: [docs/roadmap.md](../roadmap.md) (<seção e/ou ID, ex.: "Trilha C, item C6">)
Impeccable: <A | B | C | D> — <uma linha: N/A sem UI | encaixe em tela X | UI nova em rota Y | ref Nome.png>
Appetite: <ex.: ~1–2 dias eng; migration + 1 action + encaixe em lista existente>
Responsável: —

## Design (Impeccable)

<!-- Obrigatório se Impeccable = B, C ou D. Omitir inteiro se A. -->

Âncoras: `PRODUCT.md` / `DESIGN.md` (register <product|brand>) · tema `data-theme='campaign'` (ou tokens do site público).

Na implementação (`implement-roadmap-item`): <shape → craft → critique → polish | craft compacto → critique → polish | shape compacto (ref) → craft → …>.

Brief compacto (obrigatório em C; se B ambíguo):

- **Persona / contexto:** <quem, onde, estado de espírito>
- **Job principal:** <uma frase>
- **Estratégia de cor:** Restrained (default) | <exceção justificada>
- **Edit where you see** (só `/campanha` staff, UI B/C/D): <sim — affordance no contexto + actions existentes | não — só leitura / `/editar` justificado> — princípio 3 de `PRODUCT.md`; rabbit hole: spreadsheet mode
- **Anti-goals:** <o que esta superfície não deve ser>

### Referência visual (UX Pilot)

<!-- Só se existir design em docs/design-refs/latest/. -->

Design: [`<Nome>.png`](../design-refs/latest/<Nome>.png) · [`<Nome>.html`](../design-refs/latest/<Nome>.html)

![<alt em pt-BR>](../design-refs/latest/<Nome>.png)

Como usar:

- **Adotar a estrutura:** <o que do design corresponde aos objetivos deste plano>.
- **Fora deste plano:** <partes do design que pertencem a outros planos, com links>.
- **Ajustar cores e código:** o HTML/PNG usa a paleta antiga (vermelho escuro `#8E0E23`, navy `#1B2B4B`, dourado `#C8874B`) e Tailwind via CDN. Implementar com os componentes shadcn existentes (`src/components/ui`) e os tokens do tema `data-theme='campaign'` (`src/app/(frontend)/styles.css`): fundo branco, primário `#C51414`, superfícies neutras claras.

<!-- Se o item nasce de critique: cite `.impeccable/critique/<snapshot>.md` aqui; não rode critique novo neste fluxo. -->

## Contexto

<Estado atual do sistema (com caminhos de arquivo reais), o problema/oportunidade, e a decisão
de produto que originou o item, com data. Responde "por que isso existe".>

## Objetivos

- <Resultados verificáveis, um por bullet. Incluir os "guardrails" que valem para o item
  inteiro: access control, sem migration / com migration, sem Consent / qual Consent, etc.>

## Decisões travadas

<!-- Só decisões caras de reverter. Formato: decisão + por quê + fonte/data + alternativas rejeitadas.
     Ver decision-quality.md. Decisão silenciosa ou sem alternativas rejeitadas é defeito. -->

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

- `docs/roadmap.md` (<seção/linhas>)
- <arquivos-fonte reais que o implementador vai abrir, um por bullet, com o porquê>
- AGENTS.md — <quais convenções se aplicam: Campaign auth, naming, overrideAccess, etc.>
- <!-- Se B/C/D: --> `PRODUCT.md` / `DESIGN.md` — <o que deste item herda do Field Desk / register>
````

Notas:

- No bloco mermaid acima, remover as barras invertidas dos fences internos (`\``` → ` ``` `).
- Nível de detalhe alvo: ~100–130 linhas, como os planos existentes. Menos que isso costuma significar que o Passo 3 (exploração do código) foi pulado.
- Classe **A**: omita a seção "Design (Impeccable)" e use no cabeçalho `Impeccable: A — N/A (sem superfície UI)`.
- Não rode `/impeccable craft|critique|polish` ao criar o plano — só classifique e semeie; a skill `implement-roadmap-item` executa o ciclo.
- Self-score de qualidade de decisão (0–5) antes de gravar: ver [decision-quality.md](decision-quality.md). Se Rabbit holes ou Adiado com gatilho estiverem vazios de propósito, escreva `Nenhum neste item.` — não omita a seção.
