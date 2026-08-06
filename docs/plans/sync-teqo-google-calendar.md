# C16 — Sync por filtro + link de import (Google Calendar)

Status: blocked (plano ainda não em main)
Atualizado em: 2026-08-06
Issue: #392
Priority: P2
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: B — encaixe na agenda: filtro ativo → sync / link de import
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-jr8x/canvases/plan-c16-ui-draft.canvas.tsx`
Appetite: ~1,5–2 dias eng; um outcome verificável — com um filtro da agenda, a pessoa obtém um link de import e o Google Calendar passa a refletir esse recorte
Responsável: —

## Intenção

Quem ainda vive no Google não precisa de “um espelho mágico de tudo”: precisa do **recorte certo** (só deputado presente, só um município, só certas tags, combinação). Em Teqo a pessoa aplica o filtro na agenda e **gera um link de import** desse filtro para colar no Google Calendar (Assinar URL / importar). Teqo continua SoT; o Google consome o recorte. Assim comunicação e o candidato escolhem o que acompanhar sem ligar pedindo atualização.

## Persona e fluxo

- **Persona / contexto:** coordenador monta o filtro “deputado presente”; comunicação importa esse link no GCal da equipe; assessor pode querer só seus municípios (no escopo que já vê).
- **Job principal:** transformar o filtro atual da agenda num calendário assinável no Google.
- **Fluxo desejado:** na agenda (C15) aplica filtros → “Link de import” / sincronizar este filtro → copia URL → cola no Google Calendar → cria/edita/cancela em Teqo atualizam o feed desse recorte.
- **Anti-goals de produto:** sync bidirecional; obrigar OAuth de N contas pessoais; um único espelho sem filtro; Teqo como escravo do Google.

### Esboço de fluxo (B)

```text
[filtros na agenda] → gerar link de import deste filtro → Google assina a URL
                     → mudanças em Teqo (no recorte) aparecem no GCal
```

## Objetivo e aceite

- A partir dos filtros da agenda (município, deputado presente, tags, combinação), o usuário autorizado gera um **link de import** daquele recorte.
- O link é usável no Google Calendar como calendário por URL (feed do recorte); quem importa vê os compromissos que passam no filtro.
- Alterações em Teqo no conjunto filtrado refletem no feed (criar / remarcar / cancelar no recorte).
- Teqo permanece SoT: falha ou atraso no consumidor não corrompe dados locais.
- Escopo de leitura do link respeita access (não vaza municípios fora do ator que criou/autorizou o link — fail-closed).
- Leader lockdown; sem Google → Teqo.

## Dados (intenção)

- **Vou apresentar dados?** Não analítico.
- **Decisões desbloqueadas:** “este recorte da agenda está no meu Google?”
- **Forma:** adiada (UI: ação na barra de filtros + estado do link).

## Direção no codebase (hipótese)

- **Áreas prováveis:** agenda C15 (barra de filtros), endpoint/feed assinável do recorte, token/HMAC ou secret de feed (precedente de tokens de campanha), sem PII extra além do necessário no evento (título + município).
- **Precedente a olhar:** filtros C15/C14 tags; padrões de token HMAC em campanha; Google “From URL”.
- **Risco de acoplamento:** URL secreta = capacidade de leitura do recorte — rotação/revogação; não expor telefone de liderança no feed.

## Dependências

- Dura: **C15** (filtros + agenda). Soft: **C14** (tags).

## Fora de escopo

- Sync bidirecional / import contínuo Google → Teqo.
- OAuth push obrigatório para um único GCal canônico (o link de import cobre o job; push OAuth só se o link não bastar — fora desta fatia).
- Papéis novos; N conexões OAuth por assessor.

## Rabbit holes de produto

- **“Push OAuth + ICS + webhooks.”** **Corte:** link de import do filtro é o outcome.
- **“Feed público sem segredo.”** **Corte:** fail-closed; link com credencial revogável.
- **“Um link global sem filtro.”** **Corte:** o valor é o recorte.

## Questões em aberto (produto)

- **Quem gera/revoga links?** **Opções:** A) só coordenador/candidato | B) qualquer staff no próprio escopo. **Recomendação:** **B** para o próprio escopo (assessor gera link dos municípios que já vê); coordenador para recortes amplos. _(assumido — validar)_
- **Evento no feed:** **Opções:** A) título + município | B) título só | C) + tags. **Recomendação:** **A** (+ tags no título/descrição curta se ajudar o filtro mental); sem lista de lideranças. _(assumido — validar)_
- **Cancelados no feed?** **Opções:** A) somem | B) constam como cancelados. **Recomendação:** **A** (some do calendário importado). _(assumido — validar)_

## Decisões travadas (gate)

- Sync **de acordo com o filtro** (município, deputado presente, tags, etc.).
- Entrega = **link de import** do filtro (não espelho único fixo “só deputado”).
- Direção Teqo → consumidor (Google); sem bidirecional.

## Referências

- GitHub Issue [#392](https://github.com/fsolla/teqo/issues/392)
- Canvas UI (gate): [`plan-c16-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-jr8x/canvases/plan-c16-ui-draft.canvas.tsx)
- Planos C14 / C15
