# Município v2 — Agora (encaminhamento + sugestão + visita)

Status: registrado
Atualizado em: 2026-08-02
Issue: #333
Priority: P1
Model: composer-2.5
Impeccable: B — bloco na rota v2
Appetite: ~0,5–1 dia eng
Responsável: —

**Plano pai:** [municipio-detalhe-v2.md](municipio-detalhe-v2.md) (lote B147–B152)

## Intenção

Depois de status, conta e rede, o coordenador precisa de um bloco **“o que fazer agora”**: próximo passo humano, o que o sistema está pedindo (sugestão), e se a visita do candidato faz sentido — **condensado**, sem a torre de cards da Visão geral atual.

## Persona e fluxo

- **Persona / contexto:** CG na mesa, fechando a leitura do município.
- **Job principal:** sair da página com um encaminhamento claro e, se couber, resolver/dispensar uma sugestão.
- **Fluxo desejado:**
  1. Lê/edita **encaminhamento** (próximo passo) no lugar.
  2. Vê **no máximo 1–2** sugestões acionáveis (ou silêncio explícito).
  3. Vê visita do candidato em **uma linha** (elegível / não + motivo curto); detalhe e compositor ficam no FAB (B151).
- **Anti-goals de produto:** lista completa do catálogo E11 na dobra; card de elegibilidade com as cinco condições expandidas sempre; segundo lugar para editar estratégia além deste bloco + status.

### Esboço de fluxo (B)

```text
[Agora]
  → Encaminhamento (texto editável / auto-save)
  → Sugestão (0–2) → Resolver | Dispensar
  → Visita: Elegível|Não · uma linha · “abrir giros” no FAB
```

## Objetivo e aceite

- Encaminhamento editável no lugar na v2 (staff com permissão).
- Sugestões: no máximo duas na dobra; resto não compete (Início / FAB se necessário).
- Visita condensada (estado + uma frase); não replica o card E13 completo na dobra.
- Mobile: bloco empilha abaixo da rede sem perder o encaminhamento acima da dobra secundária.

## Dados (intenção)

- **Vou apresentar dados?** Sim, derivados (sugestões, elegibilidade resumida).
- **Decisões desbloqueadas:**
  - CG: “qual o próximo passo que a equipe combinou?”
  - CG: “resolvo esta sugestão agora ou dispenso?”
  - CG: “vale levar o candidato — ou só abrir o compositor depois?”
- **Forma:** *adiada ao impl*. Restrição: silêncio é pergunta (não empty state vazio mudo).

## Direção no codebase (hipótese)

- **Áreas prováveis:** bloco na v2; `nextSteps` / estratégia; sugestões E11; elegibilidade E13 resumida.
- **Precedente:** OverviewTab atual (sugestões + visita + strategy next steps); motor de sugestões.
- **Risco de acoplamento:** não inventar segundo motor de sugestão; resolve/dispensa reutiliza o fluxo já existente.

## Dependências

- Hard: **B147**.
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md).
- Soft: B151 (atalho giros/dossiê).
- Serializes com irmãos na rota v2.

## Fora de escopo

- Compositor de giros completo (só atalho).
- Feed de atualizações completo.
- Triagem statewide (continua no Início).

## Rabbit holes de produto

- **Painel E11 completo no município.** **Corte:** 0–2 itens.
- **Checklist E13 expandida sempre.** **Corte:** uma linha + FAB.

## Questões em aberto (produto)

- **Encaminhamento = campo `nextSteps` da estratégia ou nota separada?** **Opções:** A) reusar `nextSteps` | B) novo conceito. **Recomendação:** A — um só lugar de verdade. _(assumido)_

## Referências

- GitHub Issue #333
- Pai: [municipio-detalhe-v2.md](municipio-detalhe-v2.md)
- E11 motor de sugestões; E13 elegibilidade / giros
