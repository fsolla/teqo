# S32 — Analytics dos cards personalizados: quantos e quais

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1273
Priority: P2
Impeccable: B — encaixe no resumo da home interna (contadores por modelo), sem tela nova
Design UI: docs/plans/cards-analytics-ui-design.html
Appetite: ~0,5–1 dia eng (depois do C213)
Responsável: —

## Intenção

O funil de cards personalizados (S13/S14/S15 e os modelos novos de S30/S31) roda 100% no aparelho do visitante, sem conta e sem coletar nada sobre quem usa — decisão de privacidade que continua valendo. O efeito colateral é que a campanha não sabe se o funil é usado nem quais modelos circulam: o dono pediu "medidas de quantas pessoas estão usando e quais". Responder à pergunta útil não exige identificar ninguém — basta contar downloads por modelo, de forma anônima e agregada. O C213 (#1258) já desenha um mecanismo mínimo de eventos anônimos para a Central de Conteúdos; este item faz o card ser mais um assunto do mesmo mecanismo, nunca um segundo analytics.

## Persona e fluxo

- **Persona / contexto:** coordenação e assessoria (staff) na home interna `/campanha`, decidindo o que divulgar e em que modelo investir; quem gera o evento é o visitante anônimo do funil público.
- **Job principal:** ler, por modelo de card, quantos downloads aconteceram desde o lançamento, e decidir qual modelo divulgar/reforçar (e, nos modelos com escolha estadual, qual dobradinha está sendo promovida).
- **Fluxo desejado:** abre a home interna → vê o bloco compacto "Cards" com o contador de downloads de cada modelo, lado a lado → lê qual modelo puxa o uso do funil → decide reforçar, divulgar de novo ou aposentar um modelo.
- **Anti-goals de produto:** não é analytics de site (sem pageview, funil, origem); não é perfil de visitante (sem cookie, IP, user-agent, identidade ou rastreio); não é dashboard nem rota nova; não mede abertura de galeria, prévia ou nada dentro da foto/recorte local.

### Esboço de fluxo (B)

```text
[visitante baixa o PNG] → evento anônimo "Download do card" no mecanismo do C213 (model id + slug do estadual quando houver)
[staff] home interna → bloco "Cards" (contadores por modelo, lado a lado) → decide o que divulgar/reforçar
[falha na contagem] o download segue idêntico e imediato — contador a menos é aceitável
```

### Design UI (B)

- Design UI (gate): `docs/plans/cards-analytics-ui-design.html` — cena do bloco compacto no resumo da home, com e sem dados, em desktop e mobile.

## Objetivo e aceite

- O download de qualquer card conta uma vez um evento anônimo "Download do card", com o model id do card; nos modelos de escolha estadual (S30/S31) o evento leva também o slug do estadual escolhido.
- A superfície interna mostra, por modelo, o contador absoluto acumulado desde o lançamento, lado a lado; sem índice único de "usos", sem %, sem série/tendência, sem funil/pageview.
- Honestidade do dado: os números medem downloads, não pessoas — a superfície não sugere visitantes únicos (impossível sem identidade) nem mistura as duas leituras.
- Não conta abertura da galeria nem prévia renderizada; só o download concluído (arquivo gerado e entregue ao visitante).
- Privacidade: evento estritamente anônimo e agregado — sem PII, sem IP persistido, sem cookie/identidade, sem user-agent, sem rastreio entre páginas ou entre modelos; nenhum `Consent` novo.
- Fail-soft: o download nunca é bloqueado nem atrasado pela contagem; falha no evento é invisível ao visitante; nada da foto ou do recorte local é tocado por telemetria.
- Mesmo mecanismo do C213 (#1258) — nenhuma collection/endpoint paralelo; sem o C213 entregue não há onde escrever nem onde ler.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — contadores anônimos por modelo de card no resumo da home interna.
- **Decisões desbloqueadas:**
  - Coordenação e assessoria: qual modelo de card divulgar/reforçar e se vale manter um modelo com pouca saída.
  - Coordenação: qual dobradinha está sendo promovida nos modelos com escolha estadual (S30/S31) — o slug escolhido é o sinal.
  - Coordenação: ler se o funil de cards como um todo está sendo usado (soma dos downloads por modelo — número de downloads, nunca de pessoas).
- **Forma:** _adiada ao plano de implementação_ — restrições: contagens absolutas por modelo, lado a lado e na ordem natural do catálogo; sem índice "usos", sem %, sem série/tendência, sem funil/pageview.

## Dados da decisão (literais)

- Um único pipeline anônimo de analytics — o do C213 (#1258); o card é um assunto do mesmo mecanismo, nunca uma collection/endpoint paralelo. Dependência dura do C213.
- Evento v1: "Download do card" — disparado uma vez quando o visitante baixa o PNG gerado; carrega o model id do card e, nos modelos por estadual (S30/S31), o slug do estadual escolhido. Abertura da galeria e render da prévia NÃO contam no v1.
- Contadores por modelo de card, lado a lado e absolutos; sem índice único de "usos", sem %, sem série/tendência, sem funil/pageview, sem ranking além da ordem natural dos contadores.
- Guardrail de honestidade: contagens anônimas medem downloads, não "pessoas"; sem identidade não existe visitante único — a superfície não pode sugerir isso.
- Superfície recomendada: bloco compacto "Cards" no resumo da home da campanha (precedente `CampaignHomeSummary`/`CampaignMetricStrip`, papéis de staff) — sem rota nova, sem dashboard. A comunicação (role `communicator`, cuja home é a vertical Comunicação) veria depois, pela própria vertical, se o produto pedir; a superfície do v1 é a home staff.
- Privacidade: sem PII, sem IP persistido, sem cookie/identidade, sem user-agent, sem rastreio entre páginas/modelos; sem `Consent` novo; estritamente anônimo e agregado.
- Fail-soft: o download nunca é bloqueado nem atrasado pelo contador — contagem a menos é aceitável, dado de visitante não.
- Os modelos que incluem escolha de estadual contam o mesmo evento de download com o slug do estadual (qual dobradinha está sendo promovida é uma decisão que a campanha quer).

## Direção no codebase (hipótese)

- **Áreas prováveis:** o caminho de download de `src/components/cards/CardComposer.tsx` (o evento sai daqui, sem bloquear), o catálogo `src/lib/cardModels.ts` como lista de modelos, e o resumo da home (`src/components/campaign/dashboard/CampaignHomeSummary.tsx`, hoje alimentado por `src/utilities/campaignDashboardData.ts`).
- **Precedente a olhar:** `docs/plans/central-conteudos-analytics.md` (C213 — o mecanismo, a agregação e o idioma de superfície), `src/components/campaign/shared/CampaignMetricStrip.tsx` (molde do bloco de contadores) e `src/collections/CampaignVoteSummarySnapshot.ts` (contagem agregada sem dashboard).
- **Risco de acoplamento:** a contagem é acessória — atraso ou falha do C213 não pode segurar o funil; nenhum identificador de visitante nasce do lado do card; nada de tocar na foto ou no recorte que roda no aparelho.

## Dependências

- **C213 (#1258)** — dura: o pipeline de eventos anônimos e o idioma de superfície interna precisam existir primeiro.
- **S30/S31** — suave: os modelos novos apenas somam model ids e slugs ao contador.

## Fora de escopo

- Segundo mecanismo de eventos, serviço de analytics (Umami/Plausible) ou retomada de `@vercel/analytics`; cookie, identidade, sessão, banner de consentimento ou `Consent` novo.
- Contar abertura de galeria, prévia renderizada, modelo escolhido no estúdio ou qualquer passo dentro do compositor; medir a foto ou o recorte local (a imagem nunca sai do aparelho e não é tocada por telemetria).
- Dashboard, rota `/campanha/cards`, gráfico, série/tendência, exportação, alerta, lista por visitante ou índice único de "usos".
- Visão da comunicação no v1 (follow-up registrado: pela vertical, se o produto pedir).

## Rabbit holes de produto

- **"Quero saber quantas pessoas usam".** Se alguém "só completar": cookie, session id, "visitante único" — métrica que não existe sem identidade. **Corte neste item:** contador de downloads, agregado, dito honestamente.
- **Virar dashboard de cards.** Se alguém "só completar": rota própria com gráfico, série e ranking. **Corte neste item:** bloco compacto na home staff, contadores absolutos por modelo.
- **Medir o funil inteiro.** Se alguém "só completar": pageview, modelo escolhido, prévia, abandono. **Corte neste item:** só o download; abertura, prévia e estúdio fora.
- **Identificar quem compartilha.** Se alguém "só completar": gravar o nome/foto do card ou inferir perfil pelo uso. **Corte neste item:** zero PII; a foto nunca sai do aparelho.
- **Segunda superfície "só para a comunicação".** Se alguém "só completar": bloco novo na vertical da comunicação no v1. **Corte neste item:** home staff agora; comunicação depois, pela vertical, se o produto pedir.

## Questões em aberto (produto)

- **Onde os contadores aparecem?** **Opções:** A) bloco compacto no resumo da home da campanha, staff (recomendado) | B) na lista de peças do C211, ao lado dos contadores por peça do C213 (força os cards a uma lista a que não pertencem) | C) rota própria `/campanha/cards` (rejeitada — superfície nova de dashboard; a doutrina do C213 evita). **Recomendação:** A. _(assumido — validar com produto)_
- **O que conta?** **Opções:** A) só o download (recomendado — o momento em que o visitante leva o card) | B) download + modelo selecionado no estúdio (mede interesse x conversão, com mais ruído). **Recomendação:** A. _(assumido — validar com produto)_
- **Granularidade:** A) acumulado por modelo desde o lançamento (recomendado no v1, espelha o C213) | B) janela de tempo (só se alguém pedir "o que está circulando agora"). **Recomendação:** A. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1258 (C213 — dependência dura)
- Design UI (gate): `docs/plans/cards-analytics-ui-design.html`
- `docs/plans/central-conteudos-analytics.md` — o mecanismo e a superfície que este item integra
- `src/components/campaign/dashboard/CampaignHomeSummary.tsx`, `src/components/campaign/shared/CampaignMetricStrip.tsx`, `src/collections/CampaignVoteSummarySnapshot.ts` — precedentes de superfície/rollup
- `src/components/cards/CardComposer.tsx`, `src/lib/cardModels.ts` — onde o download acontece e o catálogo de modelos
- `docs/plans/cards-time-de-voce.md`, `docs/plans/cards-estadual-dobradinha.md`, `docs/plans/cards-colinha.md` — os modelos que o contador separa

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (download contado e contadores por modelo na home staff); (2) appetite ~0,5–1 dia cabe porque reusa o mecanismo do C213; (3) persona, job e aceite em linguagem de produto, com o guardrail de honestidade explícito; (4) direção no codebase é hipótese com precedentes abertos; (5) zero decisão dura de engenharia — shape da collection, endpoint e agregação ficam no C213/implementação.
