# C233 — Álbum público de fotos com busca por data, local, atividade e pessoa pública

Status: rascunho
Atualizado em: 2026-09-26
Issue: #1368
Priority: P2
Impeccable: C — fluxo/rota pública nova (`/fotos`)
Design UI: docs/plans/album-fotos-publico-busca-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável — o cidadão chega à foto certa por data, município, atividade, pessoa pública ou termo, e só vê o que a curadoria aprovou
Responsável: —

## Intenção

O acervo de fotos do mandato está sendo montado e catalogado (C231/C232), mas não tem porta pública: quem viu Solla num comício, numa plenária, numa obra ou numa reunião — ou quem procura o registro de uma agenda — não tem onde navegar. O pedido do dono é transformar o acervo num álbum público do mandato: buscar por data, local (município), atividade (ex.: comício, plenária, reunião, obra) e por pessoa pública que aparece na foto — e chegar à foto que procura. Sem reconhecimento facial nesta fatia (C234); só entra o que a curadoria aprovar; e qualquer pessoa pode pedir a remoção de foto em que aparece.

## Persona e fluxo

- **Persona / contexto:** cidadão/eleitor no celular (apoiador, morador do município, alguém que esteve no evento), em estado de procura leve — quer ver/relembrar a foto, não estudar o acervo.
- **Job principal:** achar a foto certa por data, município, atividade ou pessoa que aparece — e, chegando nela, entender o contexto real (quando, onde, o quê, quem).
- **Fluxo desejado:** entra no álbum → navega por capítulos/álbuns (evento, data, município) ou já busca/filtra por data, município, atividade e pessoa pública (ou digita um termo) → vê a grade com legenda real (data · local · atividade · quem aparece) → abre a foto em contexto → nada casa = estado vazio explicando e oferecendo limpar filtros → se aparece numa foto, o canal "é você nesta foto? peça a remoção" está visível.
- **Anti-goals de produto:** não é rede social (sem like/comentário/share com PII); não é dashboard; não expõe foto não aprovada; não cria segundo cadastro de pessoa (`Contact`); não é a busca facial (C234).

### Esboço de fluxo (C)

```text
[site] → /fotos
  → capítulos/álbuns (evento · data · município) e/ou facetas: data, município, atividade, pessoa pública + termo
  → grade de fotos aprovadas (legenda real: data · local · atividade · quem aparece)
  → abre a foto em contexto → chega à foto que procura
  → nada casa = vazio honesto (explica + limpar filtros)
  → "é você nesta foto? peça a remoção" → atendimento humano → foto sai do público e do índice
[outcome: a foto certa alcançada em poucos toques, só com o que foi aprovado]
```

### Design UI (C)

- Design UI (gate): `docs/plans/album-fotos-publico-busca-ui-design.html`

## Objetivo e aceite

- O visitante acha foto por data, município, atividade e pessoa pública (facetas single-value combináveis) e por termo — e chega à foto.
- Só fotos aprovadas aparecem; foto não aprovada não é acessível nem por URL direta (fail-closed).
- Pessoa pública só pelo catálogo curado, por nome canônico — nunca `Contact`, nunca nome inferido por rosto.
- Foto mostra contexto real (data, local, atividade, quem aparece); nada inventado.
- Vazio honesto: sem resultado = estado que explica e sugere limpar filtros; nunca preencher com "parecidas".
- Remoção a pedido: canal visível; após atendimento humano registrado a foto some do público e do índice de busca; sem esse registro, não republica (fail-closed, right to erasure).
- Cache/revalidação por tag: edição de curadoria reflete no site; pull-down de foto/álbum é imediato.
- Acessibilidade: grade com `alt` real (descrição curada), navegação por teclado, foco visível e contraste; mobile primeiro.
- Performance: grade leve no celular (miniaturas, carregamento sob demanda); imagens same-origin pelo proxy de mídia do Teqo — bucket privado, sem hotlink.
- Guardrail eleitoral: pull-down de foto/álbum não depende de deploy; abrir a rota é decisão do gate (ver Questões).

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é busca/navegação de acervo, não analytics: nenhum número, contador ou ranking aparece para o visitante.
- **Decisões desbloqueadas:** N/A — a decisão do visitante é qualitativa ("esta é a foto que eu procurava?"); nenhuma escolha numérica nomeável.
- **Forma:** N/A — restrição de produto: proibido contador de vaidade ("mais vistas", "populares") ou métrica de engajamento na superfície; qualquer medição interna, se houver, é anônima e não aparece no site.

## Dados da decisão (literais)

- Rota pública nova: **`/fotos`** (literal proposto; o gate confirma) — contrato de URL público, canônico e indexável; facetas single-value na URL no padrão de `contentPieceCatalog` (data, município, atividade, pessoa pública) + busca textual.
- **Sem reconhecimento facial** nesta fatia; busca por **pessoa pública** só pelo catálogo curado (nome canônico; nunca `Contact`, nunca nome inferido por rosto).
- **Só entra no público o que a curadoria aprovar** (estado de publicação explícito) — acervo bruto nunca vaza.
- **Remoção a pedido:** canal visível "é você nesta foto? peça a remoção" com atendimento humano; foto removida some do público e do índice de busca (right to erasure) — fail-closed: sem atendimento registrado, não republica.
- Imagens servidas same-origin pelo proxy de mídia do Teqo (bucket permanece privado); nada de hotlink para Flickr.
- Vazio honesto: sem resultado = estado explicando e sugerindo limpar filtros; nunca preencher com "parecidas".
- Cache público com revalidação por tag (edição de curadoria reflete no site); pull-down de foto/álbum precisa ser imediato.
- **Janela eleitoral (eleição 04/10/2026):** registrar a questão de timing — publicar a rota antes ou depois da eleição / atrás de gate de curadoria com pull-down imediato. Recomendação do plano: **não abrir superfície pública nova nos dias finais de campanha; tratar C233/C234 como pós-eleição**, mantendo C231/C232 internas. É pergunta do gate, não bloqueio do plano.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota nova em `src/app/(frontend)/` (`/fotos`) com componentes públicos próprios; leitura pública cacheada no padrão de `src/utilities/content/contentPieceReads.ts`; contrato puro de URL/facetas/view model no padrão de `src/lib/contentPieceCatalog.ts`; mídia pelo proxy existente das portas de mídia privada; tag de cache registrada no dono da allowlist de revalidação (`src/utilities/revalidateRequest.ts`).
- **Precedente a olhar:** `/conteudos` (`page.tsx`, `loading.tsx`, estados `ContentPieceEmptyState`/`ContentPieceNoResults`); facetas/URL internas `src/utilities/speech/speechListUrl.ts` e `src/lib/speechFacets.ts`; design de facetas `docs/plans/acervo-paridade-busca-filtros-ui-design.html`; visibilidade eleitoral fail-closed (`hidden`/`isPostVisible`, `AGENTS-public.md`).
- **Risco de acoplamento:** contrato de URL público é congelado por AGENTS — canônico/indexável e facetas single-value no vocabulário existente; tag nova de revalidação exige editar a allowlist fechada; imagem pública passa pelo proxy same-origin e pela allowlist do otimizador do Next; não tocar em `Contact`; módulo utilitário novo de topo quebra o pin de convenções (`tests/unit/codebaseConventions.unit.spec.ts:421-427`); pull-down eleitoral não pode depender de deploy.

## Dependências

- **Duras:** C232 (catálogo com atividade/local/pessoas — sem esses campos não há facetas) e C231 (acervo — sem acervo curado não há foto para publicar). Nenhuma das duas entra aqui.
- **Soft:** C234 (reconhecimento facial) é o sucessor declarado, fora desta fatia.

## Fora de escopo

- Reconhecimento facial (C234); upload público; edição de imagem.
- Analytics de vaidade / contador de visualizações.
- App/mobile nativo; reescrita da home.

## Rabbit holes de produto

- **Álbuns por evento mantidos à mão.** Se alguém "só completar": curadoria dupla (álbum + foto) e álbuns vazios por falta de gesto. **Corte neste item:** capítulos/álbuns derivados do catálogo curado, sem segunda curadoria paralela.
- **Lightbox social (like/comentário/compartilhar com PII).** Se alguém "só completar": o álbum vira rede social e superfície de moderação. **Corte neste item:** sem reações nem comentário; quem aparece é dado de legenda/filtro, não perfil.
- **Busca por conteúdo dentro da foto ("acha a faixa, a placa").** Se alguém "só completar": visão computacional entra aqui — já é C232. **Corte neste item:** esta busca consome os campos que C232 produz; aqui não se infere nada.
- **Sitemap de 6,5k páginas de foto.** Se alguém "só completar": cada foto vira página indexável e o SEO explode. **Corte neste item:** canônico/indexável é a rota do álbum com facetas; foto avulsa não ganha página própria nesta fatia.

## Questões em aberto (produto)

- **Quando abrir a superfície?** **Opções:** A) pós-eleição (04/10), com C231/C232 internas | B) antes, atrás de gate de curadoria com pull-down imediato | C) publicar agora sem ressalva. **Recomendação:** A — não abrir superfície pública nova nos dias finais de campanha; tratar C233/C234 como pós-eleição. _(assumido — validar com produto)_
- **Qual URL?** **Opções:** A) `/fotos` (proposto) | B) `/galeria` | C) `/acervo`. **Recomendação:** A — curto, em pt-BR e descreve o conteúdo; `/acervo` colide com o acervo interno de falas e `/galeria` é genérica; o gate confirma. _(assumido — validar com produto)_
- **Foto avulsa ou álbuns/capítulos por evento?** **Opções:** A) os dois níveis — navegação por álbum e busca que chega à foto | B) só foto avulsa | C) só álbuns. **Recomendação:** A — a foto é a unidade do resultado, mas capítulos dão contexto de evento e ajudam quem não sabe o que procura. _(assumido — validar com produto)_
- **Pessoa pública aparece com nome ou como filtro "aparições"?** **Opções:** A) nome canônico visível na legenda e como filtro | B) só filtro "pessoas que aparecem", sem nomear | C) sem faceta de pessoa. **Recomendação:** A — é a busca pedida pelo dono e o nome vem do catálogo curado; o canal de remoção é o contrapeso. _(assumido — validar com produto)_

## Referências

- GitHub Issue [#1368](https://github.com/fsolla/teqo/issues/1368)
- Design UI (gate): `docs/plans/album-fotos-publico-busca-ui-design.html`.
- Dependências: C231 (acervo) e C232 (catálogo com atividade/local/pessoas).
- Precedentes: `docs/plans/acervo-busca-por-sentido.md`, `docs/plans/central-conteudos-importar-perfil.md`, `docs/plans/acervo-paridade-busca-filtros-ui-design.html`.
- Arquivos-pista: `src/lib/contentPieceCatalog.ts` · `src/utilities/content/contentPieceReads.ts` · `src/app/(frontend)/conteudos/(catalog)/page.tsx` · `src/app/(frontend)/conteudos/[slug]/midia/route.ts` · `src/utilities/revalidateRequest.ts` · `src/utilities/speech/speechListUrl.ts` · `src/lib/speechFacets.ts`.
- `AGENTS.md` (contrato de URL público, mídia same-origin) · `AGENTS-public.md` (visibilidade eleitoral fail-closed).

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (achar a foto por data, município, atividade, pessoa ou termo, só com aprovadas); (2) appetite ~1–2 dias comporta a rota pública sobre o catálogo de C232, com facetas, busca, vazio, remoção e cache, sem construir o acervo; (3) persona, job e aceite verificáveis, incluindo acessibilidade; (4) direção no codebase é hipótese com precedentes nomeados; (5) zero decisão dura de engenharia (a rota literal é decisão de produto sujeita ao gate; schema, migration, cache e modelagem ficam no plano de implementação).
