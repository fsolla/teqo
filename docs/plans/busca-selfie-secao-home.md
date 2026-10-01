# C243 — Seção da busca por selfie na homepage pública

Status: aprovado (decisão do dono na sessão, 2026-10-01)
Atualizado em: 2026-10-01
Issue: — (worktree `work/43`, sem claim)
Priority: P2
Impeccable: C — seção nova na homepage pública (descoberta da busca por selfie)
Design UI: docs/plans/busca-selfie-secao-home-ui-design.html
Appetite: ~0,5–1 dia eng — **uma seção da home que apresenta e leva à busca por selfie**, sem duplicar a superfície do álbum
Responsável: —

## Intenção

Com o C242 abrindo a busca por selfie a qualquer visitante, a homepage pública passa a ter uma porta para ela. Hoje a busca só é descoberta dentro de `/fotos` (banda da cena 01); o dono pediu (2026-10-01) **seção própria na homepage**, que aparece quando a busca está aberta e leva direto a `/fotos/encontre`.

A seção é descoberta, não uma segunda busca: nada de captura de selfie na home (o engine pesado roda só na página da busca, como hoje). Copy e visual seguem a gramática das seções da home e o aviso de biometria/LGPD aparece de forma honesta.

## Persona e fluxo

- **Persona / contexto:** visitante na home da campanha, no celular, que viu Solla num evento e não sabe que existe um álbum pesquisável.
- **Job principal:** saber que dá para me encontrar nas fotos do mandato e chegar lá.
- **Fluxo desejado:** rola a home → encontra a seção "Encontre você nas fotos" com explicação curta (selfie não sai do aparelho; acervo aprovado; dá para sair do índice) → toca o CTA → chega em `/fotos/encontre`.
- **Anti-goals de produto:** não captura selfie na home; não lista pessoas; não promete "todas as fotos"; não vira carrossel de fotos com PII; não aparece fechada/quebrada.

## Objetivo e aceite

- A seção aparece na home **somente quando a busca está aberta** (flag `selfieSearchEnabled`, álbum publicado e fotos aprovadas) — fail-closed: nenhum CTA morto/404 enquanto fechada.
- O CTA leva a `/fotos/encontre`; a seção tem título, explicação curta e um link secundário para o álbum (`/fotos`).
- Mobile-first (390) e desktop (1280) fiéis ao design hi-fi aprovado; acessibilidade: heading na hierarquia da página, foco visível, contraste, `prefers-reduced-motion`.
- Nenhum texto que prometa identificação de terceiros ou score; o aviso de biometria é o mesmo contrato do C242.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Forma:** N/A — sem números, sem contadores, sem "X fotos" (o acervo muda).

## Dados da decisão (literais)

- **Comportamento quando fechada — decisão do dono (2026-10-01):** "aparece quando aberta, mas já é pra abrir" → a seção é renderizada condicionada ao estado aberto e a abertura é feita na mesma entrega (ops do C242).
- **Sem captura na home:** o engine de face não é carregado na homepage (peso ~7 MB de modelos + wasm); a home só apresenta e linka.
- **Posição:** a definir no design hi-fi, entre as seções de conteúdo existentes (recomendação da engenharia: depois de `ContentPieceHomeSection`, antes da newsletter), sem quebrar o ritmo/altura das seções atuais.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(frontend)/(home)/page.tsx` (composição + gating), componente novo em `src/components/fotos/`, classes/tokens `campaign-section-*` de `styles.css` e os padrões de seção da home (`JingleHomeSection`, `ContentPieceHomeSection`, `CampaignCardsSection`).
- **Precedente a olhar:** `SelfieSearchEntry.tsx` (banda do C234 em `/fotos`), `ContentPieceHomeSection.tsx` (seção condicional), `hasPublishedArchivePhotos` (flag cacheada) + `getCachedGlobal('photoAlbum')` (kill switches com tag própria).
- **Risco de acoplamento:** a home usa reads cacheados (ISR/tag); a seção não pode introduzir leitura live de Consent (perda de estaticidade). Gatear por flag global + fotos aprovadas (ambos cacheados e revalidados no admin); misconfiguração de Consent cai no estado fechado da página de destino, nunca em 404.

## Dependências

- Duras: C242 (busca aberta a qualquer visitante) — a seção só faz sentido com ela.
- Soft: nenhuma.

## Fora de escopo

- Captura/engine na home; carrossel de fotos; contadores; personalização por visitante.
- Mudar a `/fotos` ou o fluxo de `/fotos/encontre` além da copy/porta do C242.

## Rabbit holes de produto

- **"Só completar" com prévia de fotos na home.** **Corte:** a home não renderiza fotos do acervo (PII + peso); só a banda de convite.
- **"Só completar" com captura inline.** **Corte:** engine só em `/fotos/encontre`.

## Questões em aberto (produto)

- Nenhuma bloqueante; posição final e composição ficam no design hi-fi (gate visual).

## Referências

- `docs/plans/busca-fotos-por-selfie.md` (C234 — artefato de design a estender)
- `docs/plans/busca-selfie-escopo-b.md` (C242 — dono do estado "aberta")
- `src/components/fotos/SelfieSearchEntry.tsx` · `src/app/(frontend)/(home)/page.tsx`

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (visitante descobre e chega à busca quando aberta; fechada não aparece); (2) appetite pequeno comporta design + componente + testes; (3) persona/job/aceite verificáveis; (4) direção no codebase com precedentes; (5) decisões duras (comportamento e captura) tomadas e registradas.
