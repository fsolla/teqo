# OPS87 — Pirâmide de verificação: migrar asserções de servidor dos e2e pesados para o paradigma HTTP sem browser (escalar o OPS35) + medir

Status: rascunho
Atualizado em: 2026-08-24
Issue: #833
Priority: P1
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável
Responsável: —

## Intenção

O gate de deploy roda a suíte e2e full (~10 min só de e2e) e ela é frágil sob 4 workers. Muita coisa ali existe para garantir comportamento de **servidor** — quem pode ver o quê, o que a página renderiza antes de qualquer JS, o que persiste, para onde redireciona, o que devolve 404 — mas cada teste paga browser, hidratação e interação client mesmo quando a asserção é 100% server-side. Isso é caro duas vezes: tempo de espera de quem deploya e classes de flake que nascem da interação.

O precedente já existe e está em produção: o OPS35 (#600) entregou o paradigma HTTP full-stack sem browser (fixture `request` do Playwright, login real via REST, HTML renderizado asserido direto), mas só a família Territórios migrou — o resto da suíte continuou crescendo em browser. Queremos escalar o paradigma para as famílias pesadas com fatia de servidor destacável, **medindo o ganho por família**: mesma cobertura, fração do tempo, suíte mais estável. Não é reescrever a suíte; é achar a pirâmide certa — o que é servidor deixa de pagar browser.

## Persona e fluxo

- **Persona / contexto:** a equipe que aciona o deploy verify e espera o gate verde; o agente/humano que trava em suíte frágil quando o código mudado era só de servidor.
- **Job principal:** obter as mesmas garantias de servidor com uma fração do tempo e menos flake.
- **Fluxo desejado:** acionar o verify → a parte de servidor das famílias pesadas roda sem browser → o relatório registra o tempo de cada família (browser vs HTTP) → gate verde mais rápido, mesma cobertura.
- **Anti-goals de produto:** não virar "reescrita de toda a suíte"; não remover teste sem equivalente em outro nível; não criar segundo framework de teste; não enfraquecer a garantia de falha de client (console.error/pageerror continua exclusivo de browser).

## Objetivo e aceite

- O tempo do e2e full cai e cada família migrada tem o ganho registrado (tempo browser vs tempo HTTP) — o ganho é o outcome, não a migração em si.
- A cobertura não diminui: nada é removido sem equivalente em outro nível (int ou HTTP) e as asserções migram 1:1.
- A suíte fica mais estável nas famílias migradas (menos interação client = menos classes de flake), sem reduzir o que se assegura.
- A migração anda em lotes e o deploy não fica bloqueado no meio de um lote.
- Guardrails que valem para o item: RBAC continua assegurado no conteúdo renderizado; auth é real (mesma sessão/cookie) sem duplicar lógica de login; fixtures e ownership existentes são reutilizados.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — medição por família (tempo browser vs tempo HTTP, por spec migrado).
- **Decisões desbloqueadas:** o humano/equipe decide se o paradigma vale escalar para as próximas famílias e onde parar (critério de parada), com número real de cada família na mesa.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto aqui: comparativo por família, tempo medido de verdade, nunca estimativa.

## Direção no codebase (hipótese)

- **Áreas prováveis:** a suíte e2e de campanha (specs `campaign*`) e a fixture HTTP já existente do OPS35 — o executor revisa a classificação das famílias, não a re-inventa.
- **Precedente a olhar:** OPS35 (#600, closed) — `campaignTerritoriesHttp.e2e.spec.ts` + fixture de login REST/cookie `campaign-token`; `setup.e2e.spec.ts` roda sem browser no mesmo job/servidor — sem infra nova.
- **Risco de acoplamento:** não duplicar o que o int já cobre (dados/loaders — o int **não** substitui asserção de HTML renderizado/SSR; o HTTP sim); o guard de falhas client (console.error/pageerror) fica só em browser.

## Dependências

- OPS86 (classificador de e2e corrigido passa a selecionar os novos specs HTTP no CI) — suave; este item se beneficia, não depende para começar.

## Fora de escopo

- Mudar o job de CI/deploy (OPS88 — item separado).
- Consertar flakes individuais de famílias que não foram migradas.
- Migrar interação/hidratação: WebAuthn, PWA, viewports, chat, colunas/filtros salvos, autosave, guard de console.
- Chamar server actions por HTTP cru.

## Rabbit holes de produto

- **Reescrever a suíte inteira.** Se alguém "só completar", vira migração total em browser → meses, sem parada. **Corte neste item:** só famílias com fatia de servidor destacável, um lote por vez, appetite fixo.
- **Migrar e não medir.** Sem o comparativo por família não há aceite — volta a ser opinião. **Corte neste item:** medição por família é condição de aceite, não cortesia.
- **Duplicar o int.** Asserções que o int já cobre migradas de novo geram cobertura dobrada sem ganho de tempo. **Corte neste item:** só o que o int não cobre (HTML renderizado/SSR/rotas) migra para HTTP.

## Questões em aberto (produto)

- **Por onde começar?** **Opções:** (a) maior retorno + baixo risco primeiro (concepts, permission-profile, people, home-actions) e o journey RBAC de municípios em lote dedicado; (b) por tamanho decrescente; (c) pelas famílias mais flaky. **Recomendação:** (a) — colhe o ganho cedo e valida a medição antes do lote grande. _(assumido — validar com produto)_
- **Onde para?** **Opções:** (a) parada pelo appetite (~1–2 dias; lote que não couber vira item novo); (b) continuar até esgotar as famílias A/C. **Recomendação:** (a) — o appetite manda; o resto fica documentado como próximo lote.
- **Meta numérica para o e2e full?** **Opções:** (a) meta fixa (ex.: <5 min); (b) registrar o ganho por família sem meta no primeiro lote e decidir meta depois. **Recomendação:** (b) — o número real do primeiro lote calibra uma meta honesta; meta arbitrária antes dos dados é risco de corte de garantia.

## Referências

- GitHub Issue #600 (OPS35, closed) — precedente HTTP full-stack em produção.
- Specs-família citadas na Direção (pistas para o executor, não contrato).
- OPS86 / OPS88 — dependência e vizinho de escopo.
- `AGENTS.md` — pipeline de verificação de deploy é convenção travada; este item não a altera.
