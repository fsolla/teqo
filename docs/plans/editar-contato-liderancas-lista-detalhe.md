# Editar nome, e-mail e celular da liderança (lista + detalhe)

Status: blocked (plano → main)
Atualizado em: 2026-08-03
Issue: #349
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe em `/campanha/liderancas` (colunas Nome / E-mail / Celular) e no bloco de contato de `/campanha/liderancas/[id]`
Canvas UI: `/Users/francisco.solla/.cursor/projects/Users-francisco-solla-cursor-worktrees-teqo-jzm9/canvases/plan-b153-ui-draft.canvas.tsx`
Appetite: ~1 dia eng; um outcome verificável (corrigir contato onde se vê, lista e ficha)
Responsável: —

## Intenção

Na lista de lideranças o staff já vê nome, e-mail e celular, mas só consegue **copiar** (B28) ou abrir a ficha — e a ficha interna **ainda não edita** esses três campos depois do create. Completar ou corrigir um telefone seedado / errado exige `/admin` ou recriar. O pedido é **edit where you see** via lápis: o valor continua legível (link / cópia); o lápis abre o input focado; ao sair do campo, grava e volta ao modo leitura.

Gatilho explícito do adiado em B28: produto pediu correção de contato sem `/admin`.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral / Assessor no desk (ou celular), varrendo a rede ou abrindo uma ficha — precisa corrigir grafia, e-mail ou celular agora.
- **Job principal:** alterar nome, e-mail ou celular da liderança no lugar onde já está olhando, e confiar que gravou — sem perder o gesto de copiar / abrir ficha.
- **Fluxo desejado:**
  1. Em `/campanha/liderancas`, cada uma das colunas **Nome**, **E-mail** e **Celular** mostra o valor + ícone de **lápis** ao lado.
  2. **Clique no valor:** comportamento de leitura atual — Nome abre a ficha (link); E-mail e Celular **copiam** (B28).
  3. **Clique no lápis:** o valor vira **input já focado**; a pessoa edita; ao **perder o foco** (blur), grava e o campo volta ao modo leitura (nome = link de novo; e-mail/celular = valor copiável de novo).
  4. Feedback no próprio controle (salvando / erro / ok); WhatsApp da linha continua quando o celular é válido.
  5. Em `/campanha/liderancas/[id]`, o mesmo gesto nos três campos do bloco Contato (hoje prosa no header).
- **Anti-goals de produto:** inputs sempre montados em toda a tabela (planilha); toggle “Editar” da tabela (padrão assessores / B19); segundo cadastro de pessoa paralelo a Contact; merge manual de fichas duplicadas neste item; líder editando a própria ficha por esta superfície.

### Esboço de fluxo (B)

```text
[lista] valor + lápis
  → clique no valor → copia (e-mail/celular) ou abre ficha (nome)
  → clique no lápis → input focado → blur → grava → volta a valor+lápis
  → (opcional) ficha → mesmo gesto no bloco Contato
```

## Objetivo e aceite

- Em `/campanha/liderancas` (staff): Nome, E-mail e Celular têm **lápis** que ativa edição in-place (input focado); blur grava e restaura o modo leitura.
- Clique no **dado** (não no lápis): Nome continua **link** para a ficha; E-mail e Celular mantêm **copy-on-click** (B28).
- Em `/campanha/liderancas/[id]` (staff): o mesmo padrão nos três campos do bloco Contato (não prosa morta no header).
- Gravação **no contexto** (sem botão “Salvar” só para esses campos); pending + erro honesto no controle; sucesso não exige sair da página.
- Ação WhatsApp na lista permanece quando há celular válido.
- Guardrails: só staff no alcance já existente; `leader` continua fora; falha fechada / mensagem clara se o celular conflitar com outra pessoa (sem UX de merge neste item).

## Dados (intenção)

- **Vou apresentar dados?** Não — affordance de **escrita** sobre Contact já persistido (hoje leitura na lista; prosa no detalhe).
- **Decisões desbloqueadas:**
  - Staff: “este telefone/e-mail/nome está errado ou vazio — corrijo já, sem `/admin`?”
  - Staff: “posso completar fichas seedadas só com nome antes de convidar / ligar?”
  - Staff: “continuo copiando o contato de um toque na varredura?”
- **Forma:** *adiada ao plano de implementação* — restrição de produto: lápis → input → blur-save; copy/link intactos no clique do valor; sem KPI de “% com telefone”.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `/campanha/liderancas` (`page.tsx` colunas), `/campanha/liderancas/[id]` (header + form interno), `components/campaign/leadership/`, actions/loaders de leadership; reusar/estender a affordance de cópia (B28) e o espírito de auto-save in-list (B32).
- **Precedente a olhar:** B28 (copy nas células — **preservar** no clique do valor); B32 (edit-where-you-see **sem** toggle Editar); B19/`AdvisorsTable` (debounce de texto — referência de gravação, **não** do toggle de tabela); ficha `LeadershipInternalForm` (hoje não toca Contact pós-create).
- **Risco de acoplamento:** Contact é join compartilhado (telefone único / locks); lista usa `CampaignTable`; não clonar a tabela cliente de assessores; leader lockdown intacto; gesto lápis vs. clique no valor precisa ser inequívoco no toque (alvo do lápis `min-h-11` / hit area clara).

## Dependências

- Nenhuma dura aberta. Soft: B28 ✓ (colunas + copy); B32 ✓ (edição in-list sem modo Editar).

## Fora de escopo

- Edição em massa / import CSV de correção.
- Merge de Contact duplicado por telefone (só mensagem de erro clara).
- Busca `q` por e-mail/telefone (ainda no adiado de B28).
- Painel de lideranças no município / rede do município v2.
- Alterar Status, municípios, orgs, dobradinhas, notas neste item (já têm caminhos).
- Superfície do `leader` (lockdown / contatos de apoiadores).

## Rabbit holes de produto

- **Inputs sempre visíveis / planilha.** Contradiz o gesto travado (lápis). **Corte:** só um campo em modo input por vez, ativado pelo lápis.
- **“Igual aos assessores” = toggle Editar da tabela.** Explode em spreadsheet mental. **Corte:** lápis por célula; sem modo de tabela.
- **Empurrar nome/e-mail/celular para o formulário longo com “Salvar”.** Mata edit-where-you-see no detalhe. **Corte:** bloco Contato com o mesmo gesto lápis → blur-save.
- **Resolver unicidade de telefone com UX de unificar fichas.** **Corte:** falha com mensagem; sem merge wizard.
- **Redesenhar a lista inteira / seletor de colunas.** Fora do pedido.

## Decisões travadas (produto)

- **Gesto único nos três campos (lista e detalhe):** valor + lápis → lápis abre input **já focado** → blur grava e volta ao modo leitura. Sem inputs sempre montados; sem toggle “Editar” da tabela.
- **Nome (lista) em leitura = link** para `/campanha/liderancas/[id]`; após blur da edição, volta a ser link.
- **E-mail e Celular em leitura = copy-on-click** (B28); clique no valor (não no lápis) continua copiando.
- **Detalhe:** bloco Contato com o mesmo gesto nos três campos; H1 pode espelhar o nome salvo; formulário interno multi-campo permanece com Salvar.

## Questões em aberto (produto)

- Nenhuma bloqueante após o gate de 2026-08-03. _(revisitar só se o toque no mobile confundir lápis vs. valor — aí aumentar hit area / espaçamento, sem mudar o modelo mental)_

## Referências

- GitHub Issue #349
- Canvas UI (gate): [`plan-b153-ui-draft.canvas.tsx`](/Users/francisco.solla/.cursor/projects/Users-francisco-solla-cursor-worktrees-teqo-jzm9/canvases/plan-b153-ui-draft.canvas.tsx)
- Adiado B28: [`docs/plans/email-celular-lista-liderancas.md`](email-celular-lista-liderancas.md)
- Lista: `src/app/(campaign)/campanha/(app)/liderancas/page.tsx`
- Detalhe: `src/app/(campaign)/campanha/(app)/liderancas/[id]/page.tsx` (header prosa) + `LeadershipInternalForm.tsx` (sem Contact)
- `PRODUCT.md` / regra `campanha-edit-where-you-see` — Edit where you see + Auto-save
