# Múltiplos telefones por pessoa

Status: registrado (blocked até plano em main)
Atualizado em: 2026-08-10
Issue: #626
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe: formulários de criação/edição de pessoa + ficha (detalhe) + listas existentes
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-30/canvases/plan-c112-ui-draft.canvas.tsx
Appetite: ~1–2 dias eng; encaixe no modelo de pessoa existente
Responsável: —

## Intenção

Uma pessoa pode ter mais de um celular — o pessoal e o do comitê, o número que
troca e o antigo que ainda recebe WhatsApp. Hoje a ficha aceita um único número
e a mesa tem de escolher qual guardar. Queremos cadastrar **N telefones por
pessoa**, com as listas continuando compactas (mostram o principal) e a ficha
mostrando todos. Pré-requisito: telefones deixam de ser únicos (item **C111**).

## Persona e fluxo

- **Persona / contexto:** staff da mesa (coordenação e assessores) editando a
  ficha de uma pessoa — liderança, apoiador, dobradinha, assessor, pessoa.
- **Job principal:** registrar todos os números de contato de uma pessoa, sem
  perder informação e sem poluir as listas.
- **Fluxo desejado:** abre a ficha da liderança → vê os dois telefones dela →
  adiciona um terceiro → salva → a lista mostra o principal; a ficha mostra
  todos; WhatsApp e convite usam o principal.
- **Anti-goals de produto:** não é CRUD de agenda telefônica (sem rótulos
  "casa/trabalho", sem tipo fixo/móvel, sem reordenação por arrasto); o import
  CSV continua com uma coluna de telefone (mapeia no principal).

### Esboço de fluxo (B — ver canvas)

```text
[ficha da pessoa] → vê telefones (principal primeiro) → "+ Adicionar telefone"
→ salva → lista: mostra o principal · ficha: mostra todos · WhatsApp/convite: principal
```

## Objetivo e aceite

- Uma pessoa pode ter **2+ telefones** cadastrados e editáveis nas cinco
  superfícies de pessoa: ficha/detalhe, criação/edição de liderança, apoiador,
  dobradinha e assessor.
- As listas de pessoas continuam mostrando **um** telefone por linha (o
  principal); a ficha mostra todos.
- WhatsApp (`wa.me`), convite e o import CSV usam o **principal** (o import só
  tem uma coluna).
- A busca por telefone encontra a pessoa por **qualquer** um dos números.
- Guardrail: os telefones continuam **não únicos** entre pessoas (C111) — duas
  pessoas podem compartilhar um número, e cada uma mantém seus demais números.

## Dados (intenção)

Dados: N/A — nenhuma métrica; a mudança é de cadastro e exibição de contato.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/Contact.ts` (campo de telefones),
  formulários de pessoa (`src/app/(campaign)/campanha/(app)/{liderancas,apoiadores,dobradinhas,assessores,pessoas}/`),
  fichas/detalhes, view models das listas (`src/utilities/*ViewModels`),
  `src/app/(campaign)/campanha/actions/…` (escrita), import CSV
  (`supporterImport`), `src/lib/phone.ts` (normalização).
- **Precedente a olhar:** C99/C100 (ficha `Contact` como identidade), B163
  (edição inline de contato em dobradinhas), C6 (import de apoiadores),
  C111 (telefone não único — dependência).
- **Risco de acoplamento:** o telefone é chave em fluxos automáticos (import,
  convite, login de liderança) — o "principal" precisa ser estável para não
  mudar de número a cada edição; e a mudança toca as mesmas páginas de lista do
  item **B197** (colunas) — não rodar em paralelo.

## Dependências

- **C111** (telefone não único) — dura: múltiplos telefones pressupõem que
  números compartilhados entre pessoas são permitidos.
- Serializa com **B197** (mesmas páginas de lista).

## Fora de escopo

- Rótulos de telefone (casa/trabalho/whatsapp) e tipo (fixo/móvel) — sem label.
- Reordenação visual por arrasto; "definir principal" por controle explícito
  (a ordem da lista é a prioridade).
- Múltiplos telefones no import CSV (a planilha continua com uma coluna).
- Trocar a chave de login da liderança (continua o principal).

## Rabbit holes de produto

- **"Telefone com rótulo + tipo + principal explícito".** Vira CRUD de agenda
  telefônica com controle extra em todo form. **Corte neste item:** ordem =
  prioridade, sem labels, um input repetível.
- **"Mostrar todos os telefones nas listas".** Polui a linha e fura o pedido
  implícito de lista compacta. **Corte:** lista mostra o principal; a ficha é o
  lugar de todos.

## Questões em aberto (produto)

- **O que define o telefone "principal"?** **Opções:** A) o primeiro da lista —
  ordem = prioridade, sem controle extra na UI; B) flag explícita "principal"
  com controle dedicado. **Recomendação: A** — menos UI, e trocar o principal é
  editar a ordem; se a mesa pedir reordenação, vira item futuro. _(assumido —
  validar com produto)_
- **Onde se adiciona telefone?** **Opções:** A) nos formulários de
  criação/edição ("+ Adicionar telefone", repetível) e na ficha; B) só na ficha.
  **Recomendação: A** — quem cria a pessoa já informa os números que tem; sem
  volta à ficha para completar. _(assumido — validar com produto)_
- **Telefones com número repetido na MESMA pessoa (dedupe interno)?**
  **Opções:** A) impede salvar o mesmo número duas vezes na mesma ficha; B)
  permite (deixar para a mesa limpar). **Recomendação: A** — custo baixo,
  evita lista suja; o bloqueio é só dentro da própria ficha, nunca entre
  pessoas. _(assumido — validar com produto)_

## Referências

- GitHub Issue (após registro)
- Canvas UI (gate): `plan-c112-ui-draft.canvas.tsx`
- C111 `docs/plans/telefone-nao-unico.md` (dependência) · C99/C100 · B163
- `src/collections/Contact.ts` · `src/lib/phone.ts`
