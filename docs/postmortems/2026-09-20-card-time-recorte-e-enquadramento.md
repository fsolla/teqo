# Post-mortem: card "Time de você" — recorte falha em navegador endurecido e enquadramento automático encolhe a pessoa

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-20                                                                                                          |
| Severidade          | alta (funil público quebrado para o relator; enquadramento errado para todos os visitantes que usam o modelo time)  |
| Ambiente            | prod (jorgessolla1313.com.br)                                                                                       |
| Issue(s)            | sem Issue — relato do humano na sessão do worktree `fix/8` (o post-mortem é o registro, conforme a skill `bug-fix`) |
| PR do fix           | #1231                                                                                                               |
| Detectado por       | humano (relato na sessão)                                                                                           |

## Timeline

| Momento            | Data/hora                           | Evento                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Início provável    | 2026-09-18 (S15) / 2026-09-19 (S18) | Bug A (recorte): o motor S15 nunca suportou navegador sem WASM/WebGL; o caminho de erro já culpava a foto. Bug B (enquadramento): o S18 (`cde96b26`, merge 2026-09-19 ~16:52) trocou o alvo do enquadramento para a caixa do rosto (103px)                                                                                                       |
| Detecção           | 2026-09-20 (sessão `fix/8`)         | Humano relata os dois sintomas: "mesma foto funciona no computador mas no celular falha, diz que não conseguiu remover o background" e "agora posiciona sempre muito pequeno em relação aos candidatos"                                                                                                                                          |
| Diagnóstico        | 2026-09-20                          | Reproduções locais: Firefox com `webgl.disabled=true` e com `javascript.options.wasm=false` → mesmo erro de recorte; card real em prod com foto de teste → zoom 0.30–0.65 (adesivo pequeno). Fotos grandes (61MP) → `empty`. O humano confirma aparelho/navegador (Android/IronFox) e que a foto é uma versão exportada (não é o arquivo pesado) |
| Correção mergeada  | a definir (este PR)                 | —                                                                                                                                                                                                                                                                                                                                                |
| Deploy             | a definir                           | deploy começa no merge; staging automático; produção só após approve humano no environment `production`                                                                                                                                                                                                                                          |
| Verificado em prod | pendente (aguarda o humano)         | —                                                                                                                                                                                                                                                                                                                                                |

## O bug

Dois sintomas no card `Time de você`, relatados juntos pelo mesmo humano:

1. **Recorte no celular:** com a mesma foto que funciona no computador, o celular (Android, navegador **IronFox**) falhava com "Não foi possível remover o fundo desta foto. Tente de novo ou escolha outra foto." — o app tratava uma limitação do navegador como se a foto fosse o problema.
2. **Enquadramento automático:** "antes do último deploy a imagem da pessoa estava sendo ajustada automaticamente em relação aos candidatos (tamanho e posicionamento) melhor do que agora, agora está posicionando sempre muito pequeno em relação aos candidatos." Reproduzido em prod: o visitante virava um adesivo pequeno dentro da janela de 592×577, enquanto os candidatos seguem grandes (o exemplo oficial `team-card-example.jpg` tem a cabeça do visitante em ~230px).

## Causa-raiz

**Bug A — recorte (5-whys).**

1. O recorte falhava com o erro genérico do composer.
2. `removeCardPhotoBackground` engolia qualquer exceção do motor em `reason: 'engine'` e o composer mostrava a mesma copy de "foto ruim" — a mensagem não distinguia foto de ambiente.
3. O motor `@mediapipe/tasks-vision` exige **WASM** e um contexto **WebGL** para o grafo de visão; com o delegate CPU ele ainda pede o `kGpuService` (processamento de imagem), então não há caminho por software. Evidência: `[card-cutout] Failed to create WebGL context` → `StartGraph failed: Service "kGpuService" ... was not created` (reproduzido em Firefox com `webgl.disabled=true`), e `ReferenceError: WebAssembly is not defined` (com `javascript.options.wasm=false`). Confirmado como comportamento upstream conhecido (mediapipe issues #5348, #5609, #5970: CPU delegate também falha sem WebGL).
4. O IronFox desliga **WebAssembly e WebGL por padrão** (README/IronFox: "IronFox has WebAssembly disabled by default", "IronFox has WebGL disabled by default"; há toggles em Configurações → Privacidade e segurança → Configurações do site → Conteúdo). O relator usa esse navegador no Android.
5. Nada no funil detectava essas capacidades antes de baixar ~12 MB de wasm nem dizia ao visitante o que fazer — o usuário só podia tentar de novo com outra foto, o que nunca resolveria.

**Causa secundária (prevenção):** a decodificação (`createImageBitmap(file)`) e a segmentação (`segmenter.segment(bitmap)`) rodavam na resolução total da foto; uma imagem 61MP reproduzidamente retornava segmentação vazia (`empty`) e o mesmo erro, e o aparelho pagava textura/alocação no tamanho original — exatamente a classe de falha que atinge celulares.

**Bug B — enquadramento (5-whys).**

1. A pessoa saía pequena na prévia.
2. O S18 trocou o enquadramento automático de "bbox cobre a janela" (S15) para "caixa do rosto escalada à referência de 103px" (`TEAM_CARD_FACE_REFERENCE_SIZE`, mediana das caixas dos candidatos medida na arte-mestre).
3. O aceite do S18 (±20% da cabeça dos candidatos, medido pela **mesma caixa do detector nos dois lados**) foi cumprido literalmente — o rosto desenhado bate ~103px — mas a régua escolhida não era a que o humano percebe: o busto inteiro é escalado junto com o rosto, então a foto vira um adesivo dentro da janela, distante do card de exemplo (cabeça ~230px) e do resultado S15.
4. O design gate do S18 era DEGRADED (não certificado, artefato ilustrativo) e a craft mediu apenas a própria régua (86–98px vs 103px), não a comparação com o exemplo oficial; o sign-off humano no PR aprovou a régua, não a prévia real de um busto típico.
5. O humano viu o resultado em produção e pediu para voltar ao comportamento anterior (S15) — decisão de produto registrada nesta sessão (2026-09-20).

**Observação sobre "antes do último deploy":** o S20 (`e652f0ae`, deploy seguinte) não altera o enquadramento automático; a mudança de tamanho/posição veio do S18. A âncora lateral do S20 só ampliava o alcance quando a foto desenhada era **menor** que a janela (regime do zoom < 1 do S18); com o enquadramento cover restaurado ela é inerte por construção, e por isso saiu junto (código morto).

## Correção

**Bug A — `src/components/cards/cardCutout.ts` + `src/components/cards/CardComposer.tsx`:**

- Probes `supportsWebAssembly()` (valida um módulo mínimo) e `supportsWebgl()` (cria um contexto e o libera com `WEBGL_lose_context`) rodam **antes** do download; qualquer bloqueio devolve `{ ok: false, reason: 'unsupported' }` (reason novo no `CardCutoutResult`/`CardCutoutState`).
- O composer mostra, para `unsupported`, a mensagem acionável: "Seu navegador está bloqueando o recorte de fundo. O recorte roda no seu aparelho e precisa de WebAssembly e WebGL, que navegadores com proteções avançadas (como IronFox e Tor) desligam por padrão. Ative essas opções para este site nas configurações do navegador — ou abra a página em outro navegador — e toque em 'Tentar de novo'." (a dica de "foto de busto nítida" some nesse ramo).
- Tentativa de fallback para o delegate CPU foi implementada e **descartada com prova**: o grafo pede `kGpuService` de qualquer forma, então não entrou no fix final.
- `engineCutout` passa a decodificar via `loadCardPhoto` (loader compartilhado dos outros cards) e a desenhar num canvas capado (`cappedSize`, maior aresta 1600) que é a entrada de `segmenter.segment`; `readAlphaBbox`/`applyMask` operam nesse canvas. Uma foto 61MP que falhava agora conclui.

**Bug B — revert do S18 (e do S20 dependente dele):**

- `src/lib/cardPhotoTransform.ts` e `src/lib/cardRender.ts` restaurados ao estado pré-S18 via `git show cde96b26~1 -- …` (mantendo S16/S17, que vivem em outros trechos): saem `frameCardPhotoOnFace`, `CardFaceBox`, `isUsableCardFace`, `resolveCardPhotoAnchor`, `CARD_TEAM_PHOTO_MIN_ZOOM`, `CardPhotoClamp`/`anchorBox`.
- `useCardCutout` volta a `frameCardPhotoOnBbox` e o state `ready` não carrega mais `bbox`/`face`; `CardComposer` usa o piso padrão `CARD_PHOTO_MIN_ZOOM` no slider e nos gestos.
- `src/lib/cardModels.ts` perde `TEAM_CARD_FACE_REFERENCE_SIZE`; `public/cards/blaze_face_full_range.tflite` e `.LICENSE.txt` são removidos (o detector de rosto não existe mais).

Sem migration, sem Consent/access, sem contrato de URL/shape público; tudo 100% no aparelho.

## Verificação

- Teste de regressão (A): `tests/unit/cardCutout.unit.spec.ts` — `supportsWebAssembly` false com o global escondido; `removeCardPhotoBackground` devolve `unsupported` com WASM off e com WebGL bloqueado; `cappedSize` 7000×8750 → 1280×1600.
- Teste de regressão (B): e2e `Cards personalizados (S15 — enquadramento automático)` — com o stub, o card conclui sem alerta, o slider fica em **1** (o S18 dava < 0.5) e a sonda de pixel em (300, 727) é a cor crua da foto (o adesivo do S18 não alcançava esse ponto); specs da math do S15 restaurados (`frameCardPhotoOnBbox` cobre a janela, falha fechado em bbox degenerado, etc.).
- Suíte: `pnpm gate:fast` verde (lint 0, `tsc --noEmit` 0, unit 4203), `pnpm format:check`, `pnpm knip`, `pnpm check:cycles`, `node scripts/check-test-locations.mjs`.
- e2e: `tests/e2e/frontend.e2e.spec.ts` 31/31 (inclui os 5 do time e o novo).
- Engine real (craft local, sem stub): Chromium — selfie 1600×1600 → pronto com zoom 1 e card visualmente igual ao exemplo oficial; foto 61MP → pronto (antes: erro); viewport 390×844 → pronto. Firefox — normal, viewport mobile e RFP → pronto com zoom 1; `webgl.disabled=true` → mensagem acionável (`unsupported`); `javascript.options.wasm=false` → mensagem acionável.
- CI: a confirmar no PR.
- Prod: pendente — aguarda o approve humano do environment `production` e a confirmação do relator, inclusive no aparelho dele (IronFox exige ativar WebAssembly/WebGL para o site, ou usar outro navegador).

## Prevenção

| Estratégia                                                                                                                                                                    | Custo  | Estado                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------ |
| Probes de capacidade (WASM/WebGL) antes do download + reason `unsupported` com copy acionável + testes unit de regressão                                                      | barata | implementada agora (este PR)   |
| Cap da entrada de inferência (1600) + decode pelo loader compartilhado `loadCardPhoto` (evita textura/alocação em resolução total)                                            | barata | implementada agora (este PR)   |
| Matriz de craft com navegadores endurecidos (IronFox/Tor) e viewport mobile como passo explícito em entregas que tocam o engine                                               | barata | documentada — não implementada |
| Bbox derivado da máscara de segmentação (não do `getImageData` do canvas): mais barato (256² vs 1600²) e imune à randomização de canvas do RFP                                | barata | documentada — não implementada |
| Fallback de recorte para navegador sem WebGL (outro motor ou serviço no servidor) — esbarraria no contrato "nenhum byte da foto sai do aparelho", exigiria decisão de produto | cara   | documentada — não implementada |
| Port do provisionador de worktree que evite portas IANA reservadas (o slot 559 gerou `PORT=3659` = apple-sasl e derrubou `pnpm dev`/e2e local; contornado com 3900/3950)      | barata | documentada — não implementada |

**Estratégia implementada:** detecção de capacidade antes do trabalho pesado com mensagem verdadeira e acionável (testada em unit), e o cap de inferência que fecha o caso das fotos gigantes.

**Estratégia documentada (cara):** fallback de recorte sem WebGL dependeria de outro motor/serviço — conflita com a promessa de privacidade (100% no aparelho) e não entra sem decisão de produto; a matriz de navegadores endurecidos no craft e o bbox pela máscara ficam como candidatos baratos de follow-up.

## Lições

- **Navegadores endurecidos são usuários reais.** IronFox (fork do Mull) desliga WebAssembly e WebGL por padrão; o motor de visão no browser do MediaPipe exige os dois e não tem caminho CPU. Antes de baixar um wasm de 12 MB, valeu detectar e dizer a verdade — a copy antiga ("escolha outra foto") mandava o visitante lutar contra a própria foto.
- **A régua do aceite pode esconder a regressão visual.** O S18 cumpriu "cabeça ±20% da caixa dos candidatos" medindo os dois lados com o mesmo detector, mas o resultado real ficou pequeno contra o exemplo oficial do card. Para features visuais, comparar com a **referência do produto** (o card de exemplo) na prévia, não só com a métrica interna.
- **Uma feature pode morrer quando a premissa cai.** A âncora lateral do S20 existia só porque o S18 deixava a foto menor que a janela; ao voltar o enquadramento cover, ela virou código inerte — saiu junto em vez de ficar de enfeite.
- **Fotos de celular são grandes.** A inferência em resolução total era uma bomba de memória/textura (61MP reproduzido); capar a entrada é barato e não muda a qualidade (a máscara já é 256²).
- **Achado de infraestrutura:** o worktree `fix/8` foi provisionado com `PORT=3659`, reservado pela IANA (`apple-sasl`) — o Next recusa subir e o webServer do e2e falha. Contornado localmente (dev em 3900; `.env.test.local` com `PLAYWRIGHT_BASE_URL` em 3950, arquivo gitignored). O provisionador deveria pular portas reservadas.
