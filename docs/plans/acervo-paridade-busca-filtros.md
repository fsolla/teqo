# C219 — Paridade de busca e filtros entre as fontes do acervo

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1295
Priority: P2
Impeccable: B — encaixe na tela existente do acervo (barra de filtros e facetas da fonte de gravações)
Design UI: docs/plans/acervo-paridade-busca-filtros-ui-design.html
Appetite: ~2–3 dias eng; a assessoria filtra "Gravações enviadas" por ano, duração, tema, alcance e município citado, e busca por tema como na Câmara, com o mesmo comportamento de filtros
Responsável: —

## Intenção

O dono percebeu o desnível: "o 'Gravações enviadas' não está hoje com todas as funcionalidades de pesquisa e filtro que temos para 'Falas da Câmara'". As duas fontes vivem no mesmo acervo, mas a experiência é desigual — a Câmara tem busca por termo/tema, ano, duração e facetas de conteúdo; as gravações têm só busca textual e pessoa. Quem garimpa uma plenária enviada trabalha com menos instrumentos do que quem garimpa um discurso de plenário.

Este item fecha as lacunas da fonte de gravações e deixa registrado o contrato que **toda** fonte do acervo deve cumprir — a fonte nova ("Falas na internet", C216) nasce com ele. Paridade é do conjunto de capacidades, não de facetas idênticas: "Pessoa" continua exclusiva das gravações.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) — e `coordinator`/`candidate` — na mesa, sob prazo curto, garimpando fala em plenárias/debates enviados pela equipe; busca também acontece em campo.
- **Job principal:** achar a gravação/trecho sobre um assunto, tema, ano ou município com os mesmos gestos que já usa nas falas da Câmara.
- **Fluxo desejado:**
  1. Abre o acervo e alterna para "Gravações enviadas".
  2. Digita o assunto e escolhe termo exato ou por tema (como na Câmara).
  3. Restringe por ano, duração, tema, alcance e município citado; combina filtros e vê a contagem.
  4. Vê os chips dos filtros ativos, limpa um ou todos, reordena.
  5. Abre a gravação e assiste/baixa (fluxo atual intocado).
  6. Vazio honesto quando nada serve; gravação sem transcrição segue visível, fora dos filtros de conteúdo.
- **Anti-goals de produto:** não unifica as fontes numa lista única; não vira curadoria de taxonomia; não cria cadastro de pessoa; não redesenha a barra da Câmara; não classifica conteúdo de terceiros (C211 é outro dono).

### Esboço de fluxo (B)

```text
[fonte "Gravações enviadas"] → busca (termo | tema) + ano + duração + tema + alcance + município
  → lista com trecho destacado, contagem, chips ativos e ordenação
  → abre a gravação → player/transcrição/baixar (como hoje)
  → vazio honesto: limpar filtros | trocar modo
[outcome: achar a gravação certa com os mesmos gestos da Câmara]
```

### Design UI (B)

- Design UI (gate): `docs/plans/acervo-paridade-busca-filtros-ui-design.html`
- Por que B: as capacidades já existem na tela; o item estende a barra de filtros e a lista da fonte de gravações na linguagem da Câmara, sem rota nova. Design hi-fi obrigatório no gate e fonte de verdade do port.

```text
[Câmara]  busca [termo|tema] · Ano · Tema · Alcance · Município · Fase · Duração
[Enviadas] busca [termo|tema] · Ano · Tema · Alcance · Município · Duração · Pessoa
```

## Objetivo e aceite

- Contrato de paridade do acervo cumprido por toda fonte, no que for aplicável: busca textual com destaque; contagem; paginação; busca semântica `mode=termo|tema`; filtro por data/ano; filtro por duração; facetas de conteúdo quando houver classificação; ordenação; estados vazio/carregando/sem permissão.
- "Gravações enviadas" ganha: ano (data da gravação), duração, busca por tema (`mode=tema`) e facetas Tema/Alcance/Município citado — derivadas por classificação automática com proveniência (`classifiedBy`), sobre a transcrição já existente.
- Mesma experiência de filtros da Câmara: chips dos ativos, limpar, contagem, paginação preservada no deep link.
- Classificação é automática e revisável; nunca inventa — falha degrada para o que existir e é sinalizada; combina com os filtros existentes (`q`, Pessoa) sem regressão.
- **Guardrails:** sem segundo cadastro de pessoa ("Pessoa" continua rótulo, C200); gate fail-closed do acervo intocado; acervo interno; sem score/vaidade.

## Dados (intenção)

- **Vou apresentar dados?** N/A — resultados e facetas de busca são recorte editorial, não métrica nem agregado.
- **Decisões desbloqueadas:** N/A — a escolha ("qual gravação/fala serve") é qualitativa.
- **Forma:** N/A — sem superfície de dados; restrição de produto: proveniência é rótulo auditável, nunca score numérico na UI.

## Dados da decisão (literais)

- **Contrato de paridade (capacidades):** busca textual com destaque do termo · contagem de resultados · paginação · busca semântica `mode=termo|tema` · filtro por data/ano · filtro por duração · facetas de conteúdo (tema, alcance, municípios citados) quando a fonte tiver classificação · ordenação · estados vazio/carregando/sem permissão.
- **Faceta exclusiva não quebra paridade:** "Pessoa" permanece só em "Gravações enviadas"; o contrato é do conjunto de capacidades, não de facetas idênticas.
- **Rótulos novos nas gravações:** "Ano" · "Duração" · "Tema" · "Alcance" · "Município citado"; buckets de duração idênticos à Câmara ("Até 2 min" · "2 a 5 min" · "Mais de 5 min" · "Sem duração").
- **Ano:** derivado da data da gravação já informada no envio (`recordedAt`) — nunca um segundo campo digitado.
- **Proveniência:** mesmos valores da Câmara — `gazetteer` | `llm` | `manual` (campo `classifiedBy`) na fonte de gravações.
- **Modo de busca:** `mode=termo` é o default (nunca serializado; deep-links atuais intactos) e `mode=tema` é explícito, como na Câmara.
- **Ordenação (rótulos):** "Mais recentes" (default) · "Duração (maior)" · "Duração (menor)".
- **Papéis/gate:** mesmo gate de leitura do acervo (`communicator` + `coordinator`/`candidate`; `advisor`/`leader` negados, fail-closed).
- **URL:** a fonte mantém `?source=enviadas` e ganha os novos params no seu contrato; o contrato da Câmara não muda.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/recordings/` (`recordingListUrl.ts`, `recordingListFilters.ts`, `recordingPageData.ts`, `recordingViewModels.ts`), `src/components/campaign/recording/` (barra de filtros e lista), `src/collections/Recording.ts` (facets + proveniência), `src/utilities/speech/speechClassifier.ts` (dono único — reusar, não duplicar), `src/utilities/ai/expandSpeechSearchTheme.ts` (ponte de tema por corpus), `src/lib/speechFacets.ts` (taxonomia única).
- **Precedente a olhar:** `SpeechAcervoFilters.tsx` + `speechListUrl.ts`/`speechListFilters.ts` (C154/C192) para a experiência e o contrato; C200 (Pessoa como rótulo derivado); import da Câmara (`scripts/import-camara-speeches.mjs`) para o padrão de classificação com proveniência.
- **Risco de acoplamento:** o contrato de `source=enviadas` sustenta deep-links (`q|person|page`) — não quebrar; classificar a transcrição existente sem tocar diarização/rótulos (C200); um só dono de classificador e taxonomia; gate fail-closed intocado.

## Dependências

- **Nenhuma dura.**
- **Soft (serialize): C216** — a fonte nova nasce com o contrato; se ambos estiverem em voo, serializar nos componentes de filtros do acervo (mesmos arquivos).

## Fora de escopo

- Fonte web "Falas na internet" (C215/C216) — o contrato vale; a implementação é de lá.
- Cortes/clipes (C217) e a skill do acervo (C218).
- Diarização e edição de transcrição (C200 / itens próprios).
- Merge das fontes numa lista única / busca global.
- Classificação de conteúdo de terceiros na Central de Conteúdos (C211).

## Rabbit holes de produto

- **Unificar as fontes numa busca só.** Se alguém "só completar": lista Câmara+gravações+web, paginação multi-coleção, ranking entre fontes. **Corte neste item:** cada fonte mantém sua lista; paridade é de capacidades.
- **Redesenhar a barra de filtros da Câmara.** Se alguém "só completar": shell novo e migração de todos os filtros. **Corte:** a Câmara é a referência; muda-se a fonte de gravações.
- **Classificar por segmento/falante.** Se alguém "só completar": tema por trecho, timeline por pessoa. **Corte:** classificação no nível da gravação, como a fala é a unidade da Câmara.
- **Segundo cadastro de pessoa.** **Corte:** "Pessoa" continua rótulo (C200).
- **Dashboard de vaidade.** **Corte:** nada de métrica de busca/uso.

## Questões em aberto (produto)

- **Classificar as gravações para ter tema/alcance/municípios?** **Opções:** A) sim, classificação automática com proveniência | B) não, só filtros genéricos (ano/duração/semântica). **Recomendação:** A — sem classificação não há paridade real de facetas; a proveniência mantém tudo auditável. _(confirmado no gate, 2026-09-24)_
- **Ordenação?** **Opções:** A) data (mais recente primeiro) + duração (maior/menor) | B) só data. **Recomendação:** A — achar o trecho longo/curto é gesto recorrente de quem monta peça. _(confirmado no gate, 2026-09-24)_
- **Busca semântica nas gravações?** **Opções:** A) estender a ponte de tema ao corpus de gravações | B) só busca literal. **Recomendação:** A — é a paridade pedida; a ponte já existe e degrada sozinha. _(confirmado no gate, 2026-09-24)_
- **Gravação sem transcrição (processando/falhou)?** **Opções:** A) fica fora dos filtros de conteúdo e visível como hoje | B) esconder da lista. **Recomendação:** A — estado honesto (como no C199); esconder faz o arquivo sumir sem explicação. _(confirmado no gate, 2026-09-24)_
- **Ano da gravação?** **Opções:** A) derivar da data já informada | B) criar campo próprio. **Recomendação:** A — uma fonte de verdade da data; campo próprio criaria dupla digitação. _(confirmado no gate, 2026-09-24)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Design UI (gate): `docs/plans/acervo-paridade-busca-filtros-ui-design.html`
- Planos irmãos: `docs/plans/acervo-videos-comunicacao.md` (C154) · `docs/plans/acervo-gravacoes-enviadas.md` (C199) · `docs/plans/acervo-separacao-por-pessoa.md` (C200) · `docs/plans/acervo-busca-semantica.md` (C192)
- Arquivos-pista: `src/utilities/recordings/recordingListUrl.ts` · `recordingListFilters.ts` · `recordingPageData.ts` · `src/components/campaign/recording/` · `src/components/campaign/speech/SpeechAcervoFilters.tsx` · `src/utilities/speech/speechClassifier.ts` · `src/utilities/ai/expandSpeechSearchTheme.ts` · `src/lib/speechFacets.ts` · `src/collections/Recording.ts`
- `AGENTS.md` — RBAC de `/campanha`, acervo interno e leader lockdown
