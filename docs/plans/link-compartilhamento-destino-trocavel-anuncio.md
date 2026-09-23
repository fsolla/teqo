# Link de compartilhamento com destino trocável e página de anúncio da atividade

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1268
Priority: P1
Impeccable: D — superfície nova no site público (página de anúncio da atividade) + encaixe no cadastro do link
Design UI: docs/plans/link-compartilhamento-destino-trocavel-anuncio-ui-design.html
Appetite: ~2–3 dias eng; estender o cadastro do link + página pública nova + arquivo de calendário + testes; sem chat, analytics ou agendamento
Responsável: —

## Intenção

Hoje o link de compartilhamento (S19) aponta para um único destino fixo, definido por URL digitada, e quem clica cai direto nele — não existe sala de espera para antes de uma transmissão começar. No dia 03/10 faremos a última reunião da campanha antes da eleição, em Google Meet + YouTube: a equipe precisa trocar para onde o link leva em segundos (Meet enquanto há vaga, YouTube quando encher) e, antes de começar, oferecer uma página de anúncio da atividade — com a identidade do convite, um botão "Entrar" desativado até a transmissão ir ao ar, um jeito de pôr na agenda e outro de repassar. Nada disso pode ser específico do 03/10: qualquer link pode virar página de anúncio, configurado pelo painel.

## Persona e fluxo

- **Persona / contexto:** a equipe de comunicação (no dia, com o link já circulando no WhatsApp) e o visitante que recebe o link antes da transmissão começar.
- **Job principal:** trocar para onde o link leva sem digitar URL, e dar ao visitante uma página honesta — informativa enquanto não começou, e um clique até o destino quando começar.
- **Fluxo desejado:** pré-cadastra destinos com rótulo ("Google Meet", "YouTube") e escolhe o modo "Página de anúncio" → configura início, fim e local → compartilha `jorgesolla1313.com.br/<slug>` → o visitante vê o anúncio (botão "Entrar" desativado, agenda, compartilhar) → na hora, escolhe o destino "no ar" e salva → quem chega depois vai direto; quem já está na página vê o "Entrar" ativar → se o Meet encher, troca o "no ar" para o YouTube num clique.
- **Anti-goals de produto:** não vira agenda pública de eventos; não vira analytics/UTM; não vira CMS de página livre; não coleta dado nem pede consent; não é RSVP/inscrição.

### Esboço de fluxo (D)

```text
[visitante] recebe jorgesolla1313.com.br/<slug> no WhatsApp
→ [nada no ar] página de anúncio: título · imagem · data/hora/local · Entrar desativado · adicionar à agenda · compartilhar
→ [equipe escolhe o destino "no ar" no painel] · quem já está na página vê Entrar ativar (~1 min, sem recarregar)
→ [quem chega depois] cai direto no destino, sem interstício
→ [Meet enche] equipe troca o "no ar" para o YouTube → próximos cliques vão ao YouTube
→ [link despublicado] 404
```

### Design UI (D)

- Design UI (gate): `docs/plans/link-compartilhamento-destino-trocavel-anuncio-ui-design.html`

## Objetivo e aceite

- Destinos pré-cadastrados com rótulo; escolher o "no ar" é uma decisão + salvar, sem digitar URL. Nenhum no ar = estado de pré-transmissão.
- Modo por link: "Levar direto ao destino" (padrão; links existentes não mudam de comportamento) | "Página de anúncio".
- Na página de anúncio o visitante vê título, imagem, data/hora (pt-BR, fuso da Bahia) e local; o botão "Entrar" fica desativado e visível, com aviso curto de que ainda não começou.
- Quando a equipe põe um destino no ar, o link volta a levar direto ao destino, sem interstício; quem já está na página vê o botão ativar sozinho (em até ~1 min, sem recarregar) e o aviso vira "A transmissão começou" (recomendação — ver Questões em aberto).
- Adicionar à agenda: Google Agenda (link que abre o evento preenchido) + arquivo `.ics` (Apple/Outlook/desktop); sem data configurada, o botão não aparece — nunca arquivo vazio/quebrado.
- Compartilhar: o próprio link curto com o título da atividade — WhatsApp + copiar link, o padrão já usado no site.
- Fail-closed mantido: despublicado → 404; destino fora de `http`/`https` recusado no admin; modo "Levar direto ao destino" sem destino no ar é recusado no formulário com mensagem clara (o estado pré-transmissão só existe no modo "Página de anúncio"); sem Consent novo (não há PII).
- Agnóstico: nada hardcoded para 03/10 — qualquer link configura modo, destinos e dados do evento pelo painel.

## Dados (intenção)

- **Vou apresentar dados?** Não — a página mostra horário/local do evento, não números; sem contagem de cliques, analytics ou UTM nesta fatia.
- **Decisões desbloqueadas:** N/A — a decisão é operacional (para onde o link leva) e do visitante (entrar/agendar/repassar).
- **Forma:** N/A — sem dado agregado a definir.

## Dados da decisão (literais)

- Contrato de URL inalterado: `https://jorgesolla1313.com.br/<slug>` (1 segmento na raiz).
- Fail-closed mantido: despublicado → 404; destino inválido (não `http`/`https`) → recusado no admin; modo "Levar direto ao destino" sem destino no ar → recusa no formulário com mensagem clara; sem Consent novo (não há PII).
- Fuso `America/Bahia`; data/hora exibidas em pt-BR.
- Duração padrão quando o fim não é configurado: 2 horas.
- Rótulos dos modos (pt-BR): "Levar direto ao destino" (padrão) | "Página de anúncio".
- Rótulos do admin (pt-BR, fixados no design): "Modo do link", seção "Destinos" (rótulo + URL por destino), controle do dia "Destino no ar" (vazio = pré-transmissão) e seção "Dados do evento" (Início, Fim opcional, Local).
- Copy do estado desativado (proposta, design pode refinar): botão "Entrar" desativado + "A transmissão ainda não começou."; ao virar, o aviso vira "A transmissão começou".
- Data-limite do caso real: 03/10/2026 (última reunião antes da eleição).

## Direção no codebase (hipótese)

- **Áreas prováveis:** o cadastro do link (`src/collections/ShareLink.ts` e utilidades vizinhas), a página pública que já serve o link (`src/app/(frontend)/[type]/page.tsx` + `src/components/ShareLinkRedirect.tsx`), o gerador de calendário existente (`src/utilities/calendarFeed.ts`) e o precedente de compartilhar (`src/components/ContentShareButton.tsx`).
- **Precedente a olhar:** `docs/plans/links-compartilhamento-miniatura-og.md` (S19, o contrato atual); `/jingles` como molde de chrome/`data-theme` de página pública nova; `public/campaign-kit/README.md` para a marca.
- **Risco de acoplamento:** o site público não tem header/footer global — a página nova define o próprio chrome; não expor o cadastro de atividades da campanha (C151/PUB3 é outro item); sem Consent/PII; o comportamento dos links S19 existentes não pode mudar.

## Dependências

- Nenhuma dura de código.
- Design hi-fi aprovado no gate.
- Conteúdo real do link de 03/10 (imagem, horário, rótulos dos destinos) — comunicação, antes do dia.

## Fora de escopo

- Agenda pública de eventos (PUB3 #45 / `publicEvent` da atividade) — não expor a `activity` da campanha.
- Contagem de cliques/analytics/UTM (é o C213).
- Chat/perguntas ao vivo, embed do YouTube/Meet dentro da página, RSVP/inscrição.
- Lembretes/notificações, expiração/agendamento automático do link.
- Múltiplos links A/B, QR code, encurtador/domínio próprio, tradução.
- Editar o corpo da página como CMS (richText/página livre) — só os dados do evento + os três botões.

## Rabbit holes de produto

- **Virar agenda pública de eventos.** Se alguém "só completar": expor as atividades, filtros, SEO, página por evento. **Corte neste item:** só os dados do evento do próprio link; agenda é PUB3.
- **Virar painel de audiência.** Se alguém "só completar": cliques, pico de acessos, origem do tráfego. **Corte neste item:** C213; aqui não se mede nada.
- **Virar sala de transmissão.** Se alguém "só completar": embed do Meet/YouTube, chat, reações, contagem de espectadores. **Corte neste item:** a página anuncia e entrega o clique; a transmissão acontece na plataforma.
- **Virar máquina de agendamento.** Se alguém "só completar": virada automática por horário, expiração, lembretes. **Corte neste item:** a virada é decisão humana no painel; despublicar resolve.
- **Virar CMS da página.** Se alguém "só completar": richText, seções editáveis, layout livre. **Corte neste item:** título/descrição/imagem/horário/local + os três botões.

## Questões em aberto (produto)

- **O que o link faz quando um destino está no ar?** **Opções:** A) a página de anúncio segue sendo servida e todo mundo clica em "Entrar"; B) o link volta a levar direto ao destino, sem interstício (S19), e só quem já está na página vê o botão ativar. **Recomendação:** B — "direciono quem acessar o link" sem clique extra; a sala de espera é para antes. _(aprovado no gate — 2026-09-23)_
- **O botão "Entrar" antes de começar fica desativado e visível, ou escondido?** **Opções:** A) desativado e visível com aviso curto; B) escondido até haver destino. **Recomendação:** A — o visitante entende que o link é o certo e que ainda não começou; ao virar, ativa sem recarregar (até ~1 min). _(aprovado no gate — 2026-09-23)_
- **Como trocar o destino no dia?** **Opções:** A) continuar digitando a URL (como hoje); B) pool de destinos pré-cadastrados com rótulo e escolha do "no ar" sem digitar URL. **Recomendação:** B — trocar vira uma decisão + salvar; o pool pode ter N destinos. _(aprovado no gate — 2026-09-23)_
- **O modo é por link?** **Opções:** A) por link, com "Levar direto ao destino" como padrão e links existentes intactos; B) global para todos os links. **Recomendação:** A — link antigo não pode mudar de comportamento. _(aprovado no gate — 2026-09-23)_
- **Como adicionar à agenda?** **Opções:** A) Google Agenda (link) + arquivo `.ics`; B) só `.ics`; C) só Google. **Recomendação:** A — cobre celular (Google) e Apple/Outlook/desktop (`.ics`). _(aprovado no gate — 2026-09-23)_
- **O que o botão compartilhar compartilha?** **Opções:** A) o próprio link curto com o título da atividade (WhatsApp + copiar link, padrão do site); B) o link do destino (Meet/YouTube). **Recomendação:** A — quem repassa divulga o nosso link, que continua trocável. _(aprovado no gate — 2026-09-23)_
- **Quais dados do evento configurar?** **Opções:** A) início (data+hora), fim opcional (padrão 2h) e local texto livre, somados a título/descrição/imagem que já existem no link; B) só início e local; C) campos extras (mapa, endereço estruturado). **Recomendação:** A — cobre o anúncio sem virar cadastro de evento. _(aprovado no gate — 2026-09-23)_

## Referências

- GitHub Issue #1268
- Design UI (gate): `docs/plans/link-compartilhamento-destino-trocavel-anuncio-ui-design.html`
- `docs/plans/links-compartilhamento-miniatura-og.md` (S19) e seu impl — o link que esta fatia estende
- `docs/plans/c151-atividade-evento-publico.md` — adjacência (evento da atividade), não dependência
- `src/app/(frontend)/[type]/page.tsx` · `src/components/ShareLinkRedirect.tsx` · `src/utilities/calendarFeed.ts` · `src/components/ContentShareButton.tsx` · `public/campaign-kit/README.md`
- `AGENTS.md` — fail-closed e convenções do site público (URL, noindex, sem Consent sem PII)
