# Pessoas: qualquer pessoa pode assessorar, liderar e/ou dobrar — ciclo de vida nas tabelas pela lista

Status: rascunho
Atualizado em: 2026-08-11
Issue: #695
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — encaixe nas células de capacidade de `/campanha/pessoas` (mesma superfície da C116)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-pessoas-ajustes-ui-draft.canvas.tsx (seção "Qualquer pessoa pode ganhar qualquer capacidade")
Appetite: ~2–3 dias eng; ciclo de vida completo das três capacidades num único recorte
Responsável: —

## Intenção

Hoje, na lista de pessoas, só dá para **adicionar municípios** de uma capacidade se a pessoa **já existe** naquela tabela: a célula "Assessora" só edita quem já tem conta staff; "Lidera" só quem já é liderança; "Dobra em" só quem já é dobradinha. A mesa precisa tratar a **pessoa** como o dado central — qualquer pessoa pode ganhar qualquer capacidade, e o vínculo com a tabela nasce/morre com a primeira/última cidade.

## Persona e fluxo

- **Persona / contexto:** coordenador/candidato na mesa (a criação de conta staff é restrita a eles); assessor continua vendo/validando a carteira dele.
- **Job principal:** dar o primeiro município de uma capacidade a uma pessoa (ou tirar o último) sem sair de `/campanha/pessoas` — o cadastro na tabela correspondente acontece sozinho.
- **Fluxo desejado:** abro `/campanha/pessoas` → vejo a pessoa → adiciono a primeira cidade em "Dobra em" → a pessoa passa a existir na tabela de Dobradinhas (e o chip da coluna aparece). Removo a última cidade de "Lidera" → a pessoa sai da tabela de Lideranças (com confirmação se houver votos declarados).
- **Anti-goals de produto:** não é um cadastro genérico de pessoa novo (a ficha continua `Contact`); não cria fluxo de criação "de pessoa do zero" na lista (sem capacidade a pessoa não tem linha); não é segundo caminho para convidar/invitar — o convite de cadastro continua o fluxo existente.

## Objetivo e aceite

- As três colunas de capacidade (Assessora, Lidera, Dobra em) ficam **editáveis para toda pessoa visível**, independente de a capacidade já existir — o texto de "sem permissão"/read-only desaparece dessas células (o escopo de acesso por ator continua valendo).
- **Primeira cidade adicionada → a pessoa é criada na tabela da capacidade:** primeira cidade em Assessora → vira Assessor (conta staff com a carteira); primeira em Lidera → entra em Lideranças; primeira em Dobra em → entra em Dobradinhas.
- **Última cidade removida → a pessoa é apagada daquela tabela:** sai de Assessores (conta staff), sai de Lideranças, sai de Dobradinhas — sem violar regras de "mínimo de 1 município".
- A saída destrutiva (votos declarados da liderança, conta de acesso) pede **confirmação explícita** que lista o que será removido — precedente da cascata de "Apagar pessoa".
- Uma pessoa pode ter as três capacidades ao mesmo tempo; as colunas continuam independentes (criar/remover uma não toca as outras).
- A mesma regra de acesso de hoje permanece: criação/remoção de Assessor (conta staff) é coordenação/candidato; assessor edita só o que está na carteira dele.
- As listas especializadas (`/liderancas`, `/dobradinhas`, `/assessores`) continuam funcionando como hoje (o piso de 1 município da liderança passa a ser garantido pelo ciclo de vida, não pela célula).

## Dados (intenção)

- **Vou apresentar dados?** Não — as colunas expressam vínculos (território), não métricas.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` (matriz de editabilidade C116 e células `PeopleMunicipalityCell`), `src/app/(campaign)/campanha/actions/person.ts` (escritas por capacidade), `src/utilities/people/peopleData.ts` (merge por Contact), utilitários de domínio (leadership/stateDeputy/advisor), cascata de apagar pessoa (`personDelete.ts`) como mapa de referência das relações.
- **Precedente a olhar:** C116 (matriz de edição), C100 (merge por Contact, decisões de capacidade), C99 (vínculo conta staff → Contact), cascata de apagar conta (`campaignUser` beforeDelete).
- **Risco de acoplamento:** a criação de conta staff é auth (sessões, acesso ao `/campanha`) — o executor precisa preservar todos os guardrails existentes (acesso por coleção, lockdown de leader); a remoção de última cidade de Liderança destrói votos declarados — nada pode ser apagado sem confirmação explícita.

## Dependências

- Nenhuma dura. Encaixa na mesma superfície de C129/C130/C131 (sem dependência de ordem).

## Fora de escopo

- Incluir pessoas sem nenhuma capacidade na lista (decisão C100 "não no v1" permanece) — continua-se entrando por uma capacidade existente ou pelas listas especializadas.
- Fluxo de convite/invite generalizado; ferramenta de "mesclar pessoas"; alterações nas listas especializadas além do mínimo para não quebrar com o ciclo de vida.
- Pessoas com mais de uma conta staff seguem sem edição da célula Assessora (ambiguidade de "qual conta") — igual hoje.

## Rabbit holes de produto

- **Cascata de apagar dobradinha**: a dobradinha é referenciada por lideranças (`leadership.stateDeputies`) e municípios; remover a última cidade precisa limpar os vínculos sem destruir nada além da dobradinha. **Corte:** limpeza automática dos vínculos na mesma transação, sem confirmação extra (não há dado de campanha próprio da dobradinha além dela).
- **Contas staff existentes com carteira vazia**: decisão C100 diz que staff com carteira vazia ainda é capacidade. **Corte:** o ciclo de vida só vale para mudanças feitas pelas células; contas vazias pré-existentes continuam como estão (removíveis pelo fluxo "Apagar pessoa").
- **"Primeira cidade" em lote**: o chip de território/ZE adiciona várias cidades de uma vez — a criação da entidade dispara na primeira do lote, e a remoção na última. **Corte:** o lote inteiro é uma transação única; se a entidade for criada e depois o lote falhar, nada fica pela metade.
- **Pergunta de onde nasce a pessoa**: se a lista só mostra quem já tem capacidade, "adicionar a primeira capacidade" só vale para quem entrou por outra capacidade — o executor não deve inventar busca de Contatos sem capacidade. **Corte:** v1 sem.

## Questões em aberto (produto)

_Decididas no gate 2026-08-11 (não reabrir sem evidência nova):_

- **Conta staff ao nascer Assessor: já nasce com login?** **Decidido:** conta criada sem e-mail/username utilizáveis — aparece em Assessores, login é provisionado depois (fluxo à parte).
- **Remover a última cidade de Liderança com votos declarados?** **Decidido:** permitir com diálogo de confirmação listando os votos que serão removidos — o gesto "remover a última cidade" é intenção explícita de encerrar a liderança (precedente da cascata de apagar).
- **Criação de Assessor exige papel fixo?** **Decidido:** sempre `advisor` — a célula diz "Assessora"; papel diferente é provisionamento à parte.

## Referências

- Canvas UI (gate): plan-pessoas-ajustes-ui-draft.canvas.tsx (seção C128)
- Planos: [pessoas-lista-unificada.md](pessoas-lista-unificada.md) (C100), [pessoas-edicao-inplace-lista.md](pessoas-edicao-inplace-lista.md) (C116), [pessoas-identidade-contact.md](pessoas-identidade-contact.md) (C99)
- `AGENTS.md` — modelo Municípios, roles, leader lockdown, transações multi-coleção
