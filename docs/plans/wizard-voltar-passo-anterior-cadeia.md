# Wizard — Voltar = passo imediatamente anterior (também na cadeia)

Status: registrado
Atualizado em: 2026-08-02
Issue: #289
Priority: P1
Model: composer-2.5
Impeccable: B — chrome/navegação nos passos `/campanha/acoes/*` (Voltar + back do SO)
Appetite: ~0,5–1 dia eng; um contrato de “passo anterior” coerente na cadeia B98; sem migration
Responsável: —

## Intenção

Depois de Ajustar votos → município → salvar votos, o fluxo encadeia em Mudar tendência. Ao tocar **Voltar** (ou o back do aparelho) nessa tela, a pessoa cai de novo na **seleção de município** — como se o ritual tivesse recomeçado. O esperado é voltar **um** passo: a tela de ajustar votos **do mesmo município**, sem reescolher território.

Isso quebra Continuity no meio do ritual mais comum do Início (A1). A cadeia B98 avançou bem; o Voltar entre elos ainda mente.

## Persona e fluxo

- **Persona / contexto:** CG/assessor no polegar, no meio do ritual “Ajustar votos”; acabou de gravar os números e caiu em tendência; percebeu que quer revisar o ajuste (ou só desfazer o avanço).
- **Job principal:** Voltar **um** passo previsível — o ajuste anterior no mesmo município — nunca a busca de município.
- **Fluxo desejado:** Início → Ajustar votos → município → votos → tendência → **Voltar** → votos (mesmo município) → Voltar → busca de município → Voltar/X → origem/Início.
- **Anti-goals de produto:** “Voltar” = dismiss do ritual; forçar reescolher município entre elos; second-guess do Pular/X; inventar um tutorial de histórico do browser.

### Esboço de fluxo (B/C/D)

```text
Início → Ajustar votos
  → [busca município]
  → [ajustar votos]     ← gravou
  → [mudar tendência]   ← elo B98
       Voltar / Android back
  → [ajustar votos]     ← mesmo município (NÃO a busca)
       Voltar
  → [busca município]
```

Mesma regra nos outros elos: do 1º passo de um subfluxo encadeado, Voltar = último passo útil do elo anterior (mesmo município), não a busca daquele slug.

## Objetivo e aceite

- No caminho Ajustar votos → tendência, **Voltar** (header mobile) e **back do SO/browser** levam ao passo de **ajustar votos** do mesmo município — não à seleção de município.
- Em fluxo **standalone** (entrou só em Mudar tendência), Voltar no 1º passo pós-município continua indo à **busca** desse fluxo (não inventa elo inexistente).
- Dentro de um subfluxo (ex. nota de tendência → escolha de tendência), Voltar permanece o passo interno anterior.
- Header Voltar e Android/browser back têm a **mesma** semântica neste fluxo.
- O contrato de “passo imediatamente anterior” fica **reutilizável** pelos wizards `/campanha/acoes/*` que ainda são stub (hoje: **Registrar pedido** / A5), sem implementar esses fluxos aqui.
- Guardrails: staff only; sem migration/Consent; leader lockdown intacto; `returnPath` (B110) não é corrompido pelo Voltar entre elos.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** staff decide se revisa o ajuste anterior ou segue o ritual — sem perder o município já escolhido.
- **Forma:** _adiada ao plano de implementação_

## Direção no codebase (hipótese)

- **Áreas prováveis:** `/campanha/acoes/*`; chrome `CampaignWizardShell` / top bar; helpers de cadeia e hrefs em `src/lib/` (`wizardActionChain`, rotas de ação); passos de tendência/votos/sinal/liderança sob `components/campaign/`.
- **Precedente a olhar:** B98 (`encadear-ajustes-wizard.md`, #106); B110 retorno `from`; chrome de Voltar já no shell/top bar.
- **Risco de acoplamento:** avanços da cadeia hoje podem apagar o passo anterior do histórico do browser — Voltar “cego” ≠ passo lógico; não confundir Pular/X com Voltar. Ao fechar Continuity, preferir um dono único de “passo anterior” que A5 (registrar-pedido) possa plugar depois — sem construir A5 neste item.

## Dependências

- Soft: B98 ✓ (cadeia).
- Duras: nenhuma aberta.

## Fora de escopo

- **Implementar Registrar pedido (A5)** — ainda stub após município; **não** é desta task. Continuidade: quando A5 nascer, usa a mesma regra de Voltar (passo imediatamente anterior / Continuity), sem inventar navegação paralela.
- Incluir demanda na matriz de encadeamento B98 (já rejeitado na v1 da cadeia).
- Reordenar a matriz de encadeamento B98.
- Mudar copy de Pular / quando X aparece (B96/B104).
- Redesign visual de tiles/tendência (B113).
- Persistência de rascunho mid-Zap.
- Restaurar entregas revertidas de outras issues de navegação — fora; este item só o aceite de “passo imediatamente anterior”.

## Rabbit holes de produto

- **“Já que mexo em Voltar, refaço o history inteiro do app.”** Explode appetite. **Corte neste item:** só passos `/campanha/acoes` e a cadeia B98.
- **“Voltar deve desfazer o save do elo anterior.”** Não pedido. **Corte:** Voltar navega; dados já gravados ficam até novo save.
- **“Já que Continuity, implemento A5 neste PR.”** Fora. **Corte:** só deixar o contrato plugável; wizard de pedido é item próprio.

## Questões em aberto (produto)

- **Escopo dos elos?** **Fechado:** todos os elos da matriz B98 (não só votos→tendência). Registrar pedido fora da implementação; Continuity preparada para quando A5 existir.
- **Voltar para um elo já salvo:** **Opções:** A) reabre o passo editável; novo Salvar atualiza e segue a cadeia de novo | B) Voltar só “olha” read-only. **Recomendação:** **A** — mesmo formulário de sempre; Continuity. _(assumido)_
- **Paridade Android/browser?** **Opções:** A) header e SO iguais | B) só corrigir o botão Voltar. **Recomendação:** **A**. _(assumido)_

## Referências

- GitHub Issue #289
- Relato de produto 2026-08-02 (Ajustar votos → tendência → Voltar → busca município)
- Issue B98 #106 · B110 #149 · UX-1 A5 em `fluxos-acao-primeiro-inicio.md` (stub hoje)
- `docs/plans/encadear-ajustes-wizard.md` · `docs/plans/fluxos-acao-primeiro-inicio.md`
- Rotas `/campanha/acoes/atualizar-votos`, `/campanha/acoes/mudar-tendencia` (e demais elos B98); `registrar-pedido` só como consumidor futuro
