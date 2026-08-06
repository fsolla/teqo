# Editar nome, partido, e-mail e telefone na lista de dobradinhas

Status: blocked (plano → main)
Atualizado em: 2026-08-06
Issue: #391
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe em `/campanha/dobradinhas` (colunas Nome / Partido / E-mail / Telefone)
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-k5pr/canvases/plan-b163-ui-draft.canvas.tsx`
Appetite: ~1–1,5 dia eng; um outcome verificável (corrigir identidade e contato da dobradinha na própria lista)
Responsável: —

## Intenção

Na lista de dobradinhas o staff já vê **nome** (link para a ficha) e **partido**, mas não consegue corrigir grafia, partido ou contato sem ir ao formulário longo — e o **nome hoje é travado** depois do create. E-mail e telefone **ainda não aparecem** na lista (nem como dado da ficha na operação diária). O pedido é **edit where you see** na lista: corrigir nome, partido, e-mail e telefone no lugar onde se varre a rede de dobradinhas.

Gesto do **nome** (explícito): clique no **texto do nome** abre a ficha; clique na **célula** (fora do link) entra em edição do nome.

**Contexto de produto (fora desta Issue):** a mesma pessoa às vezes é assessor, liderança e dobradinha. No futuro, unificar em um Contact compartilhado entre papéis — **não entra neste item**; aqui só alinhamos para não criar um caminho que impeça essa unificação depois (Contact desde a criação; nome/e-mail/telefone no Contact).

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral / Assessor no desk, varrendo `/campanha/dobradinhas` para ligar, marcar partido ou corrigir grafia seedada — sem querer “abrir ficha → formulário → salvar” para um typo.
- **Job principal:** alterar nome, partido, e-mail ou telefone da dobradinha onde já está olhando, e confiar que gravou — sem perder o atalho de abrir a ficha pelo nome.
- **Fluxo desejado:**
  1. Em `/campanha/dobradinhas`, as colunas **Nome**, **Partido**, **E-mail** e **Telefone** mostram o valor (vazio = placeholder legível).
  2. **Nome — clique no texto:** abre a ficha canônica (`/campanha/dobradinhas/<id>`).
  3. **Nome — clique na célula** (área ao redor do link, não no texto): entra em edição in-place; ao sair (blur), grava e volta ao modo leitura com o link intacto.
  4. **Partido / E-mail / Telefone — clique na célula:** entra em edição; blur grava e volta à leitura.
  5. Ao **criar** uma dobradinha, já nasce o **Contact** da pessoa (padrão liderança: nome no Contact).
  6. Feedback no próprio controle (salvando / erro / ok); sucesso não exige sair da lista.
- **Anti-goals de produto:** planilha com inputs sempre montados; toggle “Editar” da tabela; e-mail/telefone soltos na dobradinha em paralelo a Contact; unificar Contact entre assessor / liderança / dobradinha **nesta** Issue; edição em massa; redesenhar chips de municípios / lideranças / assessores.

### Esboço de fluxo (B)

```text
[criar dobradinha] → Contact criado junto (nome no Contact)
[lista]
  Nome (Contact): texto → ficha / célula → editar
  Partido (dobradinha): célula → editar
  E-mail / Telefone (Contact): célula → editar
```

## Objetivo e aceite

- Em `/campanha/dobradinhas` (staff): dá para **editar Nome, Partido, E-mail e Telefone** na própria lista, com gravação no contexto.
- **Nome:** clique no **texto** abre a ficha; clique na **célula** (fora do texto) ativa a edição do nome.
- **Nome, e-mail e telefone** vivem no **Contact** ligado à dobradinha (padrão liderança). **Partido** continua atributo da dobradinha.
- **Create:** toda dobradinha nova já tem Contact (não “só na 1ª edição de e-mail”).
- Ficha canônica por **id**; rename não quebra o caminho. Links antigos por slug não deixam o staff no vazio _(redirect/fallback — impl)_.
- Ficha/form alinhados (some “nome imutável”; contato editável coerente com a lista).
- Guardrails: só staff no alcance já existente; `leader` fora; nome/telefone conflitantes → mensagem clara, **sem** merge / unificação de papéis neste item.

## Dados (intenção)

- **Vou apresentar dados?** Não — affordance de **escrita** sobre identidade/contato da dobradinha.
- **Decisões desbloqueadas:**
  - Staff: “o nome / partido está errado — corrijo já na lista?”
  - Staff: “preciso do e-mail/telefone desta dobradinha — cadastro/corrijo sem o form longo?”
  - Staff: “ainda abro a ficha com um clique no nome?”
- **Forma:** _adiada ao plano de implementação_ — gesto nome = texto→ficha / célula→editar; demais = célula→editar; sem KPI novo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `/campanha/dobradinhas` (lista + detalhe; segmento hoje `[slug]`), create/nova, `components/campaign/stateDeputy/`, actions/loaders; espírito B153 / `Leadership` → `contact`.
- **Precedente a olhar:** B153 ✓; `Leadership.contact` (nome no Contact); lista atual `Link` no nome + partido prosa.
- **Risco de acoplamento:** Contact compartilhado (telefone único / locks); caminho da ficha por id; **não** unificar papéis assessor/liderança/dobradinha aqui; não misturar com editor de relações nem B155+/B160.

## Dependências

- Nenhuma dura aberta. Soft: B153 ✓; B33 ✓.

## Fora de escopo

- **Unificar Contact entre assessor, liderança e dobradinha** (mesma pessoa nos três papéis) — intenção futura explícita; Issue/plano sucessores.
- Edição em massa / import de correção.
- Chips / relações (municípios, lideranças, assessores).
- Observações (`notes`) na lista.
- Superfície do `leader`.
- Merge / unificação de Contact duplicado por telefone.
- Redesign amplo da ficha além do necessário para rename + Contact + URL por id.

## Rabbit holes de produto

- **Planilha / inputs sempre visíveis.** **Corte:** um campo em input por vez.
- **Lápis obrigatório no nome.** **Corte:** gesto texto→ficha / célula→editar.
- **Unificar papéis nesta entrega.** “Já que tem Contact…” vira epic de identidade. **Corte:** Contact por dobradinha neste item; unificação multi-papel = sucessor.
- **Merge wizard.** **Corte:** falha com mensagem.
- **URL legível com o nome.** **Corte:** caminho por id.

## Decisões travadas (produto)

- **Gesto:** célula edita; no nome, o **texto** abre a ficha.
- **Escopo UI:** lista; ficha/form só alinhados.
- **Contact:** e-mail e telefone no Contact; **nome da lista = nome do Contact** (seguir padrão liderança, não nome paralelo na dobradinha).
- **Create:** Contact **na criação** da dobradinha (não sob demanda na 1ª edição de e-mail).
- **URL:** ficha canônica `/campanha/dobradinhas/<id>`; rename livre; slug-de-nome deixa de ser a chave de URL; links antigos por slug não somem sem aviso.
- **Futuro (não nesta Issue):** mesma pessoa como assessor + liderança + dobradinha via Contact unificado — só alinhamento; não expandir aceite.

## Questões em aberto (produto)

- Nenhuma bloqueante após o gate de 2026-08-05. _(unificação multi-papel → Issue sucessora quando produto pedir)_

## Referências

- GitHub Issue #391
- Canvas UI (gate): [`plan-b163-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-k5pr/canvases/plan-b163-ui-draft.canvas.tsx)
- Precedente: [`docs/plans/editar-contato-liderancas-lista-detalhe.md`](editar-contato-liderancas-lista-detalhe.md) (B153 ✓)
- Lista: `src/app/(campaign)/campanha/(app)/dobradinhas/page.tsx`
- Ficha / form: `src/app/(campaign)/campanha/(app)/dobradinhas/[slug]/` + `StateDeputyForm.tsx`
- Domínio: `src/components/campaign/stateDeputy/`, `src/app/(campaign)/campanha/actions/stateDeputy.ts`
- Convenção pessoa: `Contact` + join (ex. `Leadership.contact`) — `AGENTS.md`
