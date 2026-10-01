# S44 — Home — seção da Plenária da Vitória (divulgação e acesso)

Status: rascunho
Atualizado em: 2026-10-01
Issue: #1408
Priority: P1
Impeccable: C — seção nova na home pública (superfície nova dentro de página existente)
Design UI: docs/plans/secao-home-plenaria-da-vitoria-ui-design.html
Appetite: ~0,5–1 dia eng; um outcome verificável (a home divulga a plenária e leva ao link em um toque)
Responsável: —

## Intenção

A Plenária da Vitória acontece **amanhã, sexta 02/10/2026, às 18h (horário da Bahia), online** — e a home, a superfície mais visitada do site, não a anuncia. Hoje o convite só circula pelo link no WhatsApp; quem chega ao site não fica sabendo. Na reta final até 04/10, a home precisa empurrar esse encontro: uma seção curta que mostra o convite e leva ao link em um toque.

O evento já existe na produção como link de compartilhamento publicado (`/plenaria-vitoria`, modo anúncio). A seção **reflete o estado do link**: antes de ir ao ar, mostra o convite (imagem + dados do evento) e o botão **Adicionar à agenda** — a mesma agenda do link (Google Agenda + arquivo `.ics`, S29), sem botão de entrada; quando a equipe marca um destino no ar, a imagem de divulgação dá lugar ao **embed da live do YouTube** e o botão de entrada aparece — `Entrar na plenária` quando o destino ativo é o Google Meet, `Assistir no YouTube` quando é o YouTube. Quem decide o destino continua sendo o próprio link, sem deploy na home.

## Persona e fluxo

- **Persona / contexto:** simpatizante/militância abrindo o site no celular (link no WhatsApp, busca, indicação), a dois dias da eleição; quer saber onde se encontrar com o time e entrar rápido.
- **Job principal:** ver o convite da plenária e entrar nela em um toque, sem procurar link.
- **Fluxo desejado:** rola a home → vê a seção com título, data/hora da Bahia, "Online", descrição e imagem (pré-live: botão **Adicionar à agenda**, sem botão de entrada) → adiciona o evento na agenda em um toque (Google Agenda ou `.ics`) → quando a equipe marca um destino no ar, a seção troca sozinha a imagem pelo embed da live e o botão de entrada assume o lugar do de agenda → toca (`Entrar na plenária` no Meet, `Assistir no YouTube` no YouTube) → cai em `/plenaria-vitoria`, que leva ao destino no ar.
- **Anti-goals de produto:** não é segunda página de anúncio (compartilhar continua no link; a seção **reusa a agenda do próprio link**, não cria mecanismo novo nem menu próprio de agenda); não é agenda pública nem carrossel de eventos; o botão de entrada nunca aponta direto para a URL do Meet/YouTube (sempre via `/{slug}`); não é player próprio (o ao vivo é o embed oficial do YouTube); não cria botão de entrada antes de haver destino no ar; não coleta dado/RSVP; não duplica seções existentes; não redesenha a home; não cria campo de CMS/destaque genérico nesta fatia.

### Esboço de fluxo (C)

```text
[visitante na home] → seção "Plenária da Vitória"
  (título · data/hora Bahia · "Online" · descrição)
→ pré-live (nenhum destino no ar): imagem de divulgação + botão "Adicionar à agenda"
   (Google Agenda · arquivo .ics — a agenda do S29, sem mecanismo novo)
→ equipe marca um destino no ar (sem deploy na home):
   ├─ destino Google Meet  → embed da live do YouTube + botão "Entrar na plenária"  → /plenaria-vitoria → Meet
   └─ destino YouTube      → embed da live do YouTube + botão "Assistir no YouTube" → /plenaria-vitoria → YouTube
   (a seção acompanha a troca sem recarregar, como a página de anúncio do S29)
[link despublicado ou evento expirado] → a seção inteira some (fail-closed)
```

### Design UI (C)

- Design UI (gate): `docs/plans/secao-home-plenaria-da-vitoria-ui-design.html` — cenas mobile/desktop da seção nos três estados (pré-live com `Adicionar à agenda` e sem botão de entrada; ao vivo no Meet; ao vivo no YouTube com embed) e o estado ausente (despublicado/expirado).

## Objetivo e aceite

- A home pública ganha uma seção dedicada à Plenária da Vitória, visível **só enquanto o link estiver publicado e o evento não tiver expirado**: despublicada ou expirada, a seção não existe na página (fail-closed, sem promo velha).
- **Pré-live (nenhum destino no ar):** a seção mostra o convite — título, descrição, data/hora da Bahia, "Online" e a imagem de divulgação — com o botão **Adicionar à agenda** (Google Agenda + arquivo `.ics`, a mesma agenda do link no S29 — sem segundo mecanismo) e **sem botão de entrada** (não há para onde entrar).
- **Ao vivo:** com um destino marcado no ar, a imagem de divulgação dá lugar ao **embed da live do YouTube** (player oficial, nunca player próprio) e o botão de entrada assume o lugar do de agenda: `Entrar na plenária` quando o destino no ar é o Google Meet; `Assistir no YouTube` quando é o YouTube.
- **A seção acompanha o "no ar" sem recarregar** (mesmo contrato de ativação da página de anúncio do S29), sem deploy; o botão sempre leva a `/plenaria-vitoria`, que resolve o destino no ar — nunca à URL crua do Meet/YouTube.
- Kill switch sem deploy: despublicar o link esconde a seção; demais seções da home intocadas.
- Celular primeiro, sem overflow horizontal (o e2e da home mede); acessível (contraste, foco visível, botão operável por teclado); o embed não autoplaya com som.
- Sem coleta: nenhum dado/RSVP, nenhum rastreio novo.

## Dados (intenção)

- **Dados: N/A** — nenhuma métrica nova; a seção divulga um evento. **Decisões desbloqueadas:** o visitante decide entrar na plenária; a comunicação decide publicar/despublicar o link. Nada do visitante é coletado.

## Dados da decisão (literais)

- Evento em produção (link publicado): id `4`; slug `plenaria-vitoria`; caminho canônico `/plenaria-vitoria`; título `Plenária da Vitória`; modo `announcement`; `published: true`; `startsAt` `2026-10-02 21:00:00+00` (**sexta, 02/10/2026, 18h horário da Bahia**); `endsAt` vazio; local `Online`; imagem media id `171` (alt `Plenária da Vitória 1313`).
- Descrição (verbatim): "O time de Jorge Solla se encontra antes da vitória. Chama seu grupo para o 1313 e vamos juntos! ❤️"
- Destinos pré-cadastrados (nenhum ao vivo ainda): `Google Meet` → `https://meet.google.com/fyz-rurx-biv`; `Youtube` → `https://www.youtube.com/live/77bUgl7cvQ8`.
- Duplicata em produção: id `5`, slug `plenaria-da-vitoria`, mesmo conteúdo — dedupe é ops, fora deste item; esta entrega usa `plenaria-vitoria`.
- Estados da seção: **pré-live** (nenhum destino no ar) = imagem de divulgação + botão `Adicionar à agenda` (sem botão de entrada); **ao vivo no Meet** = embed da live do YouTube + botão `Entrar na plenária`; **ao vivo no YouTube** = embed da live + botão `Assistir no YouTube`.
- Agenda do pré-live: as duas opções já contratadas no S29 — Google Agenda (link preenchido com o evento) e arquivo `/{slug}/evento.ics` (`/plenaria-vitoria/evento.ics`); sem data (`startsAt`) a agenda não aparece.
- Embed do ao vivo (YouTube): vídeo `77bUgl7cvQ8` → player `https://www.youtube.com/embed/77bUgl7cvQ8` (o embed usa o destino do YouTube pré-cadastrado do link).
- Botão sempre para `/plenaria-vitoria` (nunca a URL crua do Meet/YouTube); rótulo segue o destino no ar.
- Regra de visibilidade: visível só se publicado E agora < `endsAt` (quando preenchido; senão `startsAt` + 2h — mesma convenção de duração do anúncio do S29); fora disso, não renderiza. _(assumido — validar com produto)_

## Direção no codebase (hipótese)

- **Áreas prováveis:** a home compõe seções em `src/app/(frontend)/(home)/page.tsx`; a leitura cacheada de share link (`src/utilities/shareLinkReads.ts`) e o anúncio (`src/components/shareLink/ShareLinkAnnouncement.tsx`, com o poll de ativação a cada ~30 s) mostram os dados/estados; a agenda já existe (`src/components/shareLink/ShareLinkAgendaMenu.tsx` — Google Agenda + `.ics`); o estado "no ar" sem recarregar já tem endpoint próprio (`src/app/(frontend)/api/share-link/[slug]/live/route.ts`, `{ target: { href, label } | null }`); a rota do link é `src/app/(frontend)/[type]/page.tsx`; estilos de seção em `src/app/(frontend)/styles.css`.
- **Precedentes a olhar:** `docs/plans/central-conteudos-secao-home.md` (S39 — seção nova na home, fail-closed a zero), `docs/plans/link-compartilhamento-destino-trocavel-anuncio.md` (S29 — modo anúncio, duração default 2h), `docs/plans/jingles-radio-homepage.md`.
- **Risco de acoplamento:** a home é estática/cacheada (leitura por tag da coleção de share links); não editar o cadastro do link, a página do anúncio nem as seções irmãs; o e2e da home verifica a ordem das seções; escrita direta no banco não busta o cache (só o admin revalida).

## Dependências

- Nenhuma (S19/S29 já entregues). Design hi-fi aprovado no gate.

## Fora de escopo

- Duplicata id `5` (`plenaria-da-vitoria`) — dedupe é ops.
- Mecanismo genérico de destaque/agenda de eventos (a agenda desta seção é a do próprio link, S29); countdown; compartilhar dentro da seção.
- Edições no cadastro do share link (`/plenaria-vitoria` e destinos ficam como estão).

## Rabbit holes de produto

- **"Já que tem seção, vira agenda".** Se alguém "só completar": carrossel de próximos eventos, CMS de eventos. **Corte neste item:** uma seção, um evento — a lista de eventos é outro produto.
- **"Cria campo de destaque por evento".** Se alguém "só completar": campo novo + migration para algo que dura um dia. **Corte:** slug fixo + `published` (questão 1, opção A).
- **"Linka direto ao destino para funcionar mais rápido".** Se alguém "só completar": Meet/YouTube no CTA. **Corte:** CTA sempre para `/{slug}`; a troca de destino é do link, sem deploy.
- **"Põe um countdown para urgência".** Se alguém "só completar": relógio regressivo, animação. **Corte:** data/hora no texto basta; urgência é da reta final, não de widget.

## Questões em aberto (produto)

- **Qual a fonte da seção?** **Opções:** A) slug fixo em código + `published` | B) campo "destaque na home" no share link (exige migration) | C) global da home com link digitado. **Recomendação:** A — entrega hoje, sem migration; o link já é o dono do dado. _(assumido — validar com produto)_
- **Como expira?** **Opções:** A) automática: `endsAt` quando houver, senão `startsAt` + 2h, mais kill switch de despublicar | B) só despublicar manualmente | C) datas fixas no código. **Recomendação:** A — sem risco de promo velha; B como rede de segurança. _(assumido — validar com produto)_
- **Onde fica na home?** **Opções:** A) logo após o hero | B) depois de "Acompanhe de perto" | C) antes da newsletter. **Recomendação:** A — máxima visibilidade na reta final; a seção some sozinha depois. _(assumido — validar com produto)_
- **Quando o embed da live entra?** **Opções:** A) com qualquer destino no ar — usa o destino do YouTube pré-cadastrado no link (recomendação, literal do pedido: "se a live já estiver começado, mostrar a live acontecendo") | B) só quando o destino no ar é o YouTube. _(assumido — validar com produto)_
- **A seção tem algum clique além da agenda antes do ao vivo?** **Opções:** A) não — pré-live é convite + `Adicionar à agenda`, sem link implícito nem título/imagem clicáveis (recomendação, mantém uma ação só) | B) título/imagem também clicáveis para `/plenaria-vitoria`. _(assumido — validar com produto)_
- **O botão de agenda some quando a live começa?** **Opções:** A) sim — o botão de entrada assume o lugar (recomendação: agenda é inútil depois que começou; um CTA primário por estado) | B) coexiste como ação secundária ao lado de `Entrar`/`Assistir`. _(assumido — validar com produto)_

## Referências

- GitHub Issue: #1408.
- Design UI (gate): `docs/plans/secao-home-plenaria-da-vitoria-ui-design.html`.
- `src/app/(frontend)/(home)/page.tsx`, `src/utilities/shareLinkReads.ts`, `src/components/shareLink/ShareLinkAnnouncement.tsx`, `src/app/(frontend)/[type]/page.tsx`
- `tests/e2e/frontendShareLink.e2e.spec.ts`, `tests/e2e/frontend.e2e.spec.ts` (ordem das seções da home); `docs/plans/central-conteudos-secao-home.md` (S39), `docs/plans/link-compartilhamento-destino-trocavel-anuncio.md` (S29), `docs/plans/jingles-radio-homepage.md`.
