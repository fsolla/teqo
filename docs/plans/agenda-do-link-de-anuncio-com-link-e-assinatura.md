# S41 — Agenda do link de anúncio: evento leva o próprio link, assinatura "Jorge Solla 1313" e fuso da Bahia

Status: rascunho
Atualizado em: 2026-09-24
Issue: #1335
Priority: P2
Impeccable: A — sem UI nova; muda só o conteúdo do evento gerado (Google Agenda e .ics)
Design UI: N/A — sem UI
Appetite: ~0,5 dia eng; os dois caminhos de agenda (Google e .ics) passam a levar o link do próprio evento, o sufixo de marca no título e o fuso da Bahia, sem tocar no cadastro nem na página
Responsável: —

## Intenção

O S29 pôs no ar a página de anúncio com o menu "Adicionar à agenda": quem recebe o link no WhatsApp pode guardar a atividade no próprio calendário antes da transmissão. O evento gerado, porém, sai mudo — não leva o link do anúncio (para voltar, conferir ou repassar dias depois), o título não carrega a assinatura da campanha, e o horário precisa estar ancorado no fuso da Bahia, para quem viaja ou compartilha com gente de outro fuso não ver hora errada. É ajuste de conteúdo do evento, não de tela: menu, rótulos e página ficam como estão.

## Persona e fluxo

- **Persona / contexto:** quem recebeu o link da atividade e quer guardá-la na agenda — no celular ou no desktop, possivelmente dias antes, com o link já perdido no meio da conversa.
- **Job principal:** pôr a atividade na própria agenda num evento que diga de onde ele veio, de quem é, e na hora certa da Bahia.
- **Fluxo desejado:** recebe `jorgesolla1313.com.br/<slug>` → "Adicionar à agenda" → escolhe Google Agenda ou baixa o `.ics` → o evento abre preenchido com o título assinado, o horário da Bahia e a descrição com o link do anúncio → salva → dias depois, volta ao anúncio pelo link que ficou dentro do próprio evento.
- **Anti-goals de produto:** não vira convite disparado por e-mail; não vira cadastro de evento completo; não coleta dado nem pede consent; não muda nada no cadastro do link nem na página.

## Objetivo e aceite

- Nos dois caminhos (Google Agenda e `.ics`), o evento leva o link do próprio anúncio, para quem o adicionou conseguir voltar, conferir ou repassar.
- O título do evento termina com a assinatura " - Jorge Solla 1313" (uma vez só).
- O evento fica ancorado no fuso da Bahia (UTC-3, sem horário de verão) — quem abre de outro fuso vê o horário certo da Bahia, o mesmo da página.
- O link entra na descrição nos dois caminhos; no `.ics` entra também no campo próprio de link do evento (o padrão de calendário para isso).
- A descrição configurada vem antes, separada do link por uma linha em branco.
- Sem URL canônica resolvida, o evento sai sem o link — nunca relativo ou quebrado — mantendo assinatura e fuso.
- Guardrails mantidos: duração padrão de 2h quando não há fim; sem Início o menu "Adicionar à agenda" não aparece; despublicado → 404.
- A página de anúncio (conteúdo, rótulos, botões) e o cadastro do link não mudam.

## Dados (intenção)

- **Vou apresentar dados?** Não — a entrega muda o conteúdo do evento gerado (link, assinatura e fuso); não há número, painel ou contagem nesta fatia.
- **Decisões desbloqueadas:** N/A — a decisão é do visitante (adicionar à agenda e reencontrar o anúncio).
- **Forma:** adiada ao plano de implementação — aqui só a restrição de produto: o link do evento é sempre a URL canônica do anúncio, nunca o destino (Meet/YouTube), que pode trocar.

## Dados da decisão (literais)

- Sufixo de marca, ao FIM do título, nos dois caminhos: `" - Jorge Solla 1313"` (espaço, hífen, espaço).
- Fuso do evento: `America/Bahia` (UTC-3, sem horário de verão).
- URL canônica do anúncio: `https://jorgesolla1313.com.br/<slug>` (mesmo contrato S19/S29 — nunca URL relativa/quebrada).
- Linha do link na descrição: `Página do evento: <url>`.
- O link entra na DESCRIÇÃO do evento nos dois caminhos e também no campo de URL do evento no `.ics` (a propriedade padrão de calendário para o link do evento).
- Descrição configurada vem antes, separada do link por uma linha em branco.
- Duração padrão de 2h quando não há fim, e "sem Início ⇒ menu de agenda não aparece": permanecem.
- Sem URL canônica resolvida ⇒ evento sai sem o link, mantendo assinatura e fuso.

## Direção no codebase (hipótese)

- **Áreas prováveis:** os builders puros dos dois caminhos (`src/lib/calendarEvent.ts`), o view model da página (`src/lib/shareLinkAnnouncement.ts`), o menu (`src/components/shareLink/ShareLinkAgendaMenu.tsx`), a rota do `.ics` (`src/app/(frontend)/[type]/evento.ics/route.ts`) e a página que monta o view (`src/app/(frontend)/[type]/page.tsx`).
- **Precedente a olhar:** a própria `[type]/page.tsx` resolve a URL canônica no servidor pelo global de metadata + utilitário de SEO (`src/utilities/seo.ts`); no cliente, `ShareLinkShareMenu.tsx:28` já usa `window.location.origin` para URL absoluta — o impl decide qual dos dois caminhos serve aqui. Fuso: `src/lib/campaignTime.ts` é o dono dos formatadores Bahia e `src/lib/googleCalendarEventMapping.ts:33-38` documenta UTC−3 fixo.
- **Risco de acoplamento:** não tocar no feed/sync da campanha (`src/utilities/calendarFeed.ts`, `src/lib/googleCalendarEventMapping.ts`); os testes que pinam o comportamento atual (`tests/unit/calendarEvent.unit.spec.ts`, `tests/unit/ical.unit.spec.ts`, `tests/unit/shareLinkAnnouncement.unit.spec.ts`, `tests/e2e/frontendShareLink.e2e.spec.ts:341-348`) acompanham o novo conteúdo.

## Dependências

- S29 (#1268, in-prod; código já em main) — nada bloqueia.

## Fora de escopo

- Campo novo no cadastro do link (descrição do evento, URL, etc.).
- Mudar rótulos ou o menu da página de anúncio.
- Agenda pública de eventos (PUB3) — expor/listar atividades.
- Google Calendar API e convites por e-mail.
- Analytics/UTM/encurtador de link.
- RSVP/lembrete/notificação.
- Endereço estruturado/mapa no evento (`location_name` etc.).

## Rabbit holes de produto

- **Virar cadastro de evento completo.** Se alguém "só completar": recorrência, convidados, múltiplas sessões, dia inteiro. **Corte neste item:** usar só os campos que o link já tem (título, descrição, início/fim, local).
- **Virar disparador de convite.** Se alguém "só completar": enviar convite por e-mail, integrar API do Google, acompanhar RSVP. **Corte neste item:** o visitante abre/baixa o evento no próprio calendário; nada sai do nosso servidor.
- **Virar agenda pública.** Se alguém "só completar": listar eventos, feed público, página por evento, exportar tudo. **Corte neste item:** é PUB3; aqui só o evento do próprio link.
- **Customizar o corpo da descrição do evento no admin.** Se alguém "só completar": rich text, templates por link, campos separados de descrição. **Corte neste item:** a descrição configurada + a linha do link; nada configurável a mais.

## Questões em aberto (produto)

- **Formato da linha do link na descrição?** **Opções:** A) `Página do evento: <url>` em linha própria; B) só a URL crua; C) URL + frase de destino ("Assista/participe: <url>"). **Recomendação:** A — diz o que é o link sem prometer transmissão (o link leva ao anúncio, não ao destino). _(assumido — validar no gate)_
- **Sufixo sempre, mesmo se o título já terminar com ele?** **Opções:** A) sempre acrescenta; B) não duplicar quando o título já termina com " - Jorge Solla 1313"; C) não duplicar se o nome aparece em qualquer posição. **Recomendação:** B — evita "…Jorge Solla 1313 - Jorge Solla 1313" sem mutilar um título que cite o nome no meio. _(assumido — validar no gate)_
- **O link também em campo próprio além da descrição?** **Opções:** A) sim no `.ics` (campo de URL do evento) e não no Google Agenda, que não tem campo para isso; B) só na descrição nos dois; C) forçar a URL no campo de local do Google. **Recomendação:** A — o `.ics` tem campo padrão que os leitores exibem; no Google Agenda a descrição é o lugar. _(assumido — validar no gate)_

## Referências

- GitHub Issue (a registrar)
- `docs/plans/link-compartilhamento-destino-trocavel-anuncio.md` (S29) e `docs/plans/link-compartilhamento-destino-trocavel-anuncio-impl.md`
- `src/lib/calendarEvent.ts` · `src/lib/shareLinkAnnouncement.ts` · `src/components/shareLink/ShareLinkAgendaMenu.tsx` · `src/app/(frontend)/[type]/evento.ics/route.ts` · `tests/e2e/frontendShareLink.e2e.spec.ts`
- `AGENTS-public.md`
