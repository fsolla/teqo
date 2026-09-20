# Rádio 1313 na home — embed direto (S24)

Status: rascunho
Atualizado em: 2026-09-20
Issue: #1235
Priority: P2
Impeccable: B — encaixe/remoção na seção de som da home (substitui o card-facade pela moldura mínima do embed)
Design UI: docs/plans/radio-embed-direto-ui-design.html
Appetite: ~0,5–1 dia eng; um outcome verificável — a rádio toca a partir do embed direto, sem clique prévio
Responsável: —

## Intenção

A Rádio Jorge Solla 1313 na home hoje mora dentro de um card-wrapper com facade click-to-load: arte "Rádio online" com ondas, eyebrow "Sintonize com a gente", título, textos explicativos, aviso com escudo, botão "Ouvir a rádio" e estados de carregamento — o iframe do zeno.fm só monta depois do clique. O humano achou esse layout desnecessário: basta o embed direto do zeno.fm (`https://zeno.fm/player/jorge-solla-1313/`), carregado automaticamente desde o início do carregamento da página. O embed oficial já traz os detalhes da rádio (capa, nome, programação). A seção de jingles publicados e a página `/jingles` não mudam.

**Trade-off assumido (decisão do humano):** o auto-carregamento reverte de propósito a razão da facade do S22 (#1228) — o widget do zeno carrega Google Analytics `G-2T527NZWVM` e redes de anúncio em todo pageview. Isso passa a ser esperado, não um defeito: decisão explícita do humano, registrada com honestidade; o plano antigo é imutável e não é reaberto. Não coletamos PII nova; o visitante apenas acessa um serviço externo. **Sem linha de transparência (decisão do humano no gate):** o embed fica nu — sem aviso de terceiro, chip, badge ou escudo sob o player.

## Persona e fluxo

- **Persona / contexto:** visitante e militante que chega pela home no celular (link no WhatsApp, busca, indicação), com pressa e em conexão qualquer.
- **Job principal:** ouvir a Rádio Jorge Solla 1313 na home no primeiro play, sem um passo de "carregar player".
- **Fluxo desejado:** abre a home → rola até a seção de som → o embed oficial já está ali, tocável → dá play direto. Com jingles publicados, a grade e o "Ver todos" seguem abaixo; sem jingles, a rádio fica sozinha.
- **Anti-goals de produto:** não redesenha a seção de som; não vira player custom nem proxy/stream; não mexe nos jingles nem em `/jingles`; não autoplay com som; não promete analytics/contador de ouvintes; não cria framework de consent/CSP.

### Esboço de fluxo (B)

```text
[visitante na home] → rola até a seção de som
→ embed oficial da Rádio 1313 já montado e tocável (sem clique intermediário)
→ dá play direto · segue ouvindo enquanto rola
[zero jingles publicados] → rádio sozinha (comportamento da variante compact)
[com jingles] → grade + "Ver todos os jingles" → /jingles
```

### Design UI (B)

- Design UI (gate): `docs/plans/radio-embed-direto-ui-design.html` (cenas da seção com o embed direto, com 0 e N jingles, e o footprint reservado antes do iframe responder).

## Objetivo e aceite

- Ao carregar a home, o embed oficial do zeno já está montado e tocável, sem botão nem clique prévio.
- Os elementos do wrapper/facade somem: arte "Rádio online", eyebrow "Sintonize com a gente", textos explicativos, aviso com escudo, botão "Ouvir a rádio" e estados loading/loaded.
- A regra da seção de som permanece: rádio sempre visível; grade de jingles fail-closed por publicação (funciona com 0 publicados; kill switch do S21 valendo).
- Sem salto vertical perceptível ao carregar o iframe; celular primeiro, sem overflow horizontal a 390px; o embed nunca toca sozinho com som e mantém rótulo acessível.
- `/jingles` e o player dos jingles publicados ficam intocados.
- O site segue sem coletar PII e a home segue estática (cache tag `jingles`).

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhum dado nosso é apresentado ou coletado; a superfície é um player de terceiro (sem PII).
- **Decisões desbloqueadas:** N/A — a decisão é do visitante (ouvir agora), não leitura de números.
- **Forma:** N/A — sem dado agregado a definir.

## Dados da decisão (literais)

- ID `S24`; slug `radio-embed-direto`; tipo `feature`; Priority `P2`; Impeccable `B`; rota: a home `/` (sem rota nova).
- Embed a auto-carregar: `https://zeno.fm/player/jorge-solla-1313/`; página da rádio: `https://zeno.fm/radio/jorge-solla-1313/`.
- Estado de hoje em produção (verificado 2026-09-20): **0 jingles publicados** — a seção mostra a rádio sozinha na variante `compact`.
- Rastro de terceiros que passa a rodar em todo pageview da home: Google Analytics `G-2T527NZWVM` + redes de anúncio do widget zeno — assumido; sem PII nossa.
- Sem linha nem aviso de transparência sob o embed (decidido com o humano no gate): o player fica nu.
- Design UI (gate): `docs/plans/radio-embed-direto-ui-design.html`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** seção de som da home — `src/components/jingles/` (hoje `JingleHomeSection.tsx` renderiza `RadioFacade.tsx`, que sai) e, se preciso, `src/app/(frontend)/(home)/page.tsx`; CSS da facade em `src/app/(frontend)/styles.css` (`campaign-radio-art/wave/spinner`) tende a ficar órfão e deve sair junto.
- **Precedente a olhar:** S22 (#1228) em `docs/plans/jingles-radio-homepage.md` + `-impl.md`; a leitura cacheada da publicação (tag `jingles`) que alimenta a seção.
- **Risco de acoplamento:** manter a home estática/ISR; não tocar no player nem em `/jingles`; o spec e2e `frontend` roda em paralelo e não stuba zeno — o hermetismo dos testes que pinam a facade hoje terá de ser resolvido na execução (fixture só roteia youtube/facebook e falha em erro de console externo); e2e mede overflow a 390px.

## Dependências

- Nenhuma dura. Estação ativa no zeno.fm; S22 (#1228) entregue (decisão revertida de propósito). Design hi-fi aprovado no gate.

## Fora de escopo

- Consent/CSP/click-to-play global; analytics de reprodução; trocar o embed por outro provedor.
- Alterar a decisão de facade dos jingles publicados; qualquer mudança em `/jingles`.
- Player custom, proxy ou stream próprio.

## Rabbit holes de produto

- **Player custom ou proxy do stream.** Se alguém "só completar": vira projeto de player e infra de stream. **Corte neste item:** embed oficial do zeno.
- **Framework de consent/CSP global.** Se alguém "só completar": banner, categorias, política nova. **Corte:** embed oficial do zeno, nu, sem moldura de consent/aviso.
- **Analytics/contador de ouvintes.** Se alguém "só completar": API do zeno, polling, dado frágil. **Corte:** a rádio é um play, não um dashboard.
- **Redesenhar a seção de som.** Se alguém "só completar": craft da seção inteira, copy e headings. **Corte:** a mudança é remoção do wrapper + moldura mínima do embed; header/copy atuais ficam.

## Questões em aberto (produto)

- **Linha de transparência sob o embed (resolvido no gate):** não existe — o embed fica nu, sem aviso de terceiro. _(decidido com o humano no gate)_
- **Manter a variante compact (zero jingles)?** **Opções:** A) manter o comportamento da seção, com o embed direto no lugar do card | B) unificar os dois casos. **Recomendação:** A — validar no design.
- **O link externo "Abrir no Zeno" some?** **Opções:** A) some com o wrapper | B) manter ao lado do embed. **Recomendação:** A — o embed tem os próprios links.

## Referências

- GitHub Issue: a registrar (`S24`); S22 = Issue #1228 (entregue; decisão revertida de propósito, não reabrir).
- Design UI (gate): `docs/plans/radio-embed-direto-ui-design.html`
- `docs/plans/jingles-radio-homepage.md` e `docs/plans/jingles-radio-homepage-impl.md` — decisão original de facade (histórico; não editar).
- `src/components/jingles/RadioFacade.tsx`, `src/components/jingles/JingleHomeSection.tsx` — o que sai/encaixa.
- `tests/unit/radioFacade.unit.spec.tsx`, `tests/unit/jingleHomeSection.unit.spec.tsx`, `tests/unit/campaignHome.unit.spec.tsx`, `tests/e2e/frontend.e2e.spec.ts`, `tests/e2e/frontendJingles.e2e.spec.ts` — contratos que pinam a facade hoje.
- `AGENTS.md` — home pública estática/cache tag `jingles` e postura LGPD.
