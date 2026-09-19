# Card "Time de você": cabeça do visitante proporcional à dos candidatos

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1197
Priority: P2
Impeccable: C — ajuste de comportamento visual num funil público existente (sem controle novo)
Design UI: docs/plans/cards-time-de-voce-escala-cabeca-ui-design.html
Appetite: ~1–1,5 dia eng; cabeça do visitante em proporção com os candidatos, com fallback seguro
Responsável: —

## Intenção

O card "Time de você" (S15, #1161) já enquadra a foto do visitante sozinho — mas só garante que o recorte cubra a janela da foto, ancorado no topo. Na prática, quem manda uma selfie de longe fica com a cabeça minúscula ao lado dos candidatos; quem manda um enquadramento fechado fica gigante. O pedido que abriu este item foi direto:

> "É possivel automaticamente medir o melhor tamanho para colocar a foto? Talvez basear no tamanho da cabeça do usuario e dos candidatos para ficar proporcional?"

A resposta é sim: medir a cabeça dos dois lados com a mesma régua (detecção de rosto) e usar essa proporção para escolher o zoom do enquadramento automático — com os limites do card mandando acima de tudo e, quando não der para medir, valendo exatamente o enquadramento de hoje. É um ajuste de comportamento no funil público, sem controle novo e sem nada saindo do aparelho.

## Persona e fluxo

- **Persona / contexto:** militante no celular, escolheu uma selfie razoável e viu na prévia a cabeça grande demais (foto de perto) ou pequena demais (foto de longe) em relação aos candidatos.
- **Job principal:** a foto entrar na proporção certa sozinha, sem ajustar nada — e, se a medida não for possível, continuar exatamente como hoje.
- **Fluxo desejado:** escolhe a foto → acompanha o recorte no aparelho → o card mede a cabeça do visitante e compara com a dos candidatos → ajusta o enquadramento para ficarem na mesma ordem de grandeza (±20%) → confere a prévia (arrastar/zoom como escape) → baixa o PNG. Sem rosto detectado ou detecção indisponível, a prévia sai como sai hoje, sem aviso de erro.
- **Anti-goals de produto:** editor de enquadramento obrigatório; detecção de rosto como requisito do fluxo; segundo motor/pesquisa de rosto a cada ajuste; prometer recorte/medida perfeitos; expor erro de detecção; alterar o segmentador ou os 3 modelos existentes; upload/serviço/rede.

### Esboço de fluxo (C)

```text
[foto escolhida] → [recorte no aparelho: progresso | erro + retry]
→ [rosto medido?] ─ sim → [zoom para a cabeça ficar ±20% da cabeça dos candidatos]
                 └ não → [enquadramento de hoje, pelo contorno]
→ [prévia (arrastar/zoom como escape)] → [card pronto] → [baixar PNG]
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-time-de-voce-escala-cabeca-ui-design.html`
- Cenas: prévia "antes" (cabeça pequena demais / grande demais) contra "depois" proporcional e o caminho de fallback (idêntico ao de hoje), em mobile e desktop; sem controle novo.
- `Design tier: DEGRADED` — o frontier `openai/gpt-5.6-sol` bateu quota; o artefato saiu do `designer-degraded` e **não certifica**: exige sign-off humano no gate/PR.

## Objetivo e aceite

- A cabeça do visitante no card fica na mesma ordem de grandeza das cabeças dos candidatos da arte oficial, com tolerância de ±20%, medida pela mesma régua nos dois lados.
- O enquadramento automático continua sendo o padrão: nenhum passo novo, nenhum botão novo; arrastar/zoom seguem como escape.
- O rosto do visitante nunca é cortado pelo enquadramento proporcional.
- A cobertura da janela da foto prevalece: nunca sobra buraco no card, mesmo que isso limite a proporção.
- Fallback obrigatório e silencioso: sem rosto detectado, com detecção indisponível ou em qualquer falha, vale o enquadramento atual pelo contorno — o card nunca falha nem mostra erro por causa da detecção de rosto (o único erro recuperável continua sendo o do recorte de fundo).
- Tudo no aparelho; nenhum byte da foto sai; a nota de privacidade existente continua visível e verdadeira.
- O resto do funil fica intocado: os 3 modelos anteriores, a galeria, os textos e os controles seguem como estão.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — nenhuma métrica é apresentada; a medida de cabeça é geometria efêmera no aparelho, não um dado de produto.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: nada de nome, foto ou medida saindo do aparelho nem entrando em analytics.

## Dados da decisão (literais)

- ID `S18`; slug `cards-time-de-voce-escala-cabeca` (arquivo `docs/plans/cards-time-de-voce-escala-cabeca.md`); tipo `feature`; Priority `P2`; Impeccable `C — ajuste de comportamento visual num funil público existente (sem controle novo)`; Design UI: `docs/plans/cards-time-de-voce-escala-cabeca-ui-design.html`.
- O enquadramento automático passa a mirar a proporção da cabeça: a cabeça do visitante deve ficar na mesma ordem de grandeza das cabeças dos candidatos da arte oficial, tolerância ±20%.
- Métrica única dos dois lados: o tamanho da cabeça é medido pela detecção de rosto (mesma métrica sobre a arte dos candidatos e sobre a foto do visitante); a referência dos candidatos é medida uma vez sobre a arte-mestre e registrada como constante literal no código.
- Em foto com mais de um rosto, vale o maior rosto (o do visitante).
- Fallback obrigatório: sem rosto detectado, com detecção indisponível ou em qualquer falha, o enquadramento atual pelo bbox continua valendo — o card NUNCA falha nem mostra erro por causa da detecção de rosto (só o recorte de fundo tem estado de erro).
- A cobertura da janela da foto prevalece: se a proporção exigir ampliar além do necessário para cobrir, a cobertura manda (nunca sobra buraco no card).
- Nenhum controle novo: continua automático, com arrastar/zoom como escape (como hoje).
- O rosto nunca é cortado pelo enquadramento proporcional.
- 100% no aparelho; o modelo de detecção segue o padrão do segmentador (mesma origem, commitado, licença documentada, lazy: só o modelo time paga); sem pin de modelo de execução (roda no modelo padrão da sessão; provider `openai` é reservado ao design).
- A janela da foto do card time continua a do S15: x=286, y=439, largura=592, altura=577 (card 1080×1440).

## Direção no codebase (hipótese)

- **Áreas prováveis:** detecção no adapter `src/components/cards/cardCutout.ts` reaproveitando `@mediapipe/tasks-vision` + modelo de rosto commitado em `public/cards/`; matemática pura nova/estendida em `src/lib/cardPhotoTransform.ts` (a partir de `frameCardPhotoOnBbox`); estado no `useCardCutout.ts`; render/prévia no `src/components/cards/CardComposer.tsx`.
- **Precedente a olhar:** S15 (`docs/plans/cards-time-de-voce-impl.md`) — motor/wasm/modelo/licença em `public/cards/` e o seam do stub; testes `tests/unit/cardPhotoTransform.unit.spec.ts`, `cardRender.unit.spec.ts` e e2e `tests/e2e/frontend.e2e.spec.ts` (stub do motor via `NEXT_PUBLIC_CARDS_CUTOUT_STUB=1`).
- **Risco de acoplamento:** a detecção pega carona no mesmo caminho do recorte (o stub de e2e cobre hoje só o segmentador e o e2e falha em qualquer console error); pan/zoom do visitante continuam sendo o escape e nada pode travar a prévia.

## Dependências

- S15 (#1161) entregue — o modelo, o recorte e o auto-enquadramento existem.
- S17 não é dependência, mas os dois tocam o mesmo pipeline — se rodarem em paralelo, serializar.

## Fora de escopo

- Editor de enquadramento obrigatório; qualquer controle novo de proporção.
- Detecção de rosto como requisito do fluxo (foto sem rosto segue funcionando como hoje).
- Identificação de pessoa / reconhecimento facial (detecção ≠ identificação), escolha entre vários rostos, rosto "perfeito".
- Re-detectar o rosto a cada arrastar/zoom (a medida é feita no momento do recorte).
- Alterar o segmentador, os 3 modelos antigos, a arte-mestre, os textos do funil ou a privacidade.
- Upload/serviço/rede; métricas de uso da detecção; modelos adicionais/CMS/compartilhamento (cortados no S15, seguem cortados).

## Rabbit holes de produto

- **Proporção virar editor de enquadramento.** Se alguém "só completar": nasce um passo obrigatório de ajuste fino de cabeça. **Corte neste item:** automático, ±20% quando der; arrastar/zoom como escape de sempre.
- **Detecção virar requisito.** Se alguém "só completar": foto sem rosto detectado vira erro ou bloqueia o card. **Corte neste item:** fallback silencioso ao enquadramento atual; o único erro recuperável continua sendo o do recorte.
- **Medir "no olho".** Se alguém "só completar": a régua vira opinião e cada ajuste reabre a conta. **Corte neste item:** métrica única (caixa do rosto), mesma dos dois lados, referência literal registrada.
- **Cabeça proporcional a qualquer custo.** Se alguém "só completar": zoom sem limite, buraco no card ou rosto cortado. **Corte neste item:** cobertura > proporção > nada; rosto nunca cortado; fallback.

## Questões em aberto (produto)

- **Medir a referência dos candidatos na arte em tempo de execução ou como constante medida uma vez?** **Opções:** A) constante literal medida uma vez sobre a arte-mestre | B) medir a arte a cada sessão | C) híbrido. **Recomendação:** A — a arte-mestre é fixa e já versionada; a constante é auditável, não custa nada no aparelho e não depende de a detecção acertar a arte a cada uso. _(assumido — validar com produto)_
- **Prover também um toggle para desligar a proporção ou deixar só automático?** **Opções:** A) só automático com fallback | B) toggle do visitante | C) flag interna. **Recomendação:** A — anti-goal "controle novo"; se o ajuste incomodar, arrastar/zoom já é o escape. _(assumido — validar com produto)_
- **Qual detector usar?** **Opções:** A) `FaceDetector` (caixa do rosto) | B) `FaceLandmarker` (malha facial) | C) motor próprio. **Recomendação:** A — a medida decidida é o tamanho da cabeça, e a caixa do rosto já a entrega; menos peso no celular e menos superfície. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1197
- Design UI (gate): `docs/plans/cards-time-de-voce-escala-cabeca-ui-design.html` (+ assets em `cards-time-de-voce-escala-cabeca-ui-design-assets/`)
- `docs/plans/cards-time-de-voce.md` e `cards-time-de-voce-impl.md` (S15, #1161)
- `src/lib/cardPhotoTransform.ts` (`frameCardPhotoOnBbox`), `src/components/cards/cardCutout.ts`, `useCardCutout.ts`, `CardComposer.tsx`
- `public/cards/team-card-base.png` / `team-card-example.jpg` (referência visual) e `selfie_segmenter.LICENSE.txt` (padrão de licença)
- `tests/unit/cardPhotoTransform.unit.spec.ts`, `tests/unit/cardRender.unit.spec.ts`, `tests/e2e/frontend.e2e.spec.ts`
- `AGENTS.md` — reserva do provider `openai` ao design e convenções do funil de cards
