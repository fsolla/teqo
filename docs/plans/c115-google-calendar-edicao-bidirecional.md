# C115 — Google Calendar: edição pela agenda pessoal volta para Teqo (bidirecional)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #636
Priority: P2
Model: cursor-grok-4.5-high
Impeccable: B — encaixe na agenda (gestão/estado do sync)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-33/canvases/plan-c115-ui-draft.canvas.tsx
Appetite: ~2–2,5 dias eng; um outcome verificável — candidato remarca um compromisso no Google e a agenda inteira da equipe acompanha

## Intenção

Com o espelho do C114, o Teqo escreve no Google — mas a agenda só é *oficial* de verdade quando o caminho inverso existe: o candidato (e pessoas escolhidas) editam o compromisso na própria agenda do Google — remarcar horário, mudar título, cancelar — e isso volta para o Teqo e propaga para todo mundo que segue, com notificação. O Google Calendar vira um segundo ponto de entrada da agenda da campanha, não só um espelho. Sem isso, quem decide continuaria preso ao Teqo ou ficaria com a agenda divergente.

## Persona e fluxo

- **Persona / contexto:** candidato em trânsito, só o celular, sem entrar no Teqo; coordenação autoriza quem pode editar pelo Google.
- **Job principal:** "remarquei no Google; a campanha inteira viu".
- **Fluxo desejado:** candidato abre o Google Calendar (a Agenda da Campanha está na lista de calendários dele) → arrasta/edita/cancela um compromisso → o Teqo detecta (notificação de push do Google + sync incremental) → atualiza a atividade → propaga para todos os calendários sincronizados com aviso conforme configurações.
- **Anti-goals de produto:** criação de eventos novos pelo Google fora de v1 (atividade exige município — dado que o Google não tem); conflito não vira tela de resolução manual; ninguém além do grupo autorizado edita pelo Google; leader lockdown intocado.

### Esboço de fluxo (B)

```text
[candidato no Google Calendar] → edita/remarca/cancela evento da Agenda da Campanha
→ webhook do Google avisa Teqo → sync incremental busca a mudança
→ atividade atualizada no Teqo → push para todos os seguindo (C114) + notificação
```

## Objetivo e aceite

- Pessoas autorizadas (decisão em aberto: candidato e/ou coordenação) editam data/hora/título/cancelamento de compromissos existentes no Google Calendar e a mudança reflete na atividade do Teqo e nos calendários de todos os que seguem, com notificação (mesmo mecanismo do C114).
- Campos que são invariantes estruturais do Teqo (município, tipo, status interno) **não** são editáveis pelo Google: tentativa não propaga (decisão em aberto: ignorar ou reverter no Google).
- Detecção robusta: mudanças feitas no Google chegam ao Teqo mesmo com o app fechado; o canal de notificação se renova sozinho (a API exige renovação periódica); falha do Google não quebra o Teqo — re-tenta e mostra estado.
- Conflito (mesmo evento editado no Teqo e no Google): regra simples e documentada (recomendação: vence a edição mais recente, com registro) — nunca uma tela de resolução manual em v1.
- Apenas quem está autorizado edita pelo Google; leader segue sem acesso; Teqo continua funcionando sem Google.

## Dados (intenção)

- **Vou apresentar dados?** Não — sincronização de eventos; a "forma" é o evento do Google Calendar.
- **Decisões desbloqueadas:** nenhuma leitura nova no Teqo.
- **Forma:** *adiada*.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota pública de webhook do Google **fora de `(app)`** (precedente: `agenda/ical/[secret]`), utilitário de sync perto de `src/utilities/calendarFeed.ts`, ações de `src/app/(campaign)/campanha/actions/`, agenda `/campanha/agenda`.
- **Precedente a olhar:** C114 (espelho — base obrigatória), `agenda/ical/[secret]` (rota pública sem cookie com credencial), C96 (fail-closed no escopo do criador), padrões de token de campanha (validação de origem).
- **Risco de acoplamento:** webhook público é superfície nova — validar origem (headers `X-Goog-*` + token de canal), nunca confiar no corpo sem validação; edição vinda do Google precisa respeitar access (quem editou = quem foi autorizado; não propagar fora do escopo); leader nunca recebe escrita do Google.

## Dependências

- **Dura: C114** (espelho Teqo → Google; este item adiciona a volta). Suaves: C113.

## Fora de escopo

- Criar atividade nova a partir do Google (v2 — precisa resolver os campos obrigatórios que o Google não tem, ex.: município).
- Resolução manual de conflito (tela): regra automática simples + registro.
- Bidirecional para outras plataformas (Apple/Outlook): o link de import iCal segue só-leitura.
- Permissões por evento (quem edita é definido por calendário, não por evento, em v1).

## Rabbit holes de produto

- **"Resolver conflito por evento com tela."** Se alguém "só completar": admin de conflito inteiro. **Corte:** regra automática (mais recente vence) + registro auditável.
- **"Importar criação arbitrária do Google."** **Corte:** sem município não entra; v2.
- **"Sincronizar recorrências e todos-os-dias complexos."** **Corte:** o mapa de campos é o do espelho (C114); fora do aceite.

## Questões em aberto (produto)

- **Quem pode editar pelo Google?** **Opções:** A) só candidato | B) candidato + coordenador | C) lista de staff escolhida pela coordenação. **Recomendação:** **B** — o candidato é o caso do pedido; a coordenação precisa do mesmo direito para correções rápidas. _(assumido — validar)_
- **Regra de conflito (mesmo evento editado nos dois lados):** **Opções:** A) vence a edição mais recente (relógio), com registro | B) Teqo sempre vence | C) a mudança não propaga até alguém decidir (pausa o evento). **Recomendação:** **A** — simples e previsível no ritmo da campanha; B trai o sentido de "editar pelo Google"; C vira a tela de conflito que cortamos. _(assumido — validar)_
- **Edição pelo Google de campo estrutural (ex.: município):** **Opções:** A) a edição não propaga (o Google reverte na próxima sincronização) | B) propaga e o Teqo rejeita com aviso. **Recomendação:** **A** — para campos estruturais, o Google é espelho do Teqo. _(assumido — validar)_
- **Como o staff autorizado ganha permissão de escrita no calendário?** Operacional (convite de permissão pelo próprio Google na ativação do C114), não é código — mas o Teqo precisa mostrar quem está autorizado e permitir desautorizar.

## Decisões travadas (gate)

- Direção inversa Google → Teqo só para **editar/remarcar/cancelar atividades existentes** (sem criação em v1).
- Regra de conflito automática (nunca tela manual em v1).
- Acessos do Teqo (incluindo leader lockdown) valem também para o que vem do Google.
- **Teqo permanece a fonte de verdade do domínio:** o Google é superfície de edição (horário/título/cancelamento) + projeção — nunca autoritativo. O evento no Google carrega vínculo com a atividade; a edição vinda de lá *vira* edição no Teqo e o Teqo **reescreve o evento a partir do próprio estado** (idempotente, corrigindo campos estruturais que o Google tentar mudar). Se o Google desligar, a agenda do Teqo fica intacta; se o Teqo desligar, o calendário é um snapshot congelado.

## Referências

- GitHub Issue [#636](https://github.com/fsolla/teqo/issues/636)
- Canvas UI (gate): [plan-c115-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-33/canvases/plan-c115-ui-draft.canvas.tsx)
- Plans C114 (espelho), C16/C92/C93/C96/C98, C113
- `src/app/(campaign)/campanha/agenda/ical/[secret]/route.ts`, `src/utilities/calendarFeed.ts`
