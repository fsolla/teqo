# Jingles e rádio na home — a seção de som (S22)

Status: rascunho
Atualizado em: 2026-09-20
Issue: #1228
Priority: P2
Impeccable: C — nova seção numa página existente (a home pública)
Design UI: docs/plans/jingles-radio-homepage-ui-design.html
Appetite: ~1 dia eng; uma seção nova na home, sem rota nova
Responsável: —

## Intenção

Os jingles são da militância e a rádio é o canal ao vivo do mandato — os dois precisam estar na vitrine, que é a home. O S21 (Issue #1222, entregue em 2026-09-20) pôs os jingles em `/jingles` com link no rodapé e **deliberadamente não tocou a home** ("home e navegação principal intocadas nesta fatia"); na prática, quem chega em jorgesolla1313.com.br não vê nada de som. Este item corrige isso: uma seção na home, sem rota nova, com os jingles para ouvir/baixar e a rádio Jorge Solla 1313 (zeno.fm) — uma seção só de som, curta e no lugar mais visitado do site.

## Persona e fluxo

- **Persona / contexto:** visitante e militante que chega pela home no celular (link no WhatsApp, busca, indicação), com pressa e em conexão qualquer.
- **Job principal:** ouvir o jingle oficial e a rádio ali mesmo na home, e baixar o MP3 para repassar.
- **Fluxo desejado:** abre a home → rola até a seção de som → vê o card da rádio e os jingles com capa → dá play (um por vez) → baixa o MP3 → clica em "Ouvir a rádio" e o player do zeno carrega ali → opcional: "Ver todos os jingles" leva a `/jingles`.
- **Anti-goals de produto:** não vira player de streaming/loja nem discografia; não captura dados nem pede consent; não duplica cadastro de mídia (usa a collection existente do S21); não auto-carrega áudio ao abrir a home (`preload="none"`); não auto-carrega iframe de terceiro antes do clique na rádio (se facade); não redesenha a home.

### Esboço de fluxo (C)

```text
[visitante na home] → rola até a seção de som
→ card da rádio + jingles com capa e play (recomendação: até 3)
→ play num jingle (um por vez) · pausa · baixa o MP3
→ "Ouvir a rádio" (clique) → player do zeno carrega na seção
→ "Ver todos os jingles" → /jingles (S21)
[zero jingles publicados] → seção mostra a rádio; grade de jingles some (fail-closed)
```

### Design UI (C)

- Design UI (gate): `docs/plans/jingles-radio-homepage-ui-design.html` (a produzir após este plano)

## Objetivo e aceite

- Seção nova visível em `https://jorgesolla1313.com.br/` com os jingles publicados: capa, título, play (um por vez) e download MP3 com nome de arquivo legível.
- Rádio tocável: clique carrega o player oficial do zeno; pela recomendação (facade), nenhum request/script de terceiro antes do clique; link para abrir no zeno fica como alternativa no card.
- Kill switch individual dos jingles preservado: despublicar tira da home sem apagar arquivo; sem jingle publicado, a grade some e a rádio permanece.
- `/jingles` continua funcionando como página canônica indexável, com o link do rodapé; a seção da home linka "Ver todos" quando houver mais jingles que os exibidos.
- Home segue estática (nada de `payload.find` cru fora do cache existente); abrir a home não baixa áudio nem carrega iframe de terceiro.
- Celular primeiro: sem overflow horizontal (o e2e da home mede), capas otimizadas, usável em conexão ruim; LGPD sem formulário/consent/PII.
- **Estado de hoje em produção (verificado 2026-09-20):** 0 jingles publicados — `/jingles` responde no estado vazio (`noindex`) e a home não tem link. A seção da home só mostra a grade quando os jingles do S21 estiverem publicados (dependência dura abaixo).

## Dados (intenção)

- **Vou apresentar dados?** Não — superfície de mídia (áudio + capa); nenhuma PII coletada.
- **Decisões desbloqueadas:** N/A — a decisão é do visitante (ouvir/baixar/repassar), não leitura de números.
- **Forma:** N/A — sem dado agregado a definir.

## Dados da decisão (literais)

- ID `S22`; slug `jingles-radio-homepage`; tipo `feature`; Priority `P2`; Impeccable `C`; rota: a home `/` (sem rota nova).
- Design UI (gate): `docs/plans/jingles-radio-homepage-ui-design.html`.
- Página da rádio: `https://zeno.fm/radio/jorge-solla-1313/` (verificado agora: HTTP 200, título "Listen to Jorge Solla 1313 | Zeno.FM").
- Widget/player: `https://zeno.fm/player/jorge-solla-1313/` (verificado agora: HTTP 200, widget oficial `noindex`, sem X-Frame-Options — permite iframe; **carrega Google Analytics `G-2T527NZWVM` e redes de anúncio** — por isso a recomendação de facade).
- Fonte dos jingles: a collection existente do S21, publicados via `getPublishedJingleItems()` (cache tag `jingles`) — não recadastrar mídia nem criar coleção.
- Arquivos-fonte locais (`/home/fsolla/Downloads/Jingles/`): `Jorge Solla 1313 - Axé.mp3` (MP3, pronto) + capa `Jorge Solla 1313 - Axé.png`; `Jorge Solla 1313 - Forró.wav` (converter p/ MP3) + capa `Jorge Solla 1313 - Forró.jpeg`; `Jorge Solla 1313 - Pagodão.wav` (converter p/ MP3) + capa `Jorge Solla 1313 - Pagodão.png`. Títulos exibidos: `Axé`, `Forró`, `Pagodão`; ordem sugerida 1/2/3; `published` ligado.
- Contexto: `/jingles` (Issue #1222) e o link do rodapé ficam intocados; a home hoje é `https://jorgesolla1313.com.br/` (estática).

## Direção no codebase (hipótese)

- **Áreas prováveis:** seção nova na home — `src/app/(frontend)/(home)/page.tsx` e/ou componente em `src/components/jingles/`; CSS em `src/app/(frontend)/styles.css` no padrão `campaign-section-*` / tokens `[data-theme='campaign-site']`.
- **Reuso (não recriar):** `JinglePlayer`/`JingleViewModel` e `getPublishedJingleItems()` do S21 (card sem CSS acoplado à página). Rádio: client component facade que só monta o iframe do zeno após o clique.
- **Posição (recomendação):** depois de `CampaignStorySection`, antes de `CampaignCardsSection` — cards e newsletter seguem como blocos finais.
- **Precedente a olhar:** `CampaignStorySection` (iframe YouTube `nocookie`) e a linguagem do card em `docs/plans/jingles-site-publico-ui-design.html`.
- **Risco de acoplamento:** manter a home estática (usar o `unstable_cache` existente); e2e mede overflow horizontal da home; `src/components/jingles` mapeia para o e2e `frontendJingles`; não mudar o player nem a página `/jingles`.

## Dependências

- **Publicação dos 3 jingles no admin de produção (ops — pendente do S21).** Hoje há **0 publicados**: `/jingles` responde no estado vazio e a home não tem o link. Passos: (1) converter `Forró.wav` e `Pagodão.wav` para MP3 (o `Axé` já é MP3; WAV não vai ao site — decisão do S21); (2) subir capas (`Axé.png`, `Forró.jpeg`, `Pagodão.png`) e áudios na collection `jingle` do admin de produção, títulos `Axé`/`Forró`/`Pagodão`, `order` 1/2/3, `published` ligado; (3) conferir `/jingles` e depois a seção da home (os hooks revalidam a tag `jingles`). Sem essa publicação, a seção mostra apenas a rádio (fail-closed) — o código do S22 não publica conteúdo.
- Jingles publicados do S21 e estação ativa no zeno.fm.
- Design hi-fi aprovado no gate. Nenhuma dura de código.

## Fora de escopo

- Analytics de play/download, contagem de ouvintes e status "no ar".
- Share kit dos jingles; letras, transcrição ou páginas por jingle.
- Alterar o player existente ou a página `/jingles` (S21).
- Novo schema/collection ou segundo cadastro de mídia.
- Embed da rádio em outras páginas (nav/rodapé) e redesign do shell/home.

## Rabbit holes de produto

- **"Melhorar o player".** Se alguém "só completar": vira projeto de player custom. **Corte neste item:** reusar o player do S21 como está.
- **Contador de ouvintes / "no ar agora".** Se alguém "só completar": API do zeno, polling, dado frágil. **Corte:** a rádio é um botão de ouvir, não um dashboard.
- **Stream direto num `<audio>`.** Se alguém "só completar": stream fora do embed pode falhar por CORS/mixed content sem aviso. **Corte:** embed oficial do zeno sob clique + link externo.
- **Discografia/letras.** Se alguém "só completar": acervo e N páginas para manter. **Corte:** 3 jingles e um player.

## Questões em aberto (produto)

- **A página `/jingles` continua?** **Opções:** A) mantém a página (canônica, indexável, rodapé) e a home ganha a seção compacta | B) só a home; `/jingles` vira redirect/âncora. **Recomendação:** A — o contrato de URL acabou de subir; quebrar/redirecionar no mesmo dia é pior.
- **Rádio: iframe direto vs facade click-to-load?** **Opções:** A) facade — o iframe do zeno só carrega no clique (zero terceiro antes; mais controlável) | B) iframe direto como o do YouTube da story | C) só link externo. **Recomendação:** A — alinha com a postura de privacidade do repo e entrega o "embed tocável" pedido; B expõe GA/ads da zeno em todo pageview.
- **Quantos jingles na home?** **Opções:** A) todos os publicados | B) no máximo 3 + "Ver todos" quando houver mais. **Recomendação:** B — hoje são 3; a home não cresce sem limite.
- **Posição da seção?** **Opções:** A) depois de `CampaignStorySection`, antes de `CampaignCardsSection` | B) entre flags e story. **Recomendação:** A — mantém cards+newsletter como bloco final de conversão.
- **Seção com zero jingles publicados?** **Opções:** A) mostra a rádio e esconde a grade de jingles | B) a seção inteira some. **Recomendação:** A — a rádio é permanente; a grade é fail-closed por publicação (kill switch do S21 continua valendo).

## Referências

- GitHub Issue: a registrar para o S22 (`pnpm agent:register`); S21 = Issue #1222 (página `/jingles`, entregue em 2026-09-20).
- Design UI (gate): `docs/plans/jingles-radio-homepage-ui-design.html`
- `docs/plans/jingles-site-publico.md` e `docs/plans/jingles-site-publico-ui-design.html` — S21, linguagem do card e a decisão de "home intocada".
- `src/app/(frontend)/(home)/page.tsx`, `src/components/CampaignStorySection.tsx`, `src/app/(frontend)/styles.css`
- `tests/e2e/frontend.e2e.spec.ts`, `tests/e2e/frontendJingles.e2e.spec.ts`, `scripts/lib/e2e-affected-manifest.mjs`
- `AGENTS.md` / `AGENTS-public.md` — cache do site público e mídia (S3/Garage)
