# B193 — Card de município mobile: composição densa + edit-where-you-see + última atualização expandível

Status: registrado
Atualizado em: 2026-08-10
Issue: #542
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: C — redesenho do card mobile da lista de municípios (composição nova na tela existente)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-19/canvases/plan-b193-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; recomposição de card + fiação de affordances sobre sheets que já existem
Responsável: —

## Intenção

No celular, o card de município de `/campanha/municipios` é um grid de labels ("Classe",
"Cobertura", "Votos estimados", "Nível", "Tendência", "Última atualização", "Assessores",
"Lideranças", "Dobradinhas") dentro de uma moldura — alto, difuso, e com cada dado numa linha
rotulada. O assessor em campo varre dezenas de municípios: quer um card **denso** onde a leitura
da conjuntura (posição de voto, cenários de votos, classe, tendência, nível, pessoas) cabe
numa olhada, e onde tocar no que está vendo já edita (edit-where-you-see), sem procurar
label nenhum. Wireframe do usuário (Penpot, 2026-08-10): composição nova, tokens livres.

## Persona e fluxo

- **Persona / contexto:** assessor (e coordenador) no celular, em campo ou entre visitas, varrendo a fila de municípios; uma mão, atenção curta.
- **Job principal:** ler a conjuntura do município numa olhada e ajustar cenários, nível e pessoas sem sair do card.
- **Fluxo desejado:**
  1. Vê o card denso: nome + território com **posição de voto 2022 à direita em duas linhas** (percentual em cima; colocação · votos discretos embaixo, alinhados à direita); **barra de votos estimados** com os três cenários (pessimista · central · otimista) e marcador da posição do cenário ativo; linha de **chips** (classe territorial; tendência e nível com **label à esquerda do valor**); três **pilhas de avatares** (assessores, lideranças, dobradinhas — um avatar por entidade, quebrando linha conforme o espaço); rodapé "Última atualização há X dias" + chevron; município prioritário com **borda lateral direita** na cor de destaque do app (~6px).
  2. Toca na barra ou nos números de cenário → bottom sheet de votos estimados (os três cenários).
  3. Toca no chip/label de Nível → bottom sheet de nível.
  4. Toca nos avatares/label de Assessores, Lideranças ou Dobradinhas → bottom sheet de cada associação.
  5. Toca em "Última atualização há X" (texto ou seta) → o limite inferior do card expande e revela o **último card de atualização** do município + caminho para registrar nova (CTA abre a sheet existente).
  6. **Toque que atravessa** (qualquer outra área do card, fora dos alvos de edição) → abre a página de detalhes do município.
- **Anti-goals de produto:** não virar redesenho do desktop; não recriar editors que já existem em variante sheet (votos em 3 cenários, nível, tendência, assessores, lideranças, dobradinhas); não adicionar dado novo ao card; não mudar permissões de acesso; não fazer da expansão um feed completo.

### Esboço de fluxo (C)

```text
[card denso] → toca barra/números → sheet votos (3 cenários) → salva → barra reflete
[card denso] → toca chip Nível → sheet nível (motivo opcional) → chip atualiza
[card denso] → toca avatares/label (Assessores|Lideranças|Dobradinhas) → sheet associação
[card denso] → toca "Última atualização há X" → card expande → último card de atualização
```

## Objetivo e aceite

- No mobile (`md:hidden`), o card de município mostra, na ordem do wireframe: cabeçalho (nome + território/Zona; posição de voto 2022 à direita em duas linhas — percentual em cima, colocação · votos discretos embaixo, alinhados à direita), barra de votos estimados com os três cenários + marcador do cenário ativo, chips de classe/tendência/nível (tendência e nível com label à esquerda do valor), pilhas de avatares de assessores/lideranças/dobradinhas, e rodapé de última atualização com chevron.
- Avatares: **um avatar por entidade associada**, sem capar em três; os avatares quebram linha e se ajustam ao espaço disponível.
- Tocar na barra ou em qualquer número de cenário abre a edição de votos estimados; tocar no chip/label de nível abre a edição de nível; tocar nas labels/avatares de assessores, lideranças ou dobradinhas abre a edição de cada associação (todas em bottom sheet, edit-where-you-see).
- O chip de classe territorial mostra **só o rótulo** ("Reduto"); a razão fica acessível via tooltip/sheet, sem linha extra no card (decisão de produto 2026-08-10 — flexiona a regra B13 para este card).
- Tocar em "Última atualização há X" (texto **ou** seta) expande o limite inferior do card e revela o último card de atualização do município **sem moldura/bordas nem diferenciação de superfície** (mesmo fundo do card) + CTA "Registrar atualização" abrindo a sheet existente.
- **Sem nenhuma atualização registrada:** o rodapé vira **CTA direto de registrar** nova atualização (sem chevron, sem expansão).
- **Toque atravessado** (tocar no card fora de qualquer alvo de edição) abre a página de detalhes do município; os alvos de edição interceptam o toque.
- Município prioritário: **borda lateral direita** na cor de destaque do app, ~6px de largura (substitui o indicador de prioridade atual).
- Estimativas de votos seguem staff-only (assimetria intacta: liderança não vê cenários nem os vê na lista).
- Salvador (linha agregada) mantém o comportamento atual: sem campos editáveis, sem barra quando não houver dado.
- Desktop da lista inalterado; demais listas `/campanha` inalteradas.
- Aparência usa tokens/padrões do app (o wireframe fixa composição e densidade, não cores/tipografia).

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — mas **reapresentação** de dados que o card já mostra (posição de voto 2022, cenários de votos estimados, classe territorial, frescor do último sinal), em composição nova.
- **Decisões desbloqueadas:** staff decide "este município merece atenção agora?" numa olhada, e ajusta cenários/nível/pessoas no lugar. A barra mostra **onde** a estimativa atual está no intervalo pessimista→otimista.
- **Forma:** adiada ao plano de implementação; restrições de produto: sem % estadual absoluto; a classe territorial nunca aparece sem a razão acessível (política B13).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/municipality/MunicipalityListMobileCards.tsx` (card atual, grid de labels), `MunicipalityListMobileSection.tsx` (host do sheet compartilhado), `src/components/campaign/municipality/` (controles com variante `sheet` já existentes: votos estimados em 3 cenários, nível, tendência, assessores, lideranças, dobradinhas), `MunicipalityAdvisorAvatarStack.tsx` (padrão de pilha de avatares), faixa de cenários em `src/components/campaign/votePledge/` (marcador de cenário ativo já existe), card de atualização do feed em `MunicipalityUpdateFeed.tsx` / `CampaignUpdatesFeed.tsx` (C89/C106/C107).
- **Precedente a olhar:** `polimento-mobile-lista-municipios.md` (B42, entregue — cards mobile com sheets), `municipios-mobile-sem-moldura.md` (B184, em andamento — moldura do card), planos `municipio-v2-*` (detalhe, não a lista).
- **Risco de acoplamento:** a fiação de sheets apoia no host compartilhado de bottom sheet da lista (hoje com defect conhecido — ver Dependências); assimetria staff/leader e regra B13 são guardrails.

## Dependências

- **B184** (#514, in-progress) — moldura do card (edge-to-edge, separador de linha); o wireframe já assume esse frame. Suave: se B184 não tiver mergeado, este item carrega a moldura junto.
- **C109** (#540, blocked) — bottom sheet de edição rápida da lista quebra ao abrir; este item re-fia as mesmas sheets. **Dependência confirmada no gate:** C109 resolvido antes; o plano faltante do C109 é débito do fluxo de agentes (file-miss) a corrigir à parte.

## Fora de escopo

- Redesenho do desktop ou de outras listas (territórios, dobrafinhas, etc.) — itens próprios.
- Dado novo no card (ex.: meta da conta da cadeira na barra) — sem pedido; o wireframe mostra só os três cenários + marcador.
- Feed completo de atualizações na lista — a expansão mostra o **último** card (feed é `/campanha/atualizacoes`, C89).
- Edição de tendência fora da sheet existente; mudança de permissões/access.

## Rabbit holes de produto

- **Recriar editors.** A lista já tem variantes `sheet` de todos os alvos de edição (votos em 3 cenários, nível, tendência, assessores, lideranças, dobradinhas) e um host de sheet compartilhado. **Corte:** reaproveitar a edição existente; este item muda a superfície do card e a fiação dos alvos, não o editor.
- **Card virar miniatura do detalhe.** Copiar blocos da página v2 para a lista. **Corte:** só o que o wireframe lista; o resto mora no detalhe.
- **Expansão vira feed.** Mostrar todas as atualizações dentro do card. **Corte:** só o último card + um caminho para registrar/ver todas.

## Questões em aberto (produto)

Fechadas no gate (2026-08-10):

- **C109 como dependência** — B193 depende do C109; o plano faltante do C109 é débito do fluxo de agentes (file-miss) a corrigir à parte.
- **Chip de classe sem razão no card** — só o rótulo; razão via tooltip/sheet (flexiona B13 para este card).
- **Expansão inclui CTA "Registrar avaliação"** abrindo a sheet existente.
- **Sem atualização → CTA direto de registrar** (sem chevron/expansão).
- **Vocabulário "Última atualização"** (C87) — "avaliação" foi engano do wireframe.
- **Toque atravessado abre o detalhe** do município; **prioridade = borda lateral direita ~6px** na cor de destaque.

## Referências

- Wireframe do usuário (Penpot, mobile, 2026-08-10) — composição do card, posicionamento relativo, densidade
- Canvas UI (gate): /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-19/canvases/plan-b193-ui-draft.canvas.tsx
- `src/components/campaign/municipality/MunicipalityListMobileCards.tsx` — card atual (grid de labels)
- `MunicipalityListMobileSection.tsx` + `src/components/campaign/shared/CampaignListSheetHost.tsx` — host do sheet compartilhado
- Controles `variant="sheet"` já existentes: votos estimados (3 cenários), nível, tendência, assessores, lideranças, dobradinhas
- `src/components/campaign/votePledge/VoteEstimateScenarioStrip.tsx` — faixa com marcador do cenário ativo (padrão da barra do wireframe)
- `src/components/campaign/municipality/MunicipalityAdvisorAvatarStack.tsx` — padrão de pilha de avatares
- `MunicipalityUpdateFeed.tsx` / `CampaignUpdatesFeed.tsx` — card de atualização (C89) para a expansão
- `docs/plans/polimento-mobile-lista-municipios.md` (B42) e `docs/plans/municipios-mobile-sem-moldura.md` (B184)
- `AGENTS.md` — "Campaign Municípios model" (assimetria declarado/estimado, E14 nível, B13 leitura de classe)
