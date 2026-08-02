# Sidebar — papel no perfil + Sair como ícone

Status: registrada
Atualizado em: 2026-08-02
Issue: #272
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe no rodapé da sidebar (`CampaignSidebar`)
Appetite: ~0,5 dia eng; um ajuste de shell, sem fluxo novo
Responsável: —

## Intenção

No rodapé da sidebar de `/campanha`, o botão “Sair” ocupa uma linha inteira abaixo do link de perfil, e o subtítulo fixo “Meu perfil” não informa quem está logado além do nome. Querem densificar: sair vira ícone à direita da mesma linha do perfil, e o subtítulo passa a mostrar o **papel** do usuário (Coordenador Geral, Assessor, Candidato, Liderança).

## Persona e fluxo

- **Persona / contexto:** qualquer `campaignUser` com a sidebar aberta (mesa desktop ou Sheet mobile) — staff ou liderança.
- **Job principal:** ver quem sou (nome + papel) e sair da sessão sem gastar uma linha extra.
- **Fluxo desejado:**
  1. Olha o rodapé → vê avatar, nome, papel.
  2. Toca o bloco de perfil (exceto o ícone de sair) → vai a `/campanha/perfil`.
  3. Toca o **ícone** de sair (não um botão com texto “Sair”) → mesmo fluxo de logout de hoje (limpa caches/históricos locais e encerra a sessão).
- **Anti-goals de produto:** redesign da sidebar inteira; segundo botão “Sair” em outro lugar; manter o botão full-width “Sair”; trocar o destino do perfil; inventar papéis novos na UI.

### Esboço de fluxo (B)

```text
[rodapé sidebar]
  [avatar + nome + papel …………… ⏻]
       │                          │
       └→ /campanha/perfil        └→ logout (comportamento = atual; UI = só ícone)
```

## Objetivo e aceite

- O subtítulo sob o nome deixa de ser “Meu perfil” e mostra o rótulo pt-BR do papel do usuário logado (os mesmos rótulos já usados no escopo: Coordenador Geral / Assessor / Candidato / Liderança).
- “Sair” **não** é mais botão full-width com label “Sair” abaixo do perfil: vira **somente ícone** à **direita** da mesma linha do perfil (sem texto visível no controle).
- O ícone tem rótulo acessível (“Sair” / estado “Saindo…”), alvo tocável adequado (≈ `min-h-11`), e o **funcionamento** de logout (incluindo limpeza client-side já existente) permanece — só a apresentação muda.
- O link/área de perfil continua levando a `/campanha/perfil` sem disparar logout por acidente (alvos distintos).
- Sem mudança de auth, rotas ou papéis.

## Dados (intenção)

- **Vou apresentar dados?** Não — só rótulo de papel já conhecido da sessão.
- **Decisões desbloqueadas:** N/A (identidade visual / densidade de shell, não decisão operacional).
- **Forma:** _adiada ao plano de implementação_.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/CampaignSidebar.tsx` (rodapé); rótulos já existem em `campaignRoleLabels` (`campaignUserProfile`).
- **Precedente a olhar:** o próprio footer atual; badge de escopo no topo da sidebar (já mostra o papel).
- **Risco de acoplamento:** logout client-side (recent visits, PWA caches, filtros salvos) não pode sumir; leader lockdown intocado.

## Dependências

- Nenhuma dura. Soft: **B130** (#271) também mexe no shell da sidebar (logo / chips de escopo) — se o badge de escopo sair dali, o subtítulo com papel neste item fica ainda mais importante; não bloqueia.

## Fora de escopo

- Remover ou redesenhar o `CampaignScopeBadge` do topo da sidebar (papel pode continuar lá — ver questão aberta).
- Alterar `/campanha/perfil`, bottom nav, FAB/drawer de ações rápidas.
- Collapsed/icon-only sidebar (tablet) além do necessário para não quebrar o footer atual.
- Copy nova de papéis ou mudança de RBAC.

## Rabbit holes de produto

- **“Já que estamos no footer…”.** Menu de conta, troca de usuário, confirmação de logout. **Corte:** só realocar Sair + trocar subtítulo.
- **Deduplicar papel no badge.** Pode ser tentador tirar o badge porque o subtítulo passa a mostrar o papel. **Corte neste item:** não mexer no badge salvo decisão explícita no gate.

## Questões em aberto (produto)

- **Papel duplicado (badge no topo + subtítulo no rodapé)?** **Opções:** A) manter badge e mostrar papel no rodapé (pedido literal) | B) mostrar papel só no rodapé e remover/alterar o badge | C) subtítulo = papel só se o badge sumir em algum viewport. **Recomendação:** **A** — este item é densificar o footer; o badge de escopo é outro sinal de “com que ótica estou vendo a árvore”. _(assumido — validar)_
- **Texto do subtítulo:** papel curto (“Assessor”) vs. frase (“Perfil · Assessor”)? **Opções:** A) só o rótulo do papel | B) “Meu perfil · {papel}”. **Recomendação:** **A** — pedido explícito; o link já implica perfil. _(assumido)_

## Referências

- GitHub Issue #272
- `src/components/campaign/shell/CampaignSidebar.tsx`
- `src/utilities/campaignUserProfile.ts` (`campaignRoleLabels`)
- Plano histórico de perfil: `docs/plans/reset-senha-foto-perfil.md`
