# S46 — Página pública "story da sua seção" (potencial de Lula)

Status: rascunho
Atualizado em: 2026-10-05
Issue: #1436
Priority: P1
Impeccable: C — fluxo novo numa rota pública
Design UI: docs/plans/potencial-secao-story-ui-design.html
Appetite: ~2–3 dias eng; um outcome verificável
Responsável: —

## Intenção

O 2º turno é em 25/10/2026 e falta uma ferramenta de amplificação para o eleitor comum: quem tem o título de eleitor em mãos quer ver o que a *sua própria seção* pode render para Lula e sair compartilhando. Hoje o site público fala para o público geral, não para a seção de quem visita. A oportunidade é transformar um recorte que a pessoa reconhece (a seção onde vota) num story de Instagram pronto, com um número local e pessoal o bastante para circular sozinho no WhatsApp.

## Persona e fluxo

- **Persona / contexto:** eleitor/apoiador no celular, em campanha de WhatsApp; quer participar sem virar analista. Secundária: liderança local que amplifica material pronto.
- **Job principal:** em menos de um minuto, ver o potencial de Lula na sua seção e sair com a imagem de story na mão.
- **Fluxo desejado:** informa UF, município, zona e seção (dados do título); vê o 1º turno na seção e o cenário hipotético com o ganho em pontos percentuais; toca em gerar story; confere o preview 1080×1920; baixa ou compartilha. Seção não encontrada → mensagem clara para conferir o título, sem inventar número.
- **Anti-goals de produto:** não é simulador livre de cenários; não mostra seções alheias nem ranking; não pede nome, telefone ou consentimento; não vira dashboard nem pesquisa de intenção.

### Esboço de fluxo (C)

```text
[título de eleitor em mãos] → escolhe UF → município → zona → seção
  → [site calcula] → vê "sua seção: 47,9% → 56,2% (+8,3 p.p.)" e cenário total (+18,5 p.p.)  ← números de exemplo
  → toca "gerar story" → preview 1080×1920 → [baixar | compartilhar] → [story publicado]
  └─ seção não encontrada → "confira os dados do título" → volta e corrige
```

### Design UI (C)

- Design UI (gate): `docs/plans/potencial-secao-story-ui-design.html` — cenas desktop 1280, mobile 390, estados (não encontrada, carregando, resultado, imagem pronta) e anatomia do story 1080×1920.
- **Tier degradado:** artefato produzido sem o `designer` frontier (tier degradado) — requer **sign-off humano explícito** no gate.

## Objetivo e aceite

- Qualquer visitante, sem login, informa UF/município/zona/seção e vê os três números da seção: 1º turno, cenário imediato (X₁) e cenário total (X₂), com o ganho em p.p. — sempre rotulado como cenário hipotético.
- A imagem 1080×1920 sai com os mesmos números da tela, legível em story e enquadrada como "se esta seção decidir a eleição".
- O fluxo completo (primeiro toque → download) cabe em menos de um minuto no celular.
- Guardrails: números sempre do recorte da seção escolhida; nunca % estadual absoluto; rótulo explícito de cenário hipotético; seção sem dado → estado vazio honesto, nunca estimativa; sem coleta de dado pessoal nem login.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item (números calculados da seção + imagem).
- **Decisões desbloqueadas:**
  - Visitante/apoiador: decide se aquele número local vale um story — e o publica.
  - Liderança local: decide usar o ganho da própria seção no material de mobilização.
- **Forma:** *adiada ao plano de implementação* — restrições: pontos percentuais do recorte local, 1º → 2º turno lado a lado para X₁ e X₂, com carimbo de cenário hipotético.

## Dados da decisão (literais)

- Item `S46`; slug `potencial-secao-story`; tipo `feature`; Priority `P1`; Impeccable `C` (fluxo novo em rota pública); model `deepseek/deepseek-flash`.
- **Fonte:** TSE, 1º turno presidencial de 04/10/2026, por seção (família bulk `votacao_secao_2026` no CDN do TSE, análoga à de 2022).
- **Candidatos (verificados nas telas do TSE):** Lula 12 (PT); Flávio Bolsonaro 22 (PL); Renan Santos 14 (Missão); Escritor Augusto Cury 70 (Avante).
- **Fórmulas aprovadas:** X₁ = nulos + brancos + Renan + Cury; X₂ = X₁ + faltantes (faltantes = aptos − comparecimento).
  - 1º turno na seção: Lula ÷ votos válidos × 100.
  - 2º turno no cenário: (Lula + X) ÷ (Lula + X + Flávio) × 100, para X₁ e X₂.
  - Ganho em pontos percentuais: (2º turno) − (1º turno), para imediato (X₁) e total (X₂).
- **Referência de forma (não usar na UI como dado real):** Seção 0051 Curitiba/PR: Lula 91, Flávio 81, válidos 190, X₁=13, X₂=69 → 47,9% → 56,2%/66,4% (+8,3/+18,5 p.p.).

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota pública nova no route group `(frontend)`; dono do card/imagem: `src/lib/cardModels.ts` + `src/lib/cardRender.ts`, `src/components/cards/CardComposer.tsx`, `src/components/cards/cardCanvas.ts` (canvas → PNG), página `/cards` em `src/app/(frontend)/(home)/cards/page.tsx`; compartilhamento em `src/lib/contentShare.ts` + `src/components/conteudos/ContentPieceShareSheet.tsx` (share com files + fallback download).
- **Dados:** não há 2026 ingerido; precedente por seção em `scripts/build-expansao-secoes-2022.mjs` (chave `CD_MUNICIPIO|NR_ZONA|NR_SECAO`, ISO-8859-1, `;`) e `docs/research/analise-expansao-secoes-solla-julio-2022.md`; ingestão única do presidente T1 2026 no espírito de `scripts/seed-tse-results.mjs` — agregado nacional (~499k seções) viável.
- **Precedente a olhar:** `src/app/(frontend)/api/fotos/selfie/route.ts` (rota pública com rate limit e corpo limitado), `src/utilities/content/contentEventRateLimit.ts`, evento anônimo de download via `POST /api/content-events`.
- **Convenções:** rota estática de 1 segmento entra em `SHARE_LINK_RESERVED_SLUGS` (`src/lib/shareLink.ts`, com drift test); e2e novo precisa mapping em `scripts/lib/e2e-affected-manifest.mjs`.
- **Risco de acoplamento:** S43 (home-colinha) mexe no mesmo dono de card — serializar; não criar um segundo cano de imagem.

## Dependências

- Nenhuma dura. Serializa com S43 (mesmo dono de card/imagem).

## Fora de escopo

- Simulador livre de cenários ou transferência de votos diferente de "todos os disponíveis vão para Lula".
- Dados por seção de outros cargos, séries históricas ou 2º turno por seção.
- Mapa, busca por endereço, login, cadastro, coleta de contato, Consent.
- Análises/exports internos por seção para a campanha — outro item, se houver demanda.
- SEO/sitemap além do básico da rota.

## Rabbit holes de produto

- **"Só completar" com transferência seletiva de votos.** Se alguém completar: vira modelo opinativo e o número perde lastro. **Corte:** só o cenário único aprovado (todos os votos disponíveis para Lula).
- **"Só completar" com visão por zona/município.** Se alguém completar: vira um segundo produto analítico. **Corte:** um nível — a seção informada; agregados ficam fora.
- **"Só completar" com editor visual de story.** Se alguém completar: vira ferramenta de design. **Corte:** um template fixo 1080×1920.

## Questões em aberto (produto)

- **Escopo de UF: Brasil ou BA-only?** **Opções:** A) Brasil inteiro; B) só BA; C) BA primeiro com gate. **Recomendação:** A — ingestão única do presidente T1 2026 nacional; a seção de qualquer UF deve funcionar porque a viralização não respeita fronteira. _(assumido — validar com produto)_
- **Rota/URL pública?** **Opções:** A) `/potencial`; B) `/potencial-secao`; C) dentro de `/cards`. **Recomendação:** A — rota estática curta, entrando em `SHARE_LINK_RESERVED_SLUGS`; memorável no story.
- **Baixar vs compartilhar?** **Opções:** A) só baixar; B) só share; C) baixar + share sheet quando disponível. **Recomendação:** C — baixar é o piso universal; share com arquivo quando o aparelho suportar.
- **Fonte se o bulk 2026 ainda não estiver publicado?** **Opções:** A) lançar só com o bulk; B) ingerir de boletins por seção; C) publicar com o que houver. **Recomendação:** A, com fallback documentado — script único de ingestão do bulk; se na janela só existir boletim, registrar a limitação e nunca estimar seção faltante.

## Referências

- GitHub Issue #1436
- Design UI (gate): `docs/plans/potencial-secao-story-ui-design.html` (tier degradado — sign-off humano)
- Dono de card/imagem: `src/lib/cardModels.ts`, `src/lib/cardRender.ts`, `src/components/cards/CardComposer.tsx`, `src/components/cards/cardCanvas.ts`, `src/app/(frontend)/(home)/cards/page.tsx`
- Compartilhamento: `src/lib/contentShare.ts`, `src/lib/phone.ts`, `src/components/conteudos/ContentPieceShareSheet.tsx`
- Rota pública/rate limit: `src/app/(frontend)/api/fotos/selfie/route.ts`, `src/utilities/content/contentEventRateLimit.ts`, `src/utilities/electionCache.ts`
- Convenções de rota: `src/lib/shareLink.ts`, `scripts/lib/e2e-affected-manifest.mjs`
- Dados TSE por seção: `scripts/seed-tse-results.mjs`, `scripts/build-expansao-secoes-2022.mjs`, `docs/research/analise-expansao-secoes-solla-julio-2022.md`
