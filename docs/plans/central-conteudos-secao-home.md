# S39 — Home — seção divulgando a Central de Conteúdos

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1305
Priority: P1
Impeccable: C — seção nova na home pública (superfície nova dentro de página existente)
Design UI: docs/plans/central-conteudos-secao-home-ui-design.html
Appetite: ~2–3 dias eng; um outcome verificável (a home leva à Central com peças do território do visitante; a seção some quando não há peça publicada)
Responsável: —

## Intenção

A Central de Conteúdos (`/conteudos`, S27) está no ar com as peças "Peça voto pra Solla 1313", mas quem chega na home — o lugar mais visitado do site — só a descobre pelo link condicional do rodapé e pelo selo local da própria peça. Na reta final até 04/10, a home precisa empurrar o eleitor para a Central: uma seção curta que mostre peças do **território do visitante** (para ele se reconhecer e repassar) e o leve para lá. A localização é resolvida pelo próprio visitante — GPS quando acessível, senão IP —, sem guardar nada.

Esta seção **supersede a decisão D7 do S27** ("Descoberta (rodapé + selo; sem seção nova)", `docs/plans/central-conteudos-publica-impl.md:87-91`), que rejeitou a seção nova na home por estar fora do escopo daquele item. A reabertura é decisão de produto do dono (pedido do operador); o rodapé e o selo local do S27 permanecem como estão — este item só acrescenta a seção.

## Persona e fluxo

- **Persona / contexto:** eleitor/simpatizante que abre jorgesolla1313.com.br no celular (link no WhatsApp, busca, indicação) e quer ajudar, mas não sabe onde pegar material nem o que escrever; o que o convence é ver o material do lugar dele.
- **Job principal:** descobrir que existe uma Central de peças oficiais de voto, reconhecer o material do seu território e chegar nela em um toque.
- **Fluxo desejado:** rola a home → a seção resolve a localização (GPS se acessível, senão IP; sem localização, segue) → vê até 3 peças publicadas do seu município (completando com a região e, se faltar, recentes) → toca numa peça ou no CTA "Ver todas as peças" → cai em `/conteudos` → baixa/compartilha dali (fluxo do S27).
- **Anti-goals de produto:** não é uma segunda Central nem catálogo paralelo (quem cataloga é o interno, C211); não duplica a seção S3 "Acompanhe de perto" (feed de redes/artigos) nem a seção de cards logo acima — **cards personalizáveis nunca são amostra**; não captura dado, não pede login, não guarda/loga a localização e não adiciona rastreio (analytics é C213); não re-hospeda mídia; não autoplaya áudio/vídeo; não redesenha a home.

### Esboço de fluxo (C)

```text
[visitante na home] → a seção resolve a localização
  (GPS se acessível · senão IP no servidor · senão desconhecida — nunca guarda nem loga)
→ até 3 peças publicadas do município do visitante
  (sem peça local: completa com a região; ainda faltando: recentes; sem localização: recentes)
→ nunca cards personalizáveis como amostra (a seção anterior da home já os mostra)
→ toca numa peça (mídia só no toque) ou no CTA "Ver todas as peças" → /conteudos
[zero peças publicadas] → a seção inteira some (fail-closed)
[localização indisponível/fora da Bahia] → recentes, sem erro e sem prompt insistente
```

### Design UI (C)

- Design UI (gate): `docs/plans/central-conteudos-secao-home-ui-design.html` — cenas mobile/desktop da seção na home: peças do território, fallback sem localização, uma peça só, zero peças (seção ausente) e o estado de resolução da localização (sem spinner eterno). Revisão do gate: a primeira versão não tinha seleção por localização nem excluía os cards.

## Objetivo e aceite

- A home pública ganha uma seção dedicada à Central, visível só quando há peça publicada: sem peça, a seção não existe na página (fail-closed a zero, mesma condição do link do rodapé hoje).
- **Amostra por território do visitante:** a seção mostra até 3 peças publicadas do município do visitante; se não houver peças locais suficientes, completa com a região e, ainda faltando, com as mais recentes; sem localização ou fora da Bahia, mostra as mais recentes.
- **Localização sem rastro:** GPS só quando acessível (permissão já concedida ou affordance explícita — ver questão (a)); senão IP resolvido no servidor; **nunca persistir, logar ou setar cookie** com a localização ou o IP; nada de PII.
- **Cards personalizáveis nunca são amostra:** a seção anterior da home (`CampaignCardsSection`) já os mostra; peças publicadas de qualquer tipo (inclusive tipo card de arquivo) podem ser amostra.
- A seção leva à Central: CTA principal para `/conteudos` e prévia leve das peças (foto) ou só chamada de play (vídeo/áudio) — nada carrega sozinho.
- Kill switch instantâneo: despublicar uma peça reflete na seção sem deploy (mesmo contrato de cache/tag do catálogo, `contentPieces`).
- Sem autoplay, sem mídia pesada na abertura da home (contrato do S27); seção distinta do S3 e da seção de cards; sem rastreio novo; demais seções da home intocadas.
- **A seção é por visitante** (localização): não pode ser servida no mesmo HTML estático compartilhado do resto da home — o executor decide o mecanismo (resolver no cliente após a localização, ou render no servidor por IP), mantendo o resto da home como está.
- Celular primeiro: sem overflow horizontal (o e2e da home mede), usável em conexão ruim; nenhuma espera bloqueia o resto da home (a seção pode aparecer depois).

## Dados (intenção)

- **Dados: N/A** — a seção é superfície de descoberta; nenhum número, contador ou ranking. **Decisões desbloqueadas:** o visitante decide entrar na Central (e o que pegar lá); a comunicação decide o que publicar/despublicar. Nenhum dado do visitante é coletado ou guardado.

## Dados da decisão (literais)

- Item `S39`; slug `central-conteudos-secao-home`; tipo `feature`; Priority `P1`; Impeccable `C`.
- Condição da seção: **sem peça publicada → a seção inteira não aparece** (mesma condição do link "Conteúdos" no rodapé, hoje via `hasPublishedContentPieces`).
- CTA principal: `Ver todas as peças` → `/conteudos`.
- Conteúdo: **até 3 peças publicadas**, na ordem de seleção **município do visitante → região → mais recentes**; sem localização/fora da Bahia → mais recentes.
- Exclusão literal: **cards personalizáveis (os itens sintéticos dos 6 modelos) nunca entram como amostra** — a seção logo acima (`CampaignCardsSection`) já os mostra.
- Localização: GPS só se acessível (permissão já concedida ou affordance explícita); senão IP no servidor; **proibido persistir/logar/cookiar** localização ou IP; fora da Bahia ou indisponível → recentes.
- Sinal de IP: a viabilidade de resolver **município** pelo IP no deploy (headers do túnel Cloudflare e/ou fonte de geo-IP) é **a confirmar na implementação** — nunca estimada; se só resolver país/estado, a seleção degrada para região/recentes.
- Convenção das seções irmãs da home: `data-home-section` — valores existentes `hero`, `proof`, `contents`, `problem`, `flags`, `story`, `sound`, `cards`, `newsletter`; a seção nova segue a convenção (valor definido no plano de implementação).
- Cache/kill switch: mesma tag de listagem do catálogo (`contentPieces`), revalidada no publish/unpublish; a seleção por localização não entra no cache compartilhado.
- **Supersessão:** D7 do S27 (`docs/plans/central-conteudos-publica-impl.md:87-91`), opção A (rodapé + selo; sem seção nova), rejeitava a opção B (seção nova na home). Este item reabre e adota a seção nova; rodapé e selo local do S27 permanecem.
- Escopo do S27 intocado: filtros, busca, páginas de peça, share e mensagens de voto continuam como entregues.

## Direção no codebase (hipótese)

- **Áreas prováveis:** a home compõe seções hardcoded em `src/app/(frontend)/(home)/page.tsx:127-251`; a seção nova é um componente no molde de `JingleHomeSection` (`data-home-section="sound"`, "Ver todos" → `/jingles`) e `CampaignCardsSection` (`data-home-section="cards"`); a seleção local usa as facetas já existentes da peça (município/região, `src/lib/contentPieceCatalog.ts`) sobre a leitura pública cacheada (`src/utilities/content/contentPieceReads.ts`).
- **Precedentes de localização a olhar:** `src/lib/municipalityProximity.ts` (ponto → município/ZE, fora da Bahia, mais próximo — puro e testado), `src/utilities/campaignGeolocation.ts` e `src/components/campaign/shared/useNearestMunicipalitySlug.ts` / `NearestMunicipalityCard.tsx` (B14, geolocalização no dashboard staff — atenção: lá resolve só entre os municípios do portfólio; aqui o universo é o catálogo inteiro), e a extração de IP do túnel em `src/utilities/content/contentEventRateLimit.ts:33-37` / `src/utilities/ai/themeSearchGuard.ts:22` (`cf-connecting-ip` → `x-forwarded-for` → `x-real-ip`).
- **Descoberta hoje:** link condicional no rodapé (`CampaignFooter.tsx:34-37,65-67`) + selo local (`ContentPiecePageHeader.tsx:31-33`); `SiteHeader.tsx` não tem link.
- **Risco de acoplamento:** a home é estática/cacheada — a seção por visitante não pode contaminar o cache compartilhado nem virar leitura crua pesada; não editar as seções irmãs, `/conteudos` nem o rodapé; o e2e da home mede overflow horizontal; não acoplar ao #44 PUB2 (editabilidade da home é issue separada).

## Dependências

- **C211** (peças catalogadas e publicadas) — dura, indireta: sem peça publicada a seção some (fail-closed).
- S27 (`/conteudos` no ar) — dura: o CTA precisa do destino.
- B14 (mecânica de geolocalização/proximidade) — soft: precedente a reusar, não dependência de entrega.
- Design hi-fi aprovado no gate.

## Fora de escopo

- Cards personalizáveis como amostra (a seção anterior os mostra) e mudanças na `CampaignCardsSection`.
- Guardar/logar/cookiar a localização ou o IP; analytics/UTM (C213); login/captura/PII; novo Consent.
- Editabilidade/toggles/ordem das seções da home (#44 PUB2); mudar o rodapé, o selo local, o `SiteHeader` ou a própria `/conteudos`.
- Redesign de qualquer outra seção da home (S3 incluída) e personalização do resto da home por localização.

## Rabbit holes de produto

- **"Já que tem localização, personaliza a home inteira".** Se alguém "só completar": hero, cards e notícias por cidade. **Corte neste item:** só a seção da Central usa a localização; o resto da home fica como está.
- **"Guarda a cidade para a próxima visita".** Se alguém "só completar": cookie/localStorage de localização, perfil de visitante. **Corte:** nada é persistido — a resolução vale para a visita e morre nela.
- **"Pede o GPS de novo a cada visita".** Se alguém "só completar": prompt repetido no carregamento, spinner eterno. **Corte:** GPS só quando acessível (ou affordance); indisponível → IP/recentes, sem insistir.
- **"A seção vira uma mini-Central".** Se alguém "só completar": filtros, busca e ações de baixar/compartilhar na home. **Corte:** a seção só apresenta e leva; quem faz tudo é `/conteudos`.
- **"Publicar para não sumir".** Se alguém "só completar": hardcode de peças para a seção nunca ficar vazia. **Corte:** fail-closed a zero é regra (kill switch); o código não publica conteúdo.
- **"Tocar sozinho".** Se alguém "só completar": autoplay/preview animado para engajar. **Corte:** mídia só no toque, como no S27.

## Questões em aberto (produto)

- **Como obter o GPS?** **Opções:** A) prompt do navegador ao carregar a home | B) sem prompt: usa GPS só quando a permissão já estiver concedida (ou por uma affordance explícita na seção), senão IP. **Recomendação:** B — o prompt surpresa no carregamento queima confiança e a maioria nega; o IP já dá o recorte territorial na primeira visita. _(assumido — validar com produto)_
- **Amostra local estrita ou completada?** **Opções:** A) só do município (pode mostrar menos de 3) | B) município → região → recentes | C) só recentes com selo local. **Recomendação:** B — a seção não fica vazia nem parece genérica. _(assumido — validar com produto)_
- **Posição na home?** **Opções:** A) depois de `CampaignCardsSection`, antes da newsletter | B) junto de `CampaignContentSection` (S3). **Recomendação:** A — fecha a página com CTA de compartilhamento, mantendo cards + newsletter como bloco final de conversão. _(assumido — validar com produto)_
- **Copy/CTA literais?** **Opções:** A) título na voz da Central ("Peça voto pra Solla 1313") + CTA `Ver todas as peças` | B) copy neutra ("Conheça a Central de Conteúdos") | C) outra. **Recomendação:** A — mesma voz do S27; copy final validada no gate/design. _(assumido — validar com produto)_

## Referências

- GitHub Issue: #1305.
- Design UI (gate): `docs/plans/central-conteudos-secao-home-ui-design.html`.
- `docs/plans/central-conteudos-publica.md` (S27) e `central-conteudos-publica-impl.md` (D7 superseded); `central-conteudos-publica-ui-design.html`.
- `src/app/(frontend)/(home)/page.tsx`, `src/components/jingles/JingleHomeSection.tsx`, `src/app/(frontend)/(home)/CampaignCardsSection.tsx`, `src/utilities/content/contentPieceReads.ts`, `src/components/CampaignFooter.tsx`, `src/components/CampaignContentSection.tsx`
- Localização: `src/lib/municipalityProximity.ts`, `src/utilities/campaignGeolocation.ts`, `src/components/campaign/shared/useNearestMunicipalitySlug.ts`, `src/utilities/content/contentEventRateLimit.ts`, `src/utilities/ai/themeSearchGuard.ts`
- `tests/e2e/frontend.e2e.spec.ts` e `scripts/lib/e2e-affected-manifest.mjs` (manifesto de e2e afetado pela home).
- `AGENTS-public.md` — convenções do site público (cache, kill switch, mídia).

## Self-score (shaping)

4,6/5 — (1) fatia = um outcome verificável (a home leva à Central com peças do território; a seção some sem peça); (2) appetite ~2–3 dias cabe (seção + resolução de localização + seleção, com o resto da home intocado); (3) persona/job/aceite em linguagem de produto; (4) direção no codebase é hipótese (precedentes citados como pista); (5) zero decisão dura de engenharia — o mecanismo de resolução fica no plano de implementação e a viabilidade do sinal de IP está marcada "a confirmar".
