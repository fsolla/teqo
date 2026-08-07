# Território mais perto do nome na lista de municípios

Status: rascunho
Atualizado em: 2026-08-07
Issue: #412
Priority: P2
Model: composer-2.5 / deepseek-v4-flash-high
Impeccable: B — encaixe na célula de nome da tabela existente (`/campanha/municipios`)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b165-ui-draft.canvas.tsx
Appetite: ~0,25–0,5 dia eng; ajuste de espaçamento numa célula; sem migration
Responsável: —

## Intenção

Na lista `/campanha/municipios`, a primeira coluna mostra o nome do município e, embaixo, o território em linha menor. Hoje o território fica longe do nome — o usuário quer a segunda linha **bem pertinho** do nome, quase colada, sem sobrepor.

## Persona e fluxo

- **Persona / contexto:** assessor ou coordenador varrendo a tabela de municípios; a dupla nome + território é uma unidade de leitura ("qual município de qual território").
- **Job principal:** ler nome e território como um bloco só, sem o vão entre eles.
- **Fluxo desejado:** a linha do território acompanha imediatamente o nome (espaço mínimo), também quando o nome quebra em duas linhas.
- **Anti-goals de produto:** não virar "densificar a lista inteira" (altura das linhas e demais colunas ficam como estão); não sobrepor os textos; não mudar a navegação dos links (nome → município, território → território).

## Objetivo e aceite

- O território fica visivelmente colado ao nome (espaço de ~2–4 px) na célula de nome da tabela desktop de `/campanha/municipios`, com nome em 1 ou 2 linhas.
- Os dois textos não se sobrepõem em nenhum caso (qualquer fonte/tamanho de tela).
- O nome continua link para o município e o território continua link para a página do território — nada de navegação muda.
- Linhas com nome em 1 linha não encolhem a ponto de desalinhar os controles das outras colunas (altura mínima da linha preservada).

## Dados (intenção)

- **Vou apresentar dados?** **Não** — N/A: ajuste de espaçamento em célula existente, sem número novo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/municipality/MunicipalityList.tsx` (célula `name`, coluna fixa à esquerda) e `src/components/campaign/municipality/TerritoryLink.tsx` (altura/posição da segunda linha).
- **Precedente a olhar:** B25 (`docs/plans/link-territorio-lista-municipios.md`) — o território virou link; a segunda linha tem área de toque própria. No card mobile o território já fica colado (`gap` de card) — não é alvo deste pedido.
- **Risco de acoplamento:** a célula é fixa (sticky) e compartilha a altura da linha com controles editáveis das outras colunas; mexer no vão nome↔território não pode mudar a altura geral das linhas nem o alinhamento dos controles.

## Dependências

- Nenhuma (superfície independente; não toca migrations, consent, RBAC nem cache público).

## Fora de escopo

- Cards mobile (`MunicipalityListMobileCards`) — já têm espaçamento apertado; não foram citados. Se quiser apertar mais, item novo.
- Densificar a tabela inteira (alturas de linha, outras colunas) — outro pedido.
- Mudar a navegação/links da célula (trava do B25).

## Rabbit holes de produto

- **"Já que vou mexer, densifico a lista toda."** Se alguém "só completar": reduz altura das linhas e das outras colunas, muda o escopo e arrisca os controles editáveis. **Corte neste item:** só o vão nome↔território desta célula.
- **Encolher demais o alvo de toque do território.** A segunda linha é link (B25); apertar o espaçamento encolhe a área clicável do território. **Corte:** aceitar o alvo menor em troca da leitura colada (o nome é a navegação primária da célula), sem inventar hit-zone mágica — registrar se virar reclamação.

## Questões em aberto (produto)

- **Aplica só à tabela desktop?** **Opções:** A) só a célula da tabela (citada) | B) tabela + cards mobile. **Recomendação:** A — o mobile já está colado. _(assumido — validar com produto)_
- **Quão perto é "bem pertinho"?** **Opções:** A) ~2–4 px (respiro mínimo, sem sobrepor) | B) 0 px (colado de verdade). **Recomendação:** A — 0 px aproxima descidas/ascendentes de fontes diferentes (nome base, território xs) e pode parecer sobreposto em telas pequenas. _(assumido — validar com produto)_

## Referências

- GitHub Issue #B165 (após registro)
- Canvas UI (gate): [plan-b165-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b165-ui-draft.canvas.tsx)
- `src/components/campaign/municipality/MunicipalityList.tsx` (célula `name`, ~linha 278)
- `src/components/campaign/municipality/TerritoryLink.tsx`
- Precedente: `docs/plans/link-territorio-lista-municipios.md` (B25)
