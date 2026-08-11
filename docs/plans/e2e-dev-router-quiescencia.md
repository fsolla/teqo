# OPS42: e2e dev — navegação RSC do login commita tarde e remonta o layout (interação silenciosamente perdida)

Status: registrado
Atualizado em: 2026-08-11
Issue: #691
Priority: P3
Model: composer-2.5
Appetite: ~0,5 dia eng — um helper de "quiescência do router" no fixture

## Intenção

Em dev mode (e2e local, compile a frio), a navegação RSC do login pode commitar
**~1,8 s depois** do `goto('/campanha')` do teste: o fixture resolve o
`waitForURL` no redirect otimista, o teste segue para `goto` + interação
imediata, e a payload RSC do redirect — ainda em voo — commit por cima,
**remontando o subtree do layout** (provider do chat novo, textarea novo com
`defaultValue=''`). A interação (fill + Enter) cai no textarea velho e é
silenciosamente perdida: input volta a `''`, o envio nunca dispara, o teste
estoura em `toBeVisible`. CI (prod mode) é imune — por isso main está verde.

## Persona e fluxo

- **Persona:** agente rodando e2e local em dev mode com a máquina sob carga
  (worktrees paralelos compilando).
- **Fluxo quebrado:** login → `page.goto('/campanha')` → `'Olá! Eu sou o
Sollinha'` visível → `fill` + `Enter` → nada acontece; o teste falha com o
  input vazio e "Enviar" disabled, aparentemente sem causa.
- **Fluxo desejado:** o teste só interage depois que o router estabilizou
  (nenhuma framenav/navegação RSC pendente), ou a interação sobrevive à
  remontagem.

## Objetivo e aceite

- Interagir com a página em dev mode nunca mais perde o fill/Enter para uma
  remontagem tardia do layout.
- Sem impacto em prod mode (CI) — o helper é dev-only ou inócuo em prod.
- Precedentes a seguir: `checkRadixWhenHydrated` (fixture, retry até o estado
  certo) e o hardening OPS30 (login resiliente a compile frio).

## Dados (intenção)

Dados: N/A — infraestrutura de e2e (fixture), sem servidor/banco.

## Direção no codebase (hipótese)

- **Área provável:** `tests/e2e/fixtures/campaignE2EFixtures.ts` — o `login`
  resolve no `waitForURL` (redirect otimista) antes do commit RSC; e/ou um
  helper `waitForRouterSettled(page)` chamado após `goto` nos journeys que
  interagem logo após o load (espera por uma janela de ~500 ms sem
  `framenavigated`).
- **Evidência da sessão (B199, 2026-08-11):** em dev mode sob carga, o teste
  B188 "reload na mesma aba" falhou 5/5 com esse mecanismo: `FRAMENAV
/campanha` (sem request document) ~1,0–1,9 s após o `HELLO`, textarea `ta2`
  criada com `defaultValue=''` no instante do fill, zero writes de `.value` no
  textarea (React nunca commitou o valor digitado — o estado do useChat
  resetou na remontagem do provider).
- **Risco:** esperar demais (networkidle nunca chega em dev com HMR ativo) —
  a janela de quiescência deve ser baseada em **ausência de framenav**, não em
  network idle.

## Dependências

- #586 (OPS30 — hardening e2e dev: login resiliente a compile frio) — mesma
  família de robustez; destrava sozinha quando o pai flipar `done`.

## Fora de escopo

- Consertar o comportamento do Next dev (a remontagem em si é da framework).
- O flake de `googleCalendarSync` sob carga (#686 já registra).
- Mudanças em prod mode/CI (imunes por construção).

## Rabbit holes de produto

- **Espera longa demais por teste:** multiplicar o tempo de cada spec em dev.
  **Corte:** o helper só espera a quiescência (janela sem framenav), não
  network idle; e só é chamado onde o journey interage imediatamente após o
  load.
- **Camuflar falha real:** esperar quiescência pode mascarar um problema de
  app. **Corte:** o helper tem timeout curto (fallback) e a falha original do
  app continua aparecendo no assertion seguinte.

## Questões em aberto (produto)

- Nenhuma — é infraestrutura de teste.

## Referências

- Evidência completa da sessão B199 (mensagens de debug `TMPDEBUG2–8` no
  worktree B199, 2026-08-11): `NAVREQ/FRAMENAV/LOAD` timestamps, `SET
defaultValue ta2=""`, setter de `value` nunca chamado.
- `tests/e2e/campaignSollinhaContext.e2e.spec.ts` (B188 "reload na mesma aba"
  é o teste que flakeia), `tests/e2e/fixtures/campaignE2EFixtures.ts`.
