# UX-1 — Ações do Início e fluxos lineares (rascunho)

**Status:** planejamento apenas — sem implementação neste doc.  
**Origem:** sessão observada 2026-07-29 ([snapshot](sessao-observada-coordenador-2026-07-29-snapshot.md)) · item roadmap **UX-1**.  
**Prazo soft:** manejável até reunião da assessoria **03/08/2026**.  
**Princípio-guia:** modelo mental do CG = **Ação → Local → Quem**; formulário **contínuo**; descoberta **above-the-fold**; commit **óbvio no caminho** (não “Salvar” órfão).

## Duas superfícies (não misturar)

| Superfície                 | Serve para                                                                            | Não serve para                                        |
| -------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Início — ações**         | Delta do dia; um caso de cada vez                                                     | Varrer 435 linhas; comparar TIs                       |
| **Listas (Municípios, …)** | Gestão do banco / bulk; “quem não está monitorado” (filtro sem assessor × votos 2022) | Ser a _única_ porta para registrar o que ligou no Zap |

Mapa, KPIs e sugestões no Início **descem** abaixo das ações (ou colapsam): briefing, não mesa.

Edição inline nas células **permanece** para quem já está na lista — e deve existir também onde a informação é só lida hoje na ficha (U9). Os wizards são a **porta de entrada**, não um segundo sistema de escrita paralelo com regras diferentes (reutilizar as mesmas actions/access).

---

## Layout do Início (above-the-fold alvo)

Viewport típico do CG (notebook): na primeira tela, sem rolar:

1. Saudação curta (1 linha)
2. **Bloco “O que você quer fazer?”** — 4–6 botões de ação (rótulo = verbo + objeto, linguagem de mesa)
3. Atalho secundário: **“Ver municípios sem responsável”** (deep-link já validado como hit: `?coverage=sem_assessor&sort=votos`)
4. (Opcional, 2ª dobra) mapa / KPIs / sugestões / visitados / onde estou

Anti-goals do bloco de ações: cards genéricos de métrica no lugar dos botões; ícones sem verbo; mais de ~6 ações primárias; depender de sidebar para o ritual diário.

---

## Ações primárias (v1 para 03/08)

Prioridade pela frequência do ritual do CG (delta de voto + rede + pedido), não pela cobertura do schema.

| #   | Rótulo no botão (pt-BR de mesa)     | Job                                                                         | Slice 03/08?                                                                                               |
| --- | ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A1  | **Atualizar votos de um município** | Projeção mudou (Cairu −100; Salinas 300→150)                                | **Sim — must**                                                                                             |
| A2  | **Registrar o que aconteceu**       | Sinal / invasão / flip / nota urgente (Salinas)                             | **Sim — must** (pode ser passo opcional dentro de A1; botão próprio se o sinal vier sem mudança de número) |
| A3  | **Mudar tendência**                 | Favorável / desfavorável / neutra + porquê                                  | **Sim** (passo em A1; botão próprio se só tendência)                                                       |
| A4  | **Atualizar liderança**             | Quem coordena / status / troca principal↔secundário (Fernando→Artur/Silvio) | **Sim — must** (pacote Cairu)                                                                              |
| A5  | **Registrar pedido (demanda)**      | Quadriciclo, material, diária                                               | **Sim** se der; senão logo após 03/08 — commit óbvio + **editar título** (U10)                             |
| A6  | **Ver quem ainda não está coberto** | Lista sem assessor × votos 2022                                             | **Sim** — não é wizard; é atalho para a lista (hit U7)                                                     |

### Ações secundárias (v1.1 / depois do chassis)

| #   | Rótulo                            | Nota                                                                                                                         |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A7  | Definir nível de envolvimento     | E14; raridade + nota obrigatória — encaixa como passo opcional no fim de A1/A2, não como botão do Início no dia 1            |
| A8  | Trocar assessor do município      | Já fez na lista com guia; passo opcional em A1 ou atalho na lista                                                            |
| A9  | Montar atividade / giro           | E13; não é o ritual das 7h                                                                                                   |
| A10 | Convidar liderança / abrir acesso | B30; onboarding, não delta                                                                                                   |
| A11 | Sugestões da campanha             | E11 vira **entrada alternativa** (“Amargosa: checar rede”) que **abre A1/A2/A4 pré-preenchidos**, não um terceiro modo de UI |

Assessor vê o mesmo bloco, escopo já filtrado pela carteira. Leader: fora de escopo (lockdown).

---

## Contrato compartilhado de todo wizard

Aplicar a A1–A5 (e futuros):

1. **Uma coluna / um passo visível** — pergunta em linguagem de mesa; avançar = Continuar / próximo campo; voltar = passo anterior (sem sidebar).
2. **Local cedo** — depois da ação, “Em qual município?” (busca por nome, acento-insensível; **tem que funcionar** — U11).
3. **Quem quando importar** — liderança/assessor só nos passos que pedem pessoa (A4; opcional em A1/A5).
4. **Continuidade** — no fim de A1, oferecer em sequência (checkboxes ou passos “Quer também…?”): sinal? tendência? liderança? assessor? — sem mandar para outra rota no meio.
5. **Commit final único e gritante** — rótulo tipo **“Registrar atualização”** / **“Enviar pedido”** (não “Salvar” / “Concluir” genérico). Passos intermediários auto-avançam ou gravam rascunho sem verbo órfão (U4/O11).
6. **Resumo antes do commit** — 4–6 linhas do que vai mudar (município, números, sinal, tendência).
7. **Pós-commit** — “Atualização registrada em Cairu” + **Fazer outra** / **Ir ao município** / **Voltar ao Início**. Sem sumir num detalhe cheio de abas.
8. **Interrupção** — rascunho recuperável (Zap vai tocar no meio); mínimo = município + ação lembrados ao reabrir.
9. **Mesmas rules de access/actions** que hoje — wizard é casca, não bypass.

Copy: zero “broker”, “campo sem captura”, “LQ” nos passos. Se precisar do número inteligente, uma linha de ajuda em português de mesa (“pessoas que votaram no presidente do campo e não votaram no Solla”).

---

## Fluxo A1 — Atualizar votos de um município

**Abre:** botão Início · ou sugestão E11 “atualizar projeção” · ou deep-link.

| Passo | Pergunta                            | UI                                                                              | Escrita (já existe / quase) |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| 1     | Em qual município?                  | Busca só municípios (UX Início, sem grupos); select → avança (**B60**)          | —                           |
| 2     | Qual a nova estimativa **média**?   | Input grande pré-preenchido + atalhos 2× / ±50 / ±100; CTA “Ajustar…” (**B61**) | `expectedVotes.central`     |
| 3     | E o **pessimista**?                 | Idem; se quebrar ordem vs média → jump + warning + atalho de volta (**B61**)    | `expectedVotes.pessimistic` |
| 4     | E o **otimista**?                   | Idem + coerência vs anteriores (**B61**)                                        | `expectedVotes.optimistic`  |
| 5     | Quer registrar **o que aconteceu**? | Sim → mini A2 (**B63**) / Não                                                   | `municipalityUpdate` sinal  |
| 6     | Quer mudar a **tendência**?         | Sim → A3 embutido (**B64**) / Não                                               | `politicalTrend` + nota     |
| 7     | Quer ajustar **liderança** agora?   | Sim → A4 embutido (curto) / Não                                                 | leadership / pledge         |
| 8     | Resumo → **Registrar atualização**  | CTA único                                                                       | actions existentes          |

**Corte 03/08 se apertar:** passos 1–4 + 8; 5–7 como “Quer também?” com um campo cada, sem sub-wizard profundo.

**Não fazer:** três telas separadas que exijam “Salvar” por cenário; abrir `/municipios/[slug]/editar`.

---

## Fluxo A2 — Registrar o que aconteceu (sinal)

**Modelo (B62, 2026-07-29):** só `signalType` + texto (`body`). **Sem** fonte nem triangulado. Rótulos de mesa (enum values estáveis): Invasão · Rede esfriou · Adversário apareceu · Alguém pediu algo · Outro.

| Passo | Pergunta           | UI                                                                                                                                               |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Em qual município? | Busca só municípios, select → avança (**B60**; pular se veio de A1)                                                                              |
| 2     | Que tipo?          | Grid de tiles grandes + Drawer de info por tipo (**B63**); “Pular registro de sinal” no topo direito **só se** a origem ≠ ação `register-signal` |
| 3     | Detalhe?           | Texto livre; Skip (mesma regra); **Salvar** inferior direito (**B63**)                                                                           |

Chrome de toda etapa: seta **Voltar** no topo esquerdo **só mobile**; desktop = browser (**B59**). Após escolher o município: **nome do município sticky no limite superior central**, semi-discreto (**B59** — absorvido 2026-07-29).

Opcional ao fim: “Isso muda a projeção de votos?” → entra em A1 / **B61**.

---

## Fluxo A3 — Mudar tendência

**Modelo (B64, 2026-07-29):** duas etapas após o município. Tiles no mesmo chassis do sinal (**B63**), mas fundo branco + cor/borda da tendência; só opções ≠ atual; título = estado atual (“Tendência Favorável”). Justificativa com prefill quando veio de outro fluxo; Limpar + Salvar. “Pular mudança de tendência →” nas duas etapas.

| Passo | Pergunta                        | UI                                                                                                             |
| ----- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1     | Em qual município?              | Busca só municípios (**B60**; pular se veio de A1)                                                             |
| 2     | Nova tendência?                 | Grid de tiles (≠ atual) + Drawer de info; skip no topo (**B64**)                                               |
| 3     | Por quê? (obrigatório se mudou) | Textarea (prefill ex.: sinal / ajuste de votos); Limpar; **Salvar** → `politicalTrend` (**B64** / write B24 ✓) |

Chrome: seta **Voltar** só mobile (**B59**). Também passo embutido de A1.

---

## Fluxo A4 — Atualizar liderança

Cobre o pacote Cairu sem exigir que ele ache a ficha da pessoa primeiro. Modelo: **B69** (`exclusive` default true; sem org/setor/`consentNote`). UI: **B70**.

| Passo | Pergunta           | UI / nota                                                                                                                                                                                                 |
| ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Em qual município? | Busca só municípios (**B60**; pular se veio de A1)                                                                                                                                                        |
| 2     | Quem?              | Grid de tiles (2/3/4 cols) + tile **Adicionar**; status no canto; info/hover = `notes`; nome truncado por palavra; telefone∥e-mail (**B70**). Skip “Pular atualização de liderança →” se origem ≠ A4      |
| 3     | Editar / criar     | Form curto: nome, celular, e-mail, status de apoio, observação, **apoio exclusivo**. Salvar → volta ao grid; se dirty, **Continuar** inferior direito. Focus no input principal ao abrir. Sem pledge aqui |
| 4     | Continuar / fim    | Avança fluxo pai ou Início + toast (standalone)                                                                                                                                                           |

**“Liderança é a dobradinha”:** reusar ficha `stateDeputy` + chips `stateDeputies` (B31 ✓) — sem campo novo. **Estimativa nunca neste fluxo.**

**Corte 03/08:** grid + form curto (status/obs/exclusivo/create); pledge rico e atalho criar-dobradinha ficam fora.

---

## Fluxo A5 — Registrar pedido (demanda)

| Passo | Pergunta                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Município?                                                                                                                                                     |
| 2     | O que precisam? (título — **editável depois**, U10)                                                                                                            |
| 3     | Detalhe / por quê?                                                                                                                                             |
| 4     | Tipo? (transporte, material, …)                                                                                                                                |
| 5     | Valor aproximado? (opcional)                                                                                                                                   |
| 6     | Ligado a quem? (liderança opcional)                                                                                                                            |
| 7     | Resumo → **Enviar pedido** (um CTA; aprovação do CG é passo seguinte **na mesma conversa** se for o CG: “Aprovar agora?” Sim/Não — não esconder em outro card) |

Bug/gap paralelo: **editar demanda existente** (pelo menos título e detalhe) sem rejeitar+recriar.

---

## Fluxo A6 — Atalho de lista (não wizard)

Botão: **“Municípios sem responsável”** (ou “Quem ainda não está coberto”).

→ `/campanha/municipios?coverage=sem_assessor&sort=votos` (ou equivalente canônico atual), com a **tabela above-the-fold**.  
Opcional: gravar como filtro salvo padrão no onboarding (B18).

Segundo atalho útil (não precisa de botão no dia 1): “Prioritários” → `?priority=alta`.

---

## Como as sugestões (E11) encaixam

Não competir com os botões.

- Card de sugestão: **Aceitar** abre o wizard certo com município (e padrão) pré-selecionados.
  - “Checar rede / segunda liderança” → A4
  - “Atualizar / risco de perda” → A1 ou A2
- **Adiar / Descartar** ficam no card (já existem).
- Copy do card: reescrever para linguagem de mesa quando o wizard existir.

---

## Início — o que sobe / o que desce

| Agora (aprox.)                        | Depois                                        |
| ------------------------------------- | --------------------------------------------- |
| Mapa primeiro                         | Ações primeiro                                |
| KPIs / cobertura                      | 2ª dobra ou strip compacta sob as ações       |
| Sugestões como painel                 | Atalhos que disparam wizards **ou** 2ª dobra  |
| Prioritários / visitados / onde estou | Mantém; abaixo das ações                      |
| Sidebar como descoberta de trabalho   | Sidebar = arquivo; trabalho começa nos botões |

---

## Bugs / gaps que o rascunho assume corrigidos (não são o wizard)

| ID  | Item                                                               | Por quê                                        |
| --- | ------------------------------------------------------------------ | ---------------------------------------------- |
| U10 | Editar título (e campos) de demanda                                | Sem isso A5 morre no segundo uso               |
| U11 | Filtro/busca de município na lista                                 | Mesmo controle de busca do passo 1 dos wizards |
| U9  | Overview do município editável in-place **ou** só saída via wizard | Evitar botão “Editar” como único caminho       |
| —   | Comparação de candidatos no mapa                                   | P0 demo; não bloqueia UX-1                     |

---

## Ordem de entrega sugerida

### Chassis do Início (registrado 2026-07-29)

0. **B43** Início em branco + Quadro/Contatos — [inicio-em-branco-quadro.md](inicio-em-branco-quadro.md)
1. **B44** Botão circular + strip horizontal — [botao-acao-inicio-strip.md](botao-acao-inicio-strip.md)
2. **B45** Catálogo por persona + botões (atalhos reais; wizards ainda inertes) — [catalogo-acoes-inicio-por-persona.md](catalogo-acoes-inicio-por-persona.md)

### Wizards (etapas compartilhadas registradas 2026-07-29)

3. **B59** Chassis (shell + voltar mobile) — [chassis-wizard-campanha.md](chassis-wizard-campanha.md)
4. **B60** Busca município (só municípios; select → avança) — [busca-municipio-wizard.md](busca-municipio-wizard.md)
5. **B61** Ajuste votos (média→pessimista→otimista + atalhos + coerência) — [ajuste-votos-wizard.md](ajuste-votos-wizard.md)
6. **B62** Simplificar modelo de sinal (tipo+texto; labels mesa) — [simplificar-modelo-sinal.md](simplificar-modelo-sinal.md)
7. **B63** Wizard sinal (grid tipo + texto + pular) — [wizard-registro-sinal.md](wizard-registro-sinal.md)
   7b. **B64** Wizard tendência — [wizard-mudar-tendencia.md](wizard-mudar-tendencia.md)
   7c. **B69** Simplificar modelo de liderança (`exclusive` + limpeza) — [simplificar-modelo-lideranca.md](simplificar-modelo-lideranca.md)
   7d. **B70** Wizard atualizar liderança (grid + form) — [wizard-atualizar-lideranca.md](wizard-atualizar-lideranca.md)
8. **A1** wiring (orquestrar B60+B61 + “quer também?” sinal/tendência/liderança + resumo/CTA)
9. **A6** — atalho já em B45 (`uncovered-municipalities`)
10. **A2** standalone = B60+B63 (se não ficou bom só embutido em A1)
11. **A4** = B60+B70 · **A5** + edição de demanda · E11 → wizards · A3 standalone = B60+B64

---

## Perguntas em aberto (decidir antes de implementar)

1. **Um wizard “Atualizar município”** que sempre oferece votos+sinal+tendência+liderança, ou **botões separados** A1–A4 no Início? (Recomendação: botões separados + “quer também?” no fim de A1 — casa com U2 e com o pacote Cairu.)
2. Wizards são **rota** (`/campanha/acoes/atualizar-votos`) ou **Sheet/Drawer** em cima do Início? (Recomendação: rota — sobrevive a refresh/interrupção Zap; URL compartilhável com assessor.)
3. Assessor pode ver os mesmos botões? (Recomendação: sim, escopo da carteira na busca.)
4. Após commit, **revalidate** só do município ou também empurrar para a lista filtrada? (Recomendação: toast + opção “ver na lista”.)

---

## Fora de escopo deste rascunho

- Redesign completo do detalhe / abas
- Remover o mapa
- Substituir o sistema de listas
- App nativo / WhatsApp bridge (D3)
- Treinar o CG no IA atual
