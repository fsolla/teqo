# C230 — Central de Conteúdos — importar publicações do perfil oficial (@depjorgesolla)

Status: rascunho
Atualizado em: 2026-09-25
Issue: #1362
Priority: P1
Impeccable: C — encaixe em tela existente (lista da Central)
Design UI: docs/plans/central-conteudos-importar-perfil-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável
Responsável: —

## Intenção

O dono pediu para alimentar a Central de Conteúdos com o Instagram @depjorgesolla. Hoje o caminho existe peça a peça (colar o link, C220), mas quem publica todo dia repetiria o gesto a cada post — e a varredura por scraping está proibida por decisão travada (C212 §Q3). O caminho oficial já está no repo (Graph API da própria conta, com cursor e `mediaUrl`) e o pipeline de catalogação também (C211/C220). Falta o gesto que puxa o perfil: listar as mídias do perfil próprio e pôr na Central, como Rascunho, só o que ainda não está — com resultado honesto e sem publicar nada. A eleição é 04/10.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`; `coordinator`/`candidate` também) na mesa, com a campanha correndo e o perfil publicando todo dia.
- **Job principal:** trazer para a Central o que o perfil oficial publicou, sem colar link a link.
- **Fluxo desejado:** abre `/campanha/comunicacao/conteudos` → clica "Importar do perfil" → a busca roda no perfil oficial → ao fim vê o resumo (novas / já estavam / falharam) → confere os rascunhos na lista → revisa, edita e publica o que quiser.
- **Anti-goals de produto:** não vira espelho automático do Instagram; não vira dashboard de mídia social; não baixa nem armazena mídia de terceiro; não cria peça gêmea; não encosta no site/board.

### Esboço de fluxo (C)

```text
[Central de Conteúdos] → "Importar do perfil"
  → lista as mídias recentes do perfil oficial (@depjorgesolla) pela API oficial
  → para cada post que ainda não está na Central: cria a peça (Rascunho) no pipeline existente
  → com arquivo extraível: baixa do perfil próprio, transcreve e cataloga
  → sem arquivo extraível (carrossel, áudio protegido): peça-link com motivo honesto
  → fim: "novas · já estavam · falharam com motivo" + rascunhos à disposição
[outcome: Central alimentada com as publicações recentes do perfil — sem duplicar e sem publicar nada]
```

### Design UI (C)

- Design UI (gate): `docs/plans/central-conteudos-importar-perfil-ui-design.html`

## Objetivo e aceite

- Com a credencial configurada, o botão na lista da Central importa as publicações recentes do perfil próprio; cada novidade vira Rascunho e aparece na lista.
- Ao fim de cada execução o operador vê o resumo honesto — **novas criadas / já estavam / falharam com motivo**; falha de rede/API nunca some em silêncio.
- Nada duplica: post que já está na Central — inclusive o que entrou por link manual, em qualquer grafia de URL — não gera gêmea; reexecutar não duplica.
- Peça nova usa o pipeline existente (mídia baixada do perfil próprio, transcrita, catalogada) ou, sem arquivo extraível, vira peça-link com motivo honesto — nunca "Falhou" por limitação da plataforma.
- Nada é publicado automaticamente; a curadoria decide, campos já curados não são sobrescritos, e valem os guardrails: só perfil próprio via caminho oficial — nunca scraping, terceiro ou stories; mídia de terceiro nunca é baixada; sem credencial a ação fica indisponível (fail-closed); token nunca em log; board/feed da home intocado.

## Dados (intenção)

- **Vou apresentar dados?** Não — é operação/curadoria, não analytics: sem agregado, KPI ou superfície nova. O resumo da execução é recibo operacional, não métrica.
- **Decisões desbloqueadas:** N/A — a decisão da assessoria é editorial ("o que revisar/publicar"), não numérica. **Forma:** N/A — sem números de engajamento/alcance do Instagram nesta tela.

## Dados da decisão (literais)

- **Gatilho e lugar:** botão "Importar do perfil" na lista da Central (`/campanha/comunicacao/conteudos`); nesta fatia a importação é **sob demanda** — nenhuma varredura agendada.
- **Gate/papéis:** `canReadCommunicationCatalog`; `communicator`/`coordinator`/`candidate` operam; `advisor`/`leader` negados (fail-closed).
- **Curadoria:** todo post importado entra como **Rascunho**; **nenhuma publicação automática**.
- **Fonte:** só o **perfil próprio** (`@depjorgesolla`) pela **API oficial** — **sem scraping**, **sem terceiro**, **sem stories**.
- **Dedupe:** a identidade é o **post do Instagram** (id/shortcode), não a grafia da URL; post já existente — inclusive o que entrou por link — não gera gêmea; reexecutar não duplica.
- **Sem arquivo extraível** (carrossel, áudio protegido): **peça-link com motivo honesto**, com contagem no resultado — não inventa arquivo e não some da conta.
- **Resumo por execução:** "novas criadas / já estavam / falharam com motivo" (falha nunca em silêncio). **Sem credencial:** ação indisponível com a linguagem do board — **"Instagram ainda não configurado"** (fail-closed).
- **Janela:** a primeira execução traz as mídias **recentes** do perfil (janela limitada; número final é decisão de implementação); nunca despeja o histórico inteiro — post antigo específico continua entrando pelo link (C220).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/socialFeed/` (dono do cliente Graph API — cursor, early-stop, `mediaUrl`); `src/utilities/content/` (resolução link→peça, job e agendador); actions `src/app/(campaign)/campanha/actions/contentPieces.ts` (ação nova, mesmo gate das demais); tela `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/page.tsx` + `src/components/campaign/content/`; access `src/utilities/access/contentPieces.ts`.
- **Precedente a olhar:** C211/C220 (pipeline, estados e vocabulário), C212 §Q3/Q4 (mecanismo: cursor, dedupe por id, estado próprio; veredito "não fazer" para scraping), C199 (`recordingScheduler.ts` — `after()` sem cron/fila).
- **Risco de acoplamento:** não guardar estado da varredura na global `SocialFeedSettings` (o hook de save roda o sync do board dentro da transação, com row lock); não tocar no board/feed da home (cache/snapshot/kill switch); `instagramFeed.ts` não pode importar `@payload-config` (gate de ciclos); nada de segunda peça/fila gêmea.

## Dependências

- **Soft:** S3 (board/feed, entregue) · C211 (#1254, entregue) · C220 (#1302, entregue) · C212 (investigação, entregue). Sem dependência dura.

## Fora de escopo

- Webhook + varredura automática diária/reconciliação — item irmão futuro (C212 §Q4); a fatia nasce preparada para cadência futura, mas nada é agendado aqui.
- YouTube e demais redes; stories (a edge de mídia não cobre); download de mídia de terceiro (permanente); auto-publicação; analytics/engajamento do Instagram (C213); redesenho do board/feed da home ou da tela da Central.

## Rabbit holes de produto

- **"Já que varre, importa as 10K / todo o histórico".** Se alguém "só completar": backfill em massa, cursor de meses, painel de progresso. **Corte:** janela recente; post antigo entra pelo link (C220).
- **"Vira dashboard da varredura".** Se alguém "só completar": tela de estado/cursor/token/kill switch próprios. **Corte:** nesta fatia o estado é mínimo e honesto; painel é do item futuro (C212 §Q4).
- **"A API não deu conta → scraping/terceiro".** Se alguém "só completar": crawler, sessão, yt-dlp. **Corte:** nunca; o resultado é peça-link com motivo + anexar arquivo.
- **"Publica o que importou".** Se alguém "só completar": auto-publicar recentes. **Corte:** tudo Rascunho; curadoria humana é regra do C211.
- **"Cria cadastro próprio de peça do Instagram".** Se alguém "só completar": segunda identidade/segunda fila. **Corte:** uma peça por post; dedupe pela identidade do post.

## Questões em aberto (produto)

- **Quando a varredura roda?** **Opções:** A) só sob demanda (botão, nesta fatia) | B) diária agendada já | C) webhook + diária. **Recomendação:** A — cabe no appetite e segue o precedente C199 (`after()`, sem cron/fila); o automático vira item irmão. _(assumido — validar com produto)_
- **Até onde vai a primeira importação?** **Opções:** A) janela recente limitada | B) tudo o que a edge permitir | C) uma página (~50). **Recomendação:** A — o recorte da campanha basta; o número é decisão da implementação.
- **O que fazer com mídia sem arquivo extraível?** **Opções:** A) peça-link com motivo honesto | B) deixar de fora com contagem | C) caminho alternativo/terceiro. **Recomendação:** A — não perde a peça nem mente; C é proibido.
- **Dedupe por quê?** **Opções:** A) identidade do post (id/shortcode) | B) URL canônica exata | C) sem dedupe. **Recomendação:** A — cobre grafias diferentes do mesmo post e a peça que já entrou por link.
- **Curadoria da importação?** **Opções:** A) tudo Rascunho | B) publicar recentes | C) lote com aprovação. **Recomendação:** A — regra do C211; publicar é ato humano.
- **Credencial ausente?** **Opções:** A) ação indisponível com "Instagram ainda não configurado" | B) rodar e falhar no meio | C) tela nova de configuração. **Recomendação:** A — fail-closed e mesma linguagem do board; C é fora (`SocialFeedSettings` já é o dono).

## Referências

- GitHub Issue [#1362](https://github.com/fsolla/teqo/issues/1362); Design UI (gate): `docs/plans/central-conteudos-importar-perfil-ui-design.html`.
- Planos irmãos: `central-conteudos-ingestao.md` (C211) · `central-conteudos-link-instagram.md` (C220) · `central-conteudos-varredura-instagram.md` (C212 §Q3/Q4).
- Arquivos-pista: `src/utilities/socialFeed/instagramFeed.ts` · `src/utilities/socialFeed/instagramSync.ts` · `src/globals/SocialFeedSettings.ts` · `src/utilities/content/contentPieceLink.ts` · `src/utilities/content/contentPieceJob.ts` · `src/utilities/content/contentPieceScheduler.ts` · `src/utilities/recordings/recordingScheduler.ts` · `src/app/(campaign)/campanha/actions/contentPieces.ts` · `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/page.tsx` · `src/components/campaign/content/AddContentPieceLinkDialog.tsx` · `AGENTS.md` (sem scraping/terceiro; credencial nunca em log).

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — um clique põe na Central os posts ainda-ausentes, sem duplicar e sem publicar nada.
2. Appetite declarado e a intenção cabe? **Sim** (~1–2 dias; agendador/webhook/backfill cortados).
3. Persona + job + aceite claros sem jargão de stack? **Sim**.
4. Direção no codebase é hipótese? **Sim** — áreas/pistas, sem schema/signature.
5. Zero decisões duras de engenharia no plano? **Sim** — cursor, estado, dedupe e campos ficam no plano de implementação.

**Score: 5/5.**
