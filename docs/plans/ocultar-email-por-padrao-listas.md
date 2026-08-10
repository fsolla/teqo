# Ocultar a coluna de e-mail por padrão nas listas de pessoas

Status: registrado (blocked até plano em main)
Atualizado em: 2026-08-10
Issue: #627
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe: seletor de colunas existente (B17) + defaults por lista; sem rota nova
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-30/canvases/plan-b197-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; defaults + um split de coluna (pessoas) + um encaixe (assessores)
Responsável: —

## Intenção

As listas de pessoas — pessoas, lideranças, dobradinhas, assessores e apoiadores
— mostram o e-mail como coluna sempre visível. No dia a dia da mesa o canal real
é telefone/WhatsApp; o e-mail é o dado menos consultado e ocupa largura em cinco
telas. Queremos que a coluna de e-mail **comece oculta por padrão** nessas
listas, com o usuário podendo **ligá-la manualmente** pelo seletor de colunas —
mecânica que já existe em `/campanha` (usada em Municípios, Territórios etc.).

## Persona e fluxo

- **Persona / contexto:** staff da mesa (coordenação e assessores) navegando as
  listas de pessoas para gestão diária.
- **Job principal:** ler a lista sem ruído (nome + telefone), e ter e-mail à mão
  quando precisar, sem pedir para ninguém.
- **Fluxo desejado:** abre `/campanha/liderancas` → sem coluna de e-mail → quer
  ver → abre o seletor de colunas → liga "E-mail" → a escolha fica salva naquele
  dispositivo, como já acontece hoje.
- **Anti-goals de produto:** não reordenar colunas, não redesenhar as tabelas,
  não mexer nas fichas/detalhes, não mudar o e-mail no card mobile (não há
  colunas lá).

### Esboço de fluxo (B — ver canvas)

```text
[lista de pessoas] → e-mail oculto por padrão → [seletor de colunas] → liga E-mail
→ coluna aparece e fica lembrada no dispositivo → (desliga de novo quando quiser)
```

## Objetivo e aceite

- Nas **cinco listas** (pessoas, lideranças, dobradinhas, assessores, apoiadores)
  a coluna de e-mail começa oculta para quem nunca mexeu no seletor de colunas.
- Em todas, o usuário pode **religar** o e-mail manualmente (seletor de colunas
  existente), com a escolha lembrada por dispositivo — mesma mecânica atual.
- Nas listas que já têm o seletor (lideranças, dobradinhas, pessoas, apoiadores),
  só muda o **default**; nenhuma outra coluna muda de ordem ou visibilidade.
- Na lista de assessores, o e-mail passa a ser ocultável (hoje não há seletor);
  default oculto, religável.
- Na lista de pessoas, o e-mail deixa de ficar embutido na coluna "Contato" e
  vira coluna própria, oculta por padrão — a coluna "Contato" fica só com o
  telefone. (Na ficha/mobile nada muda.)

## Dados (intenção)

Dados: N/A — nenhuma métrica; a mudança é de apresentação de colunas.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/campaignColumnVisibility.ts` (defaults por
  lista — mecanismo B17 já existente), páginas
  `src/app/(campaign)/campanha/(app)/{liderancas,dobradinhas,pessoas,apoiadores,assessores}/`
  e os componentes de lista (`src/components/campaign/{leadership,stateDeputy,people,supporter,advisor}/`).
- **Precedente a olhar:** B17 (`docs/plans/seletor-colunas-lista-municipios.md` —
  mecanismo de ocultar colunas), B28 (`email-celular-lista-liderancas.md` —
  coluna de e-mail em lideranças), B163 (dobradinhas), C100
  (`pessoas-lista-unificada.md` — coluna "Contato" com telefone+e-mail na mesma
  célula, decisão que este item reabre).
- **Risco de acoplamento:** a lista de assessores usa tabela própria (sem o
  seletor); o item deve trazer a mesma mecânica de colunas para lá — sem criar
  um segundo padrão. Mesmas páginas que o item **C112** (telefones) toca — não
  rodar em paralelo.

## Dependências

- Nenhuma dura. Serializa com **C112** (múltiplos telefones — mesmas páginas de
  lista).

## Fora de escopo

- Reordenação de colunas (por arrasto ou não).
- Redesenho das tabelas (cards mobile, larguras, densidade).
- Ocultar e-mail nas **fichas/detalhes** ou nos cards mobile — o pedido é de
  colunas de lista.
- Ocultar qualquer outra coluna (telefone, municípios etc.).

## Rabbit holes de produto

- **"Já que vamos mexer, esconder também telefone/municípios".** Escopo
  explode e mexe em leitura de gestão. **Corte neste item:** só e-mail.
- **"Redesenhar a tabela de assessores para caber no padrão".** O pedido é
  visibilidade de coluna, não refactor da superfície. **Corte:** usar a
  mecânica de ocultar/religar sem reescrever a tabela.

## Questões em aberto (produto)

- **Pessoas (C100) hoje mostra o e-mail dentro da coluna "Contato" (telefone em
  destaque, e-mail embaixo). Ocultar "a coluna de e-mail" lá = separar o e-mail
  numa coluna própria?** **Opções:** A) sim — coluna "E-mail" própria (como
  lideranças/dobradinhas), oculta por padrão; B) esconder só a linha de e-mail
  dentro da célula (fora da mecânica de colunas). **Recomendação: A** —
  consistência entre as listas; quem religa ganha coluna igual às outras.
  _(assumido — validar com produto)_
- **Apoiadores hoje não tem coluna de e-mail na lista (só na ficha).** **Opções:**
  A) adicionar a coluna "E-mail" (oculta por padrão) — completa o pedido;
  B) nada a esconder — não mexer. **Recomendação: A** — o pedido nomeia
  apoiadores; a coluna nasce oculta e quem quiser liga. _(assumido — validar
  com produto)_
- **Assessores não tem o seletor de colunas.** **Opções:** A) trazer a mesma
  mecânica B17 para a tabela de assessores (ocultar por padrão + religar);
  B) ocultar o e-mail fixo, sem como religar. **Recomendação: A** — sem religar,
  o "ativar manualmente se preferir" não existe nessa lista. _(assumido —
  validar com produto)_
- **Quem já tem escolha salva no dispositivo (cookie do seletor) continua com o
  e-mail visível?** **Recomendação: sim** — o default vale para quem nunca
  tocou no seletor; a escolha existente é respeitada (contrato atual do
  mecanismo). _(assumido — validar com produto)_

## Referências

- GitHub Issue (após registro)
- Canvas UI (gate): `plan-b197-ui-draft.canvas.tsx`
- B17 `docs/plans/seletor-colunas-lista-municipios.md` · B28 `docs/plans/email-celular-lista-liderancas.md` · C100 `docs/plans/pessoas-lista-unificada.md`
- `src/lib/campaignColumnVisibility.ts` · `src/components/campaign/advisor/AdvisorsTable.tsx`
