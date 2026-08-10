# Telefone não único: duas pessoas podem compartilhar o mesmo celular

Status: registrado (blocked até plano em main)
Atualizado em: 2026-08-10
Issue: #625
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: A — N/A (nenhuma superfície nova; comportamento de escrita, sem UI)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Hoje o sistema recusa salvar uma pessoa cujo celular já pertence a outro contato
("Já existe outro contato com este celular"). Na prática, números compartilhados
são comuns — aparelho de família, número do comitê, número que passou de mão — e
a recusa trava o fluxo de gestão da mesa: a ficha não salva, o assessor fica sem
saída e inventa um número errado ou deixa a pessoa sem telefone. O telefone é um
**canal de contato**, não a identidade da pessoa — a identidade é a ficha `Contact`
(entrega C99). Queremos que duas pessoas possam ter o mesmo número, sem bloquear
nenhum fluxo de cadastro ou edição.

## Persona e fluxo

- **Persona / contexto:** staff da mesa (coordenação e assessores) cadastrando e
  editando pessoas — lideranças, apoiadores, dobradinhas, assessores — além do
  fluxo de importação de apoiadores por CSV.
- **Job principal:** salvar a ficha de uma pessoa com o número real dela, mesmo
  que outra pessoa já use o mesmo número.
- **Fluxo desejado:** a assessora salva a liderança Ana com o celular que já é do
  comitê → **salva sem erro** → a ficha fica completa com o número real. A busca
  por telefone continua encontrando as duas pessoas. Fluxos automáticos (import,
  convite) tratam números compartilhados **sem adivinhar** de quem são.
- **Anti-goals de produto:** esta entrega não reconcilia fichas duplicadas do
  histórico (fora de escopo, pós-eleição); não muda o que as listas exibem; não
  cria um "identificador" novo para a pessoa.

### Esboço de fluxo (A — omitido; sem UI nova)

## Objetivo e aceite

- Cadastrar ou editar uma pessoa com telefone igual ao de outra pessoa **salva
  sem erro**, em qualquer um dos cinco fluxos de escrita de pessoa (liderança,
  apoiador, dobradinha, assessor, pessoa).
- As mensagens de erro de conflito de celular ("já existe outro contato…")
  deixam de aparecer nos fluxos de gestão.
- Fluxos automáticos que usam o telefone como chave (import CSV, convite por
  telefone, login de liderança) continuam funcionando; quando o número é
  compartilhado, eles **falham fechado com mensagem clara** ou usam a chave que
  não é ambígua — nunca "chutam" qual pessoa.
- Nenhum outro campo de `Contact` muda; a busca por telefone continua achando
  todas as pessoas com aquele número.

## Dados (intenção)

Dados: N/A — nenhuma métrica nova; a mudança é de escrita e matching de contato.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/contactPhoneInvariant.ts` (regra de
  unicidade e locks), `src/collections/Contact.ts` (hook de validação),
  `src/collections/CampaignUser.ts` (sincronização conta↔ficha),
  `src/utilities/campaignInviteRedemption.ts` (login/convite por telefone),
  `src/app/(campaign)/campanha/actions/supporterImport.ts` (dedupe do CSV),
  forms de liderança/apoiador/dobradinha/assessor/pessoa.
- **Precedente a olhar:** C99 (`docs/plans/pessoas-identidade-contact.md`) —
  declarou o telefone como chave de dedupe da ficha; esta entrega reabre essa
  política por pedido do produto; C100 (lista de pessoas).
- **Risco de acoplamento:** o telefone é hoje a chave "pessoa ↔ ficha" em vários
  fluxos (import, convite, resolução de conta). Cada fluxo precisa de um
  comportamento definido para números compartilhados — sem criar identidade
  ambígua nem bloquear a gestão.

## Dependências

- Nenhuma dura. Não deve rodar em paralelo com trabalho que edite os mesmos
  arquivos de escrita de pessoa (ver `serializes` na Issue).

## Fora de escopo

- Múltiplos telefones por pessoa → item **C112** (dependente deste).
- Reconciliação de fichas duplicadas existentes (mesma pessoa em duas fichas) —
  aceita e visível; reconciliação segue pós-eleição.
- Mudar o que as listas mostram (telefone principal, colunas) → fora.

## Rabbit holes de produto

- **"Já que vamos desbloquear, deduplicar as fichas existentes".** Explosão de
  escopo e risco em janela eleitoral. **Corte neste item:** só o comportamento de
  escrita; reconciliação segue pós-eleição.
- **"Telefone vira chave solta: import passa a criar ficha nova sempre".**
  Perde o casamento pessoa↔ficha do CSV. **Corte:** matching por telefone
  continua onde existe, com falha fechada na ambiguidade.

## Questões em aberto (produto)

- **Import CSV casa linhas por telefone; com números compartilhados, o que o
  import faz?** **Opções:** A) mantém o casamento por telefone e falha fechado
  quando o número pertence a mais de um contato — a linha fica sinalizada para
  resolução manual; B) para de casar por telefone e cria fichas novas. **Recomendação:
  A** — o casamento por telefone é o jeito mais confiável de reencontrar a
  pessoa no re-import; ambiguidade pede decisão humana, nunca chute. _(assumido —
  validar com produto)_
- **Login de liderança é pelo celular (nome de usuário da conta). Duas
  lideranças com o mesmo número: a segunda entra como?** **Opções:** A) a conta
  continua única — quem não tem número exclusivo usa e-mail para entrar;
  B) bloqueia criar a segunda conta com o mesmo número. **Recomendação: A** —
  o login é de conta, não de pessoa; o bloqueio de conta recriaria o problema
  que esta entrega resolve. _(assumido — validar com produto)_
- **Convite por telefone para número compartilhado:** a quem o convite vincula?
  **Opções:** A) falha fechado pedindo escolher a ficha; B) vincula à ficha de
  quem gerou o convite (o convite nasce de uma ficha). **Recomendação: B** — o
  convite já é gerado a partir de uma pessoa; o número é só o canal de envio.

## Referências

- C99 `docs/plans/pessoas-identidade-contact.md` · C100 `docs/plans/pessoas-lista-unificada.md`
- C6 `docs/plans/escala-dry-pos-c6.md` (import com dedupe por telefone)
- `src/utilities/contactPhoneInvariant.ts` (regra atual a reavaliar)
