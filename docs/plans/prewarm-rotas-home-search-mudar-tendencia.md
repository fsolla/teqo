# Prewarm e2e: rotas que o setup spec não cobre flakeiam sob carga em dev

Status: registrada (Issue #645, `depends: OPS30`)
Atualizado em: 2026-08-11
Priority: P3
Appetite: ~1 hora eng (duas linhas no setup + medição)

## Intenção

O `setup.e2e.spec.ts` preaquece rotas GET/POST para que o primeiro hit de uma rota
em dev não compile no meio de um teste (o compile frio sob carga estoura o timeout
e aborta fetches em voo — o problema que o próprio setup foi criado para resolver).
Duas rotas usadas pelos journeys dos arquivos pesados ficaram de fora:

- `POST /campanha/home-search` — a busca global (B47/B48/B126): o 1º POST do
  worker compila o route handler em dev; sob load ≥40 a resposta passou de 15 s
  (B48 falhou 2/2 na sessão OPS36).
- `GET /campanha/acoes/mudar-tendencia` — o wizard de tendência (B97): mesmo
  padrão, falhou 2/2 (A/B: também falha no código original — pré-existente).

## Mudança

Adicionar as duas rotas às listas do `setup.e2e.spec.ts` (GETs e POSTs,
respectivamente), seguindo o padrão das entradas existentes (POST sem auth,
`.catch(() => undefined)`). Sem mudança de asserções ou de CI.

## Já resolvido no simplify/critique (não reabrir)

- Nada: achado originado na sessão OPS36.

## Explicitamente fora

- Flakes de render sob carga em geral (B24, B176, demand) — ledger P1 red-e2e.
- OPS30 (Issue #586) é o dono do hardening de prewarm em dev — este item é o
  complemento de duas rotas que a medição do OPS36 evidenciou; depende do OPS30
  apenas no sentido de não duplicar o trabalho (a Issue nasce `depends: [586]`).

## Gatilho de verificação

- Rodar B48 + B97 em dev a load ≥40 com o prewarm estendido: ambos verdes na
  primeira tentativa do worker.
