# Links de compartilhamento com miniatura personalizada

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1207
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~1 dia eng; um fluxo novo pequeno no admin + uma rota pública
Responsável: —

## Intenção

A comunicação do mandato compartilha hoje links que não são nossos — plenárias no Google Meet, formulários, páginas externas — e o card que aparece no WhatsApp é o genérico do destino (ou nenhum). Quando é uma plenária da campanha, o convite chega sem identidade: sem título escolhido, sem imagem, sem descrição.

Queremos que a equipe consiga criar, dentro do painel, um link curto em `jorgesolla1313.com.br/<slug>` com título, descrição e imagem escolhidos, para que a miniatura do compartilhamento mostre exatamente o que foi configurado — e o clique leve direto ao destino. Hoje isso exigiria mexer no site a cada evento.

## Persona e fluxo

- **Persona / contexto:** equipe de comunicação do mandato (usuária Editor do painel, que já publica notícias, tags e mídia), montando um convite às pressas antes de divulgar no WhatsApp.
- **Job principal:** transformar um link externo em um cartão compartilhável com a identidade que ela escolher, sem depender de ninguém técnico.
- **Fluxo desejado:**
  1. No painel, cria um "link de compartilhamento" e preenche: slug, URL de destino (ex.: Google Meet), título, descrição e imagem (opcional; vazio = imagem padrão do site).
  2. O próprio formulário mostra as instruções de efetividade (tamanho/formato/limites de texto) e recusa slug duplicado/reservado ou destino inválido, com mensagem clara.
  3. Salva/publica e compartilha `jorgesolla1313.com.br/<slug>` no WhatsApp.
  4. A miniatura aparece com os dados configurados; quem clica chega ao destino na hora, sem tela intermediária perceptível.
- **Anti-goals de produto:** NÃO virar encurtador com analytics; NÃO ser um segundo cadastro de conteúdo; NÃO expor a URL de destino na miniatura; NÃO coletar dado de quem clica.

## Objetivo e aceite

- A equipe cria um link pelo painel e, ao compartilhar a URL curta no WhatsApp, a miniatura mostra o título, a descrição e a imagem configurados (o crawler do WhatsApp lê o HTML servido pelo nosso site — nada de miniatura montada só no navegador).
- O clique leva direto ao destino, sem interstício visível.
- Sem imagem configurada, a miniatura cai na imagem padrão do site (nunca quebrada/vazia).
- Fail-closed: link não publicado → 404; destino fora de `http`/`https`, slug duplicado ou slug reservado → recusado no admin com mensagem clara.
- A página do link é `noindex,nofollow` e nunca revela a URL de destino crua na descrição da miniatura.
- As instruções de imagem/texto ficam visíveis no próprio formulário, em pt-BR.

## Dados (intenção)

- **Vou apresentar dados?** Não — o link não coleta nem persiste dado de quem clica; v1 sem contagem de cliques, analytics ou UTM.
- **Decisões desbloqueadas:** N/A.
- **Forma:** N/A — sem dado apresentado.

## Dados da decisão (literais)

- Contrato de URL (produto): `https://jorgesolla1313.com.br/<slug>` — slug de 1 segmento na raiz.
- Destino aceito: apenas `http`/`https` (ex.: link do Google Meet), validado no admin.
- Slug duplicado ou reservado → recusado com mensagem clara. Reservados (colisão com rotas/valores do site): `cards`, `artigos`, `corte`, `privacidade`, `mandato-no-whatsapp`, `abaixo-assinado`, `api`, `admin`, `noticia`, `campanha`, `artigo`, `evento`.
- Página do link: `noindex,nofollow`.
- Instruções do admin (literais, pt-BR, visíveis no formulário):
  - Imagem: 1200×630 px (proporção 1,91:1), arquivo até 600 KB, formatos JPG/PNG, largura mínima 300 px; evitar imagens muito largas (proporção máx. 4:1).
  - Título curto: o WhatsApp mostra no máximo 2 linhas (~60–90 caracteres).
  - Descrição: ~80 caracteres já bastam; evitar passar de ~160.
  - A imagem precisa ser uma URL pública absoluta — o admin resolve isso sozinho ao subir o arquivo.
  - O WhatsApp guarda a miniatura em cache por URL: para trocar a miniatura de um link já compartilhado, usar um slug novo (ou aguardar o cache expirar).

## Direção no codebase (hipótese)

- **Áreas prováveis:** rotas públicas em `src/app/(frontend)/` (o segmento dinâmico existente já serve listagens e artigos; segmentos estáticos vencem o dinâmico — precedente: `/cards`); cadastro novo no grupo do admin `Publicações`; utilitários de SEO em `src/utilities/seo.ts` (`resolveSiteMetadata`, `toAbsoluteUrl`) e revalidação por tag em `src/utilities/documents.ts`.
- **Precedente a olhar:** `/corte/[id]` (OG custom + noindex/nofollow) como molde próximo de página de compartilhamento; `docs/plans/compartilhar-conteudos-home-whatsapp.md` (S4) que adiou "imagem OG por seção/card"; `docs/campanha/plano-site-campanha-2026.md` §7.1 (compartilhamento por seção com OG).
- **Risco de acoplamento:** o Next 15.4.11 não aceita duas pastas dinâmicas de nomes diferentes no mesmo nível (E337) — a rota nova não pode simplesmente nascer ao lado da existente; roteamento é decisão do plano de implementação. Sem Consent novo (não há dado pessoal) e sem infra de redirects.

## Dependências

- Nenhuma.

## Fora de escopo

- Expiração/agendamento automático do link — não pedido agora.
- QR code — não pedido agora.
- Contagem de cliques/analytics — não pedido agora.
- Encurtador genérico/domínio próprio — não pedido agora.
- Múltiplos destinos/A-B — não pedido agora.
- Pré-visualização custom do card no admin — não pedido agora.
- Tracking/UTM — não pedido agora.

## Rabbit holes de produto

- **Vira encurtador.** Se alguém "só completar" com analytics, domínio próprio e gestão de links, vira produto de infra. **Corte neste item:** link utilitário, sem métricas.
- **Vira segundo CMS.** Pedir corpo/richText/edição de página no link puxa a máquina de posts. **Corte neste item:** só título, descrição e imagem.
- **Cache do WhatsApp.** Prometer "trocar a miniatura" de um link já compartilhado é impossível sem slug novo. **Corte neste item:** orientação no formulário, sem mecanismo de invalidação.
- **Colisão de rota/slug.** Reservar mal os slugs quebra URLs existentes do site. **Corte neste item:** lista de reservados explícita + recusa no admin.

## Questões em aberto (produto)

- **Imagem por upload no admin ou URL externa?** **Opções:** A) upload; B) URL externa; C) ambos. **Recomendação:** A — upload pelo painel, com fallback para a imagem padrão do site; URL externa cria um jeito fácil de quebrar a miniatura. _(assumido — validar)_
- **O clique deve ser instantâneo, sem tela intermediária?** **Opções:** A) sim; B) página intermediária com botão. **Recomendação:** A — instantâneo; a miniatura customizada exige HTML nosso servido aos crawlers, mas a pessoa não pode perceber tela alguma. _(assumido — validar)_
- **Quem gerencia os links?** **Opções:** A) Editores (comunicação); B) só admin. **Recomendação:** A — mesma gente que já publica notícias. _(assumido — validar)_
- **Agrupar no admin junto de `Publicações`?** **Opções:** A) sim; B) grupo próprio. **Recomendação:** A — é material de comunicação, ao lado de posts e mídia. _(assumido — validar)_
- **Expiração/agendamento automático?** **Opções:** A) fora da v1; B) agendar no MVP. **Recomendação:** A — despublicar manualmente resolve; agendamento vira rabbit hole. _(assumido — validar)_

## Referências

- GitHub Issue #1207
- Design UI (gate): N/A — sem UI
- `src/app/(frontend)/corte/[id]/page.tsx` e `src/utilities/seo.ts` — precedente de OG custom + noindex
- `docs/plans/compartilhar-conteudos-home-whatsapp.md` (S4) — adiou OG por seção/card
- `docs/campanha/plano-site-campanha-2026.md` §7.1 — compartilhamento por seção com OG
- `AGENTS-public.md` — convenções do site público (OG, revalidação, cache)
