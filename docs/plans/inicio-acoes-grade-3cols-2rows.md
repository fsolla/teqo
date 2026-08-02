# Início / FAB — grade 3 colunas × 2 linhas (corrigir orientação)

Status: registrado (blocked até plano em main)
Atualizado em: 2026-08-02
Issue: #302
Priority: P1
Model: composer-2.5
Impeccable: B — `CampaignHomeActionStrip` no Início mobile e no overlay do FAB
Appetite: ~0,5 dia eng; outcome visual verificável em viewport ~390; sem migration
Responsável: —

## Intenção

B122 (#249) entregou grade **2 colunas × 3 linhas** no Início mobile. Produto queria (e ainda quer) o inverso na leitura de uso: **2 linhas × 3 colunas** — mais baixo, 6 ações staff de uma vez.

B132 (#280) tentou essa revisão (`grid-cols-3` no strip + overlay FAB) e fechou como done/in-prod; no código de `main` a classe já é `grid-cols-3`. Na prática o usuário ainda vê a orientação errada (continua “o outro jeito”). Este item **não** reedita os planos imutáveis de #249/#280: é sucessor com aceite visual explícito.

## Persona e fluxo

- **Persona / contexto:** CG/assessor no celular no Início (e no overlay do FAB fora do Início).
- **Job principal:** ver as 6 ações staff em **duas linhas de três**, sem scroll horizontal e sem alongar demais a região de launchers.
- **Fluxo desejado:**
  1. Abre `/campanha` no mobile → conta **3 botões por linha, 2 linhas**.
  2. Fora do Início, abre o FAB → a mesma orientação de grade.
  3. `md+` no Início continua strip horizontal (inalterado).
- **Anti-goals de produto:** voltar à strip com pan no mobile; redesenhar ícones/catálogo; reabrir polish de altura/busca do B132 salvo se forem o que quebra a grade.

### Esboço de fluxo (B)

```text
[Início mobile]
  [A1] [A2] [A3]
  [A4] [A5] [A6]     ← 3 colunas × 2 linhas

[≠ Início → FAB]
  mesma grade 3×2
```

## Objetivo e aceite

- Início **&lt; md**: ações staff em grade **3 colunas × 2 linhas** (verificável em screenshot / e2e viewport ~390 — não só unit de className).
- Overlay do FAB: **mesma** orientação (3×2), sem strip scroll de ações.
- Se o source já declara `grid-cols-3` e a UI ainda mostra 2×3: descobrir e corrigir a causa real (CSS override, largura do botão, deploy/PWA stale, superfície errada) — o aceite é o que o usuário **vê**.
- Liderança (poucas ações) não inventa layout paralelo.
- Sem migration / Consent / mudança de catálogo.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — chrome de launcher
- **Forma:** _adiada_ — N/A

Dados: N/A — atalho visual.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `CampaignHomeActionStrip` / `CampaignHomeActionButton`, `CampaignHomeActions`, `CampaignQuickActionsOverlay`; e2e/smoke que assertam geometria/orientação, não só `className`.
- **Precedente a olhar:** B122 `docs/plans/inicio-acoes-grid-2x3-mobile.md` (entregou 2×3 — **errado** para a intenção atual); B132 `docs/plans/acoes-rapidas-grade-3x2-fab-overlay.md` (intenção correta; entrega insuficiente na prática).
- **Risco de acoplamento:** não reabrir snap/peek; não mudar registry de ações; `md+` strip permanece.

## Dependências

- Soft: B122 (#249) e B132 (#280) já em prod — este item corrige o gap residual de orientação.

## Fora de escopo

- Reeditar planos/Issues #249 ou #280 (imutáveis).
- Novas ações, labels, thumb-zone order.
- Redesign do círculo/ícone além do necessário para caber 3 colunas.

## Rabbit holes de produto

- **“Refazer o Início inteiro.”** **Corte:** só orientação da grade + causa se o CSS já estiver certo.
- **Tablet 3×2 em `md`.** **Corte:** fora; `md+` = strip.

## Questões em aberto (produto)

- **Onde ainda aparece 2×3?** **Opções:** A) só Início | B) só FAB | C) ambos. **Recomendação:** **C** até evidência contrária — mesmo dono visual. _(assumido)_

## Referências

- GitHub Issue #302
- GitHub Issue #249 (B122 — plano/entrega 2 cols × 3 rows)
- GitHub Issue #280 (B132 — intenção 3×2; done/in-prod)
- `src/components/campaign/dashboard/CampaignHomeActionStrip.tsx`
- `src/components/campaign/shell/CampaignQuickActionsOverlay.tsx`
