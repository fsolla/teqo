# Serializar mutações do editor de relações por célula

Status: rascunho
Atualizado em: 2026-08-05
Issue: #378 (registrada via agent:register)
Priority: P2
Model: `composer-2.5`
Impeccable: A — N/A
Canvas UI: N/A
Appetite: ~0,5 dia eng
Responsável: —

## Intenção

O editor compartilhado de relações da lista de municípios permite interações rápidas e otimistas. Quando duas alterações da mesma célula ficam simultaneamente em trânsito, a ordem em que as transações terminam no banco pode divergir da ordem escolhida pela pessoa. O estado exibido e o estado persistido podem então representar intenções diferentes.

Esta entrega deve garantir que mutações de uma mesma célula sejam persistidas na ordem em que foram solicitadas, mantendo a resposta imediata da interface.

## Persona e fluxo

- **Persona / contexto:** coordenação e assessoria ajustando relações diretamente na lista de municípios.
- **Job principal:** fazer várias inclusões ou remoções rápidas e confiar que o último estado escolhido será o persistido.
- **Fluxo desejado:** abrir uma célula, alternar relações em sequência, continuar vendo a resposta otimista e terminar com interface e banco refletindo a mesma ordem de intenção.
- **Anti-goals de produto:** criar protocolo global de versionamento, alterar permissões ou redesenhar o editor.

## Objetivo e aceite

- Duas ou mais mutações rápidas da mesma célula são enviadas ao servidor na ordem da interação.
- Uma falha intermediária não apaga uma alteração posterior válida nem deixa o editor preso em estado de carregamento.
- Células e linhas diferentes continuam podendo salvar em paralelo.
- Testes cobrem conclusão e falha fora de ordem no transporte simulado e confirmam o estado persistido final.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** a pessoa pode editar relações rapidamente sem precisar esperar cada salvamento terminar.
- **Forma:** N/A — não há nova apresentação de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `MunicipalityRelationEditor`, wrappers de assessores/lideranças/dobradinhas e seus testes.
- **Precedente a olhar:** fila local por chave de célula, preservando a camada otimista separada do último estado confirmado.
- **Risco de acoplamento:** a fila deve ser por instância/célula; uma fila global degradaria edições independentes.

## Dependências

- B159 — editor compartilhado de relações na lista de municípios.

## Fases verificáveis

1. Modelar e testar uma fila de mutações por célula, incluindo sucesso, falha e interação posterior durante uma requisição.
2. Integrar a fila ao editor compartilhado sem alterar os contratos dos wrappers.
3. Validar os fluxos de assessores, lideranças e dobradinhas com testes focados e gates do repositório.

## Já resolvido no simplify/critique (não reabrir)

- Reconciliação de props externas sem requisição pendente.
- Deduplicação da opção criada quando o RSC atualiza antes da resposta da criação.
- Separação entre itens conhecidos para display e opções realmente selecionáveis.

## Explicitamente fora

- Versionamento otimista ou idempotency key no servidor; reavaliar apenas se outras superfícies também exigirem concorrência entre clientes.
- Mudanças de schema, migrations, acesso, rotas ou contratos públicos.
- Refatorar ações específicas de cada tipo de relação além do necessário para consumir a fila.

## Rabbit holes de produto

- **Transformar consistência local em protocolo distribuído.** Isso amplia o escopo para todas as mutações da campanha. **Corte neste item:** ordenar somente as chamadas originadas por uma instância do editor.
- **Bloquear a interface durante o salvamento.** Isso elimina a condição por restrição de uso, mas perde a edição rápida que motivou o componente. **Corte neste item:** manter o feedback otimista e serializar apenas o transporte.

## Questões em aberto (produto)

- Nenhuma; o comportamento esperado é preservar a ordem de intenção sem mudar a interação visível.

## Referências

- GitHub Issue #378 (B160)
- GitHub Issue #374 (B159)
- `docs/plans/generalizar-colunas-relacao-municipios-impl.md`
- `src/components/campaign/shared/MunicipalityRelationEditor.tsx`
