# Município v2 — ações secundárias no FAB

Status: registrado
Atualizado em: 2026-08-02
Issue: #334
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe no FAB da campanha / detalhe v2
Appetite: ~0,5 dia eng
Responsável: —

**Plano pai:** [municipio-detalhe-v2.md](municipio-detalhe-v2.md) (lote B147–B152)

## Intenção

Abas (dossiê, eleições, atualizações, …) e CTAs secundários **não devem competir** com a dobra de operação. Na v2, o que era “outra aba” vira **ação no FAB** (ou equivalente já estabelecido na campanha), para quem deliberadamente quer preparar visita, ver eleições, etc.

## Persona e fluxo

- **Persona / contexto:** CG que às vezes precisa do dossiê ou do comparativo — mas não na maioria das aberturas.
- **Job principal:** alcançar secundárias **sem** poluir status/conta/rede/agora.
- **Fluxo desejado:**
  1. Na v2, abre o FAB (precedente B126 / ações rápidas).
  2. Escolhe: preparar visita (dossiê), ver eleições, registrar sinal (atalho), nova liderança, compositor de giros — conforme papel.
  3. Print / leitura de dossiê não mostra o FAB.
- **Anti-goals de produto:** recriar a barra de 6 abas no topo da v2; esconder ações críticas de operação no FAB (nível/meta/rede ficam na dobra); FAB como único jeito de editar status.

### Esboço de fluxo (B)

```text
[Dobla principal intacta]
  → FAB (+) → lista curta de secundárias do município
  → navega / abre superfície já existente (dossiê, eleições, …)
```

## Objetivo e aceite

- Na v2, secundárias listadas acima estão alcançáveis via FAB (ou chassis de ações rápidas já adotado), **sem** tab nav de 6 itens.
- Itens respeitam papel (ex.: escrita de nível/sinal só quem pode).
- Não remove a dobra de operação; complementar a B147–B150.
- Dossiê/print sem chrome de FAB.

## Dados (intenção)

- **Dados: N/A** — navegação / atalhos; dados vivem nas superfícies destino.

## Direção no codebase (hipótese)

- **Áreas prováveis:** integração com FAB / quick actions do município; links para dossiê/eleições/giros/nova liderança já existentes.
- **Precedente:** B126 FAB; B80 ações rápidas municípios; tab nav atual a **não** replicar.
- **Risco de acoplamento:** não duplicar um segundo FAB só da v2 se o chassis global já cobre; não quebrar mobile Sheet.

## Dependências

- Hard: **B147**.
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md).
- Soft: B150 (visita condensada aponta para cá).
- Serializes com irmãos na rota v2.

## Fora de escopo

- Reescrever dossiê ou eleições.
- Cutover de URLs (B152).
- Novas ações de domínio não listadas no shaping.

## Rabbit holes de produto

- **FAB com dezenas de ações.** **Corte:** só as que eram abas/CTAs secundários do detalhe.
- **Registrar sinal só no FAB e tirar o select da faixa.** **Corte:** select na faixa (B147); FAB é atalho opcional.

## Questões em aberto (produto)

- **“Registrar sinal” no FAB se já há select na faixa?** **Opções:** A) omitir do FAB | B) atalho que foca/abre o mesmo fluxo. **Recomendação:** B só se o FAB for o hábito mobile; senão A. _(assumido: A na v1 do FAB da v2)_

## Referências

- GitHub Issue #334
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md)
- B126 FAB; ações rápidas municípios
