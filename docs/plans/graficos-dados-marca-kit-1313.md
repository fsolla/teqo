# Gráficos de dados do Instagram na marca oficial do kit 1313

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1192
Priority: P2
Impeccable: C — superfície gráfica (o produto é o gráfico; não é tela de app) com design hi-fi existente a atualizar
Design UI: docs/plans/graficos-dados-instagram-ui-design.html (revisão C203 aprovada no gate em 2026-09-19)
Appetite: ~1 dia eng (design + port + testes)
Responsável: —

## Intenção

A C196 mesclou a identidade oficial "kit 1313" em `public/campaign-kit/` (7 PNGs de marca + README com a paleta oficial + manual), mas a skill `graficos-dados` (C191) segue com a paleta provisória de mandato e recriando um lockup tipográfico no rodapé. O hi-fi aprovado já registra o débito: `NEEDS ASSET · LOGO OFICIAL` com a nota "Substituir o lockup tipográfico provisório pelo arquivo oficial aprovado do mandato, preservando esta área e contraste" — o ativo oficial agora existe. A intenção é que os gráficos de Instagram saiam na marca e na paleta oficiais do kit 1313, mantendo o template aprovado (grid, headline-manchete, um destaque, guardrails de correção, render local, saída gitignored). Mesmo racional do C196 nos reels: cena gráfica usa o kit; aqui não há cena de captura de site — a peça inteira é gráfica.

## Persona e fluxo

- **Persona / contexto:** comunicação do mandato/campanha, na mesa, transformando números que chegaram (xlsx/csv/md/texto colado) em peça de Instagram; precisa publicar rápido e sem errar a marca.
- **Job principal:** gerar um gráfico PNG com o dado de campanha na identidade oficial 1313, sem editar nada à mão.
- **Fluxo desejado:** recebe os números → escolhe o formato (feed 1080×1350, quadrado 1080×1080, stories 1080×1920) → a skill aplica o template aprovado com a marca oficial → confere o PNG renderizado localmente → publica.
- **Anti-goals de produto:** não virar editor gráfico; não ser um segundo renderer nem dependência de nuvem; não tocar o site público; não redesenhar o template.

### Esboço de fluxo (C)

```text
[recebe números] → [escolhe formato] → [skill aplica template + marca oficial]
→ [PNG local na marca do kit] → [confere] → [publica]
```

### Design UI (C)

- Design UI (gate): `docs/plans/graficos-dados-instagram-ui-design.html` — **revisão C203 aprovada no gate em 2026-09-19**: `NEEDS ASSET · LOGO OFICIAL` resolvido com `jorge-solla-positivo.png` (10 placements, `object-fit: contain`), paleta de marca oficial e mapeamento semântico fixados (destaque/valência boa `#e4102f`; ruim cinza; sinal de marca `#184e92`; amarelo/verde só dentro dos ativos). Tier de produção da revisão: `opencode-go/deepseek-v4.1-flash` (o frontier `openai/gpt-5.6-sol` bateu quota) — `Design tier:` a registrar no PR, com o sign-off humano do gate. Assets do artefato em `docs/plans/graficos-dados-instagram-ui-design-assets/`.

## Objetivo e aceite

- Os gráficos gerados exibem a marca oficial (kit 1313) no rodapé no lugar do lockup tipográfico provisório, preservando área e contraste do template aprovado.
- A paleta de marca do gráfico passa a ser a oficial do kit; neutros e mapeamento semântico ficam como o `designer` fixar no hi-fi.
- Formatos e dimensões preservados: 1080×1350 / 1080×1080 / 1080×1920, PNG.
- Guardrails de correção intactos: 100% local (dado de campanha nunca sai da máquina), saída gitignored, sem fonte sem peça, barras no zero, ≤7 pontos, valência por palavra+forma+cor, projeção/cruzamento só com confirmação, texto real, um único destaque.
- O slogan "Mais Saúde, Mais Futuro" permanece apenas dentro das marcas completas — nunca headline nem quarta mensagem.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o produto entregue é o próprio gráfico.
- **Decisões desbloqueadas:** comunicação decide publicar a peça com o dado recebido sabendo que marca e paleta estão corretas para o ciclo 1313; `designer` decide o mapeamento semântico de destaque/valência/sinal no hi-fi.
- **Forma:** _adiada ao plano de implementação_ — restrições de produto: leitura relativa/local (sem % estadual absoluto), um único destaque por peça, texto real.

## Dados da decisão (literais)

- Paleta oficial do kit: `#e4102f` (vermelho), `#184e92` (azul), `#ffeb00` (amarelo), `#009647` (verde — só dentro dos ativos); o laranja `#f89c0e` existe só nas variações de paleta e **não é usado**.
- Marca: positiva (nome vermelho/azul) em fundo claro; negativa (branco/amarelo) em fundo vermelho/escuro. O gráfico tem fundo off-white → **marca positiva / `jorge-solla-positivo`**.
- Ativos disponíveis em `public/campaign-kit/`: `marca-positiva-completa.png`, `marca-negativa-completa.png`, `jorge-solla-positivo.png`, `jorge-solla-negativo.png`, `numero-positivo.png`, `numero-negativo.png`, `estrela.png`.
- Manual oficial: `docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`; README com a paleta em `public/campaign-kit/README.md`.
- Estrela: usada a 100% sobre disco branco do mesmo diâmetro — nunca com opacidade.
- Slogan "Mais Saúde, Mais Futuro" vive **dentro** das marcas completas.
- Não recriar lockups tipográficos quando o ativo oficial existe.
- Formato provisório a substituir: `brandLockup` "JORGE SOLLA" / "MANDATO DEPUTADO FEDERAL" (`scripts/lib/graficosInstagramRender.mjs:139-145`) e `SOLLA_PALETTE` `#c51414`, `#ae1603`, `#a21c1c`, `#ffe607` (`:17-29`).
- Área segura do hi-fi: 1012×1350; vermelho de destaque ≤ ~10% da peça (`docs/plans/graficos-dados-instagram-ui-design.html:1748-1806`).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/graficosInstagramRender.mjs` (paleta/lockup/footer), `scripts/lib/chartPrimitives.mjs` (`CHART_COLORS`, defaults de `lineChart`), `scripts/build-chart-from-data.mjs` (entry), testes que pinam os literais, `.agents/skills/graficos-dados/SKILL.md` (`:114-121`, `:134-139`) e `.opencode/commands/graficos-dados.md`.
- **Precedente a olhar:** consumo do kit como data URI em `scripts/lib/reelRender.mjs:121-138` (`KIT_ASSETS`/`readKitAssets`) e a seção "Marca oficial (kit 1313)" em `.agents/skills/reels-tutoriais/SKILL.md:118-135`.
- **Risco de acoplamento:** `screenshotHtmlPng` (`scripts/lib/buildPdf.mjs:39-63`) roda `setContent` sem rede/base — o ativo precisa ser embutido (data URI ou `file://`); `chartPrimitives` é compartilhado com os dossiês/relatórios — não vazar a paleta 1313 para lá; testes unit/e2e pinam `#c51414` e o lockup verbatim e precisam acompanhar.

## Dependências

- **Hard:** C196 — ativos do kit já mesclados em `public/campaign-kit/` (entregue; nada a esperar).
- **Soft:** Nenhuma.

## Fora de escopo

- Site público e tokens de tema — a UI pública segue com a identidade legada; adotar o kit lá é mudança de UI pública, item próprio com gatilho.
- Documentos institucionais (dossiês, boletins, relatório de cidade) — mantêm a identidade própria e a regra de "nunca marca de campanha" (`scripts/lib/dossieRender.mjs:141`).
- Reels tutoriais — já resolvidos no C196.

## Rabbit holes de produto

- **Editor gráfico.** Se alguém “só completar”: UI de edição, drag-and-drop, WYSIWYG. **Corte neste item:** template fixo + dados de entrada; nada de edição manual.
- **Render na nuvem/MCP remoto.** Se alguém “só completar”: serviço, fila, deploy. **Corte neste item:** 100% local como hoje.
- **Segundo renderer/biblioteca.** Se alguém “só completar”: duas fontes de verdade visual. **Corte neste item:** estender o renderer atual.
- **Redesenhar o template inteiro** (grid, headline-manchete). **Corte neste item:** o template aprovado é preservado; mudam marca e paleta.

## Questões em aberto (produto)

- **Adotar a paleta oficial completa + marca oficial, ou só trocar o lockup mantendo a paleta provisória?** **Opções:** A) adoção completa (paleta + marca) | B) só lockup. **Recomendação:** A — consistência com o C196 e a nota do próprio hi-fi mandam substituir o lockup; manter a paleta provisória deixaria a peça híbrida. _(decidido no gate 2026-09-19: A)_
- **O destaque/valência continua no vermelho do kit (`#e4102f`)?** **Opções:** sim (kit) | manter `#c51414` só no destaque. **Recomendação:** sim, `#e4102f`, com o `designer` definindo o mapeamento semântico no hi-fi. _(decidido no gate 2026-09-19: sim)_
- **A peça é gráfica de campanha → kit, sem cena de captura de site?** **Opções:** confirmar leitura TSE/assessoria se necessário | manter como está. **Recomendação:** seguir o kit (não há cena de captura). _(assumido — validar com assessoria/TSE se couber)_

## Referências

- GitHub Issue: a registrar (C203) — follow-up de C191, mesma família do C196.
- Design UI (gate): `docs/plans/graficos-dados-instagram-ui-design.html` + assets em `docs/plans/graficos-dados-instagram-ui-design-assets/`.
- Kit: `public/campaign-kit/README.md`; `docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`.
- Render/paleta atuais: `scripts/lib/graficosInstagramRender.mjs:17-29,93-102,129-150`; `scripts/lib/chartPrimitives.mjs:17-31,498-508`; `scripts/build-chart-from-data.mjs:33,189,205-213`; `scripts/lib/buildPdf.mjs:39-63`.
- Precedente kit: `scripts/lib/reelRender.mjs:121-138`; `.agents/skills/reels-tutoriais/SKILL.md:118-135`.
- Skill/command a atualizar: `.agents/skills/graficos-dados/SKILL.md:114-121,134-139`; `.opencode/commands/graficos-dados.md`.
- Testes que pinam literais: `tests/unit/graficosInstagramRender.unit.spec.ts:45-50,53-57,74,98-107`; `tests/unit/chartPrimitives.unit.spec.ts:140-142,160-188,279`; `tests/e2e/campaignChartPng.e2e.spec.ts:78-87,91-104`; `tests/unit/buildChartFromData.unit.spec.ts:165-168,211-216`.
- Hi-fi (literais): `docs/plans/graficos-dados-instagram-ui-design.html:817,1365,854-859,1407-1441,1748-1806`.
