# Roteiro — entrevista de discovery com a persona especialista

Status: rascunho (pré-colaboração)
Atualizado em: 2026-07-21
Entrevistada: Prof. Helena Rocha ([persona sintética](persona-cientista-politico-campanha-ba.md), executada em subagent isolado grounded só na persona + compêndio)
Entrevistador: agente principal (produto Teqo)

## Natureza e adaptação de método

Isto é uma **entrevista de especialista**, não de cliente. As regras Mom Test valem adaptadas: (1) falar da realidade estudada, não do nosso produto — nada de pitch de feature; (2) ancorar em **casos concretos da literatura/campanhas estudadas**, não em "você acha que…?" hipotético sobre o app; (3) a persona fala 80%+. O que no Mom Test é "última vez que aconteceu com você" vira aqui "campanha/caso concreto que você estudou onde isso aconteceu". Compliments não existem (persona não tem incentivo social), mas **viés de literatura** sim — descontar os vieses declarados na persona.

O objetivo NÃO é validar o Teqo (a persona não é usuária); é extrair o modelo de decisão de uma campanha de DF na Bahia para depois confrontar com o coordenador real (sessão Wed em `docs/CUSTOMER.md`).

## Objetivos fixados (do plano)

1. Maiores desafios de **gerenciar** campanha de dep. federal na Bahia.
2. Jobs de decisão semanais/diários do coordenador (alocar assessor, priorizar praça, dobradinha, agenda).
3. Quais **análises** mudam alocação de esforço (OMTM de campanha, não vanity metric).
4. Quais **funcionalidades** valem o Little Hire vs. WhatsApp/planilha.
5. **Mapa:** o que destacar quando % dos válidos é baixo e visualmente homogêneo.

## Bloco A — O trabalho de coordenar (JTBD; ~15 min)

A1. Nas campanhas de deputado federal que você estudou ou assessorou, descreva o trabalho real do coordenador-geral numa semana típica de setembro. O que ele decide de fato — e o que só referenda?
A2. Conte um caso concreto (da sua pesquisa ou consultoria) em que uma campanha de DF **realocou esforço de território no meio do jogo**. O que disparou a decisão? Que informação usaram? O que aconteceu?
A3. Onde essas decisões erram com mais frequência? Qual o erro de alocação territorial mais caro que você já documentou?
A4. Quem participa dessas decisões além do coordenador (candidato, assessores, prefeitos aliados, partido)? Quem ganha a queda de braço quando os dados dizem uma coisa e a política diz outra?

## Bloco B — Desafios de gerenciamento (kernel; ~10 min)

B1. Se você tivesse que apontar O desafio crítico — o gargalo que, resolvido, destrava o resto — de uma campanha de DF do campo progressista na Bahia em 2026, qual seria? Por quê esse e não outro?
B2. O que a literatura diz que campanhas acham que é o problema, mas não é (falso diagnóstico comum)?
B3. Campanhas com pouco dinheiro: o que a evidência diz que elas devem parar de fazer?

## Bloco C — Análises que mudam decisão (Lean Analytics; ~15 min)

C1. Das métricas territoriais da sua caixa de ferramentas (dominância, concentração, G/LQ, NEC, desequilíbrio, série histórica), quais **de fato mudaram uma decisão** em casos que você conhece — e quais são refinamento acadêmico que campanha nenhuma usa?
C2. Se a campanha só pudesse acompanhar UMA métrica semanal até 16/08 (One Metric That Matters), qual deveria ser? Como ela se decompõe em meta por praça?
C3. Que métrica parece útil mas é vaidade neste contexto (falso sinal)?
C4. Pledges de lideranças (fulana declara N votos na praça X): a literatura trata isso como dado confiável? Como uma campanha deveria descontar exagero e desatualização?
C5. Qual análise de RISCO uma campanha de DF ignora com mais frequência (invasão de reduto, NEC subindo, dependência de poucos brokers…)?

## Bloco D — Mapa e visualização (decisão → representação; ~10 min)

D1. Situação real da nossa base: mapa coroplético da Bahia, % dos válidos do candidato por praça, escala 0–100%; quase tudo fica na mesma cor porque o topo estadual de um DF é ~5%. Da sua experiência com dados TSE: **que pergunta de decisão** um mapa de campanha de DF deveria responder primeiro?
D2. Para essa pergunta, que transformação da escala você usaria (quantis do próprio candidato, LQ, rank na praça, classes operacionais…)? O que a cartografia manda fazer e o que ela proíbe aqui?
D3. Interior enorme e visualmente dominante vs. Salvador minúscula com ~1/5 do eleitorado: como você já viu isso ser resolvido bem (value-by-alpha, símbolo proporcional, cartograma)? O que é sofisticação demais para uso em campo?
D4. Os limiares defesa/ataque/indecisa/perdida calibrados como 35/20/10% dos válidos: o que acontece quando se aplica isso a uma disputa de DF? Como você calibraria?

## Bloco E — Ferramenta e adoção (Little Hire; ~5 min)

E1. Campanhas que você estudou tentaram adotar sistemas (planilha central, CRM, app): conte um caso que morreu e um que pegou. O que diferenciou?
E2. Que registro o time de campo **continua fazendo em outubro**, quando o cansaço bate — e que registro abandona primeiro?

## Bloco F — Fechamento (~5 min)

F1. O que nesta conversa é hipótese sua (literatura) vs. o que você apostaria dinheiro que o coordenador real vai confirmar?
F2. Que pergunta nós deveríamos fazer ao coordenador real na quarta-feira que ainda não sabemos fazer?
F3. (Commitment adaptado) Que evidência do TSE/da literatura você nos indicaria ler antes de mexer no mapa?

## Regras de condução

- Follow-ups Mom Test: "conte o caso", "o que fizeram então?", "por que isso importa?", "quanto custou?".
- Se a persona generalizar ("campanhas costumam…"), pedir o caso/estudo concreto e a fonte.
- Se a persona opinar sobre UI/telas, redirecionar para a pergunta de decisão (limite declarado da persona).
- Registrar transcrição como apêndice do relatório; separar fato-da-literatura vs. interpretação-da-persona.
- Anti-padrões: não pitchar o Teqo; não perguntar "você usaria/acha bom o X?"; não aceitar resposta sem fonte ou caso.
