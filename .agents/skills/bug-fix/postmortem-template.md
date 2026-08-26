# Post-mortem: <título curto do bug>

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo | Valor |
| ----- | ----- |
| Data do post-mortem | YYYY-MM-DD |
| Severidade | crítica / alta / média / baixa |
| Ambiente | prod / dev / CI |
| Issue(s) | #N ou "sem Issue" |
| PR do fix | #N |
| Detectado por | humano / teste / log / usuário |

## Timeline

| Momento | Data/hora | Evento |
| ------- | --------- | ------ |
| Início provável | | quando o bug começou (commit/entrega que o introduziu, se apurado) |
| Detecção | | |
| Correção mergeada | | |
| Deploy | | (bug de prod: dispatch manual do deploy.yml) |
| Verificado em prod | | (bug de prod: confirmação do humano) |

## O bug

O que acontecia, como se manifestava, quem afetava. **Sintoma — não a causa.**

## Causa-raiz

Por que e como aconteceu (5-whys). Origem `file:line` / commit quando apurado. Se a reprodução falhou, registre as condições testadas e a base da hipótese.

## Correção

O que mudou e por que resolve a **causa** (não o sintoma). Referências: arquivos, PR, migration se houver.

## Verificação

- Teste de regressão: `<nome do teste>` — falha sem o fix, passa com
- Suíte: `<resultado>` (`pnpm gate:fast` / `test:int` / e2e afetado)
- CI: verde no PR #N
- Prod: `<confirmação do humano, data/hora>` ou "não se aplica (bug local)"

## Prevenção

| Estratégia | Custo | Estado |
| ---------- | ----- | ------ |
| | barata | implementada agora (commit/PR) |
| | cara | documentada — não implementada neste fluxo |

**Estratégia implementada:** o que foi adicionado para o bug não voltar (teste de regressão, guard, lint, validação…).

**Estratégia documentada (cara):** o que preveniria a recorrência mas exige engenharia relevante — candidata a Issue futura.

## Lições

Observações livres: padrões que geraram o bug, sinais precoces ignorados, o que fazer diferente.
