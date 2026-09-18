# Skill de geração de reels: captura + composição do vídeo

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1155
Priority: P2
Impeccable: C — fluxo novo (skill de geração + template visual do reel); não é UI de app, mas a superfície gráfica do vídeo é o produto
Design UI: docs/plans/reels-tutoriais-ui-design.html (a produzir pelo `designer`) + assets
Appetite: ~3–4 dias eng; um outcome verificável — `/reels-tutoriais cards` entrega um MP4 publicável
Responsável: —

## Intenção

O mandato precisa de Reels ensinando funcionalidades do site — o primeiro sobre os cards de apoio (`jorgesolla1313.com.br/#cards`). Este item cria o motor de vídeo da skill: a partir de um shot list (fonte única da verdade), a skill dirige o site real em emulação de celular, captura o fluxo e compõe um MP4 vertical 1080×1920 com legenda queimada, zoom suave nos cliques, cursor sintético, marca da campanha e área segura do Instagram. Renderizado, mostra o resultado e abre o gate: aprovar (o pacote segue para a biblioteca privada, via C195) ou pedir ajustes em linguagem natural — a skill edita o shot list e regenera, sem editar o arquivo renderizado. O vídeo sozinho já ajuda; narração vem depois (C197). Nada é publicado em rede social por este item.

## Persona e fluxo

- **Persona / contexto:** operador de comunicação da campanha, não-técnico, que precisa de vídeos curtos e publicáveis ensinando o site, sem editor de vídeo e sem terceiros.
- **Job principal:** numa invocação, obter um reel vertical publicável do tutorial de uma funcionalidade do site, e poder ajustá-lo conversando.
- **Fluxo desejado:** `/reels-tutoriais cards` → skill lê/escreve o shot list → dirige o site real em viewport de celular → captura cenas + log de cliques → compõe o MP4 → mostra `reel.mp4` + `capa.png` → gate: publicar na biblioteca (C195) ou ajustar em linguagem natural → ajuste edita o shot list e regenera.
- **Anti-goals de produto:** não é editor de vídeo; não publica em rede social; não edita o render (só o shot list); não cobre todas as funcionalidades do site de uma vez; não persiste PII de terceiros nas fixtures.

### Esboço de fluxo (C)

```text
/reels-tutoriais cards
  └─ shot list (cenas, textos, passos) ── fonte única da verdade
       └─ automação mobile dirige o site real
            └─ captura do fluxo + log de cliques (zoom/cursor)
                 └─ composição 1080×1920, 30fps, H.264
                      └─ legenda queimada + marca + área segura
                           └─ mostra reel.mp4 + capa.png
                                ├─ aprovar → pacote à biblioteca privada (C195)
                                └─ ajustar (linguagem natural)
                                     └─ edita shot list → regenera ─┘
```

### Design UI (C)

- Design UI (gate): `docs/plans/reels-tutoriais-ui-design.html`
- A superfície gráfica do vídeo (template de legenda, cursor, zoom, capa) é o produto: o `designer` entrega o hi-fi antes da implementação, com a paleta do `DESIGN.md` §2 e a tipografia Brexter.

## Objetivo e aceite

- Um humano não-técnico roda `/reels-tutoriais cards` e recebe um pacote com MP4 vertical publicável.
- MP4 1080×1920, 30fps, H.264/AAC, ≤3min (alvo 15–60s), legenda queimada legível no mudo.
- Área segura respeitada (miolo útil ~1080×1420); nada crítico sob o topo (~14%), a base (~35%) ou as laterais (~6%).
- Zoom/câmera suave nos cliques, cursor sintético visível, marca da campanha presente.
- Capa `capa.png` sobrevive ao recorte central ~1080×1350 (feed 4:5 e grade do perfil).
- Gate: aprovar → pacote à biblioteca privada; ajustar → shot list editado + novo render; nada é publicado no Instagram.
- Pacote: `reel.mp4` (sem áudio, primário) + `capa.png` + `metadata.json` (com o hash do shot list); artefatos gitignored.
- Fixtures do primeiro reel (nome e foto de exemplo) são fictícias e versionadas; zero PII de terceiros.

## Dados (intenção)

- **Vou apresentar dados?** Não — esta entrega é vídeo, não análise; sem gráficos nem métricas.
- **Decisões desbloqueadas:** a comunicação decide o que entra no reel e o que muda no ajuste; a coordenação decide quando o tutorial vira peça pública.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: legenda legível no mudo, área segura do Instagram, determinismo do render.

## Dados da decisão (literais)

- Skill `.agents/skills/reels-tutoriais/SKILL.md`; command `.opencode/commands/reels-tutoriais.md`; subagente conforme necessidade. Invocação `/reels-tutoriais cards`.
- Saída MP4 1080×1920, 30fps, H.264/AAC, ≤3min (alvo 15–60s), miolo útil ~1080×1420, legenda queimada (a maioria assiste no mudo), capa que sobrevive ao ~1080×1350.
- Shot list é a fonte única da verdade; ajuste = editar o shot list e regenerar; o MP4 é build determinístico e re-executável.
- Gate: aprovar (biblioteca) ou ajustes; nada sobe sem aprovação; nada é publicado no Instagram.
- Primeiro reel: funcionalidade `cards` (`#cards`). Pacote: `reel.mp4` (sem áudio) + `capa.png` + `metadata.json`; narração fica para o C197.
- Artefatos gitignored (`.mp4` não é coberto hoje — bloco próprio, ex.: `/data/reels/` e `/docs/research/reels/`).

## Direção no codebase (hipótese)

- **Molde de skill:** `.agents/skills/dossie-solla-cidade/SKILL.md` + command fino em `.opencode/commands/` + subagente em `.opencode/agent/`; pinagem em `tests/unit/opencodeCommands.unit.spec.ts` e `opencodeAgents.unit.spec.ts`.
- **Captura:** `chromium` do `@playwright/test` já usado em `scripts/build-dossie-solla-cidade.mjs`/`build-city-report.mjs`, mas navegando o site real em emulação mobile (precedente iOS em `tests/e2e/campaignIosInputZoom.e2e.spec.ts:23-27`); técnica recomendada pela literatura: gravar com o `recordVideo` do contexto headless (o `recordVideo.size` deve ser igual ao viewport), cursor sintético injetado (headless não desenha cursor) e zoom de câmera **em pós-processo** a partir de um log de cliques (não `transform` no DOM — apps Next com portais ignoram).
- **Âncoras do primeiro reel:** `section#cards` (`CampaignCardsSection.tsx`), `[data-card-model-tile=...]` (`CardModelGallery.tsx`) e textos do `CardComposer.tsx`; contrato e2e em `tests/e2e/frontend.e2e.spec.ts:1694-1760`.
- **Composição:** ffmpeg real é pré-requisito de ambiente (o do Playwright é stripped, sem libx264/drawtext); referência de `FFMPEG_PATH`/timeout em `src/utilities/speech/speechMediaPipeline.ts` — o pipeline do reel roda na workstation.
- **Visual:** `DESIGN.md` §2 + Brexter (precedente C191, "a superfície é o gráfico"); bloqueio de artefatos no `.gitignore` como os blocos `/data/*` existentes.
- **Risco de acoplamento:** "edite o dono, não gema um irmão" — a skill reusa os builders/utilitários locais existentes; não duplicar pipeline de render; não tocar no site público.

## Dependências

- **C195 (duro, no fim do fluxo):** a biblioteca privada é o destino do pacote aprovado; sem ele o pacote fica no disco.
- **C197 (soft):** narração/transcrição completam o pacote; este item nasce mudo.
- **ffmpeg real na workstation** (pré-requisito de ambiente, documentado).
- **`designer`:** `docs/plans/reels-tutoriais-ui-design.html` + assets.

## Fora de escopo

- Narração/voz/trilha (C197) e qualquer áudio.
- Publicação no Instagram ou em qualquer rede social.
- Funcionalidades além de `cards` (a skill é genérica; o reel de `cards` fecha o contrato).
- Editar o MP4 renderizado; ajustes passam só pelo shot list.
- Idiomas além de pt-BR.

## Rabbit holes de produto

- **Codec/bitrate perfeitos antes de um reel assistível.** **Corte neste item:** entregar o primeiro reel aprovado; refino de encoding depois.
- **Zoom via `transform` no DOM.** Apps Next com portais ignoram; quebra o alinhamento do cursor. **Corte neste item:** câmera em pós-processo dirigida por log de cliques.
- **Editar o render para "ajustar rápido".** Quebra o determinismo e o gate. **Corte neste item:** ajuste é sempre no shot list.
- **Áudio como formato primário.** A maioria assiste no mudo. **Corte neste item:** legenda queimada é o primário; voz é rascunho (C197).
- **Cobrir todas as funcionalidades do site.** **Corte neste item:** fechar UM reel de ponta a ponta primeiro.

## Questões em aberto (produto)

- **Como o humano vê/edita o shot list no gate sem virar tarefa técnica?** **Opções:** A) só linguagem natural ("hook mais curto") e a skill traduz | B) abrir o arquivo do shot list para edição direta. **Recomendação:** A no primeiro ciclo, com a skill mostrando o shot list resultante para conferência. _(assumido — validar com produto)_
- **Capa: frame do vídeo ou composição própria?** **Opções:** A) frame do vídeo | B) composição própria desenhada no template. **Recomendação:** B — a capa precisa sobreviver aos recortes 4:5 e 1:1/3:4 e carregar o título. _(assumido)_
- **Quão determinístico o render precisa ser entre máquinas?** **Opções:** A) determinístico na mesma máquina (basta para o aceite) | B) bit-a-bit entre máquinas. **Recomendação:** A — o hash do shot list identifica a versão do roteiro; reprodutibilidade bit-a-bit não é exigência de produto. _(assumido)_
- **Limite de ajustes por sessão?** **Opções:** A) sem limite formal | B) teto declarado para não virar loop. **Recomendação:** A, com a skill sempre mostrando o que mudou; o teto é conversa, não regra.

## Referências

- `.agents/skills/dossie-solla-cidade/SKILL.md`; `.opencode/commands/dossie-solla-cidade.md`; `.opencode/agent/dossie-solla-cidade.md` (molde de skill/command/subagente).
- `tests/e2e/frontend.e2e.spec.ts:1694-1760` (contrato do `#cards`); `tests/e2e/campaignIosInputZoom.e2e.spec.ts:23-27` (emulação iOS).
- `src/app/(frontend)/(home)/CampaignCardsSection.tsx`, `CardModelGallery.tsx`, `CardComposer.tsx`.
- `DESIGN.md` §2 (paleta/regras) e tipografia Brexter.
- Especificação de Reels (pesquisa 2026-09-18): 1080×1920, 30fps, H.264/AAC, <1GB; safe zone topo ~14% (~250px), base ~35%, laterais ~6%; legenda a ~1100–1250px do topo, ≤900px de largura; feed 4:5 e grade 1:1/3:4; retenção/loops/DM; watermark penalizado.
- Itens relacionados: C191 (superfície gráfica como produto), C194 (biblioteca), C195 (ingestão), C197 (narração).
- Design UI (gate): `docs/plans/reels-tutoriais-ui-design.html` + assets em `docs/plans/reels-tutoriais-ui-design-assets/`.
