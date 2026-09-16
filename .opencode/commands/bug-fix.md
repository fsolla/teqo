---
description: Corrige um bug de ponta a ponta: diagnóstico → causa-raiz → fix → verificação → prevenção → post-mortem
---

Carregue a skill `bug-fix` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta. A fonte canônica é `.agents/skills/bug-fix/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: /bug-fix [--auto] <descrição do bug>. Com `--auto`, a skill dispensa a pausa do Passo 1 e segue até o PR sem confirmação (o bug de prod ainda exige approve humano na produção); sem ela, o fluxo supervisionado atual vale.

$ARGUMENTS
