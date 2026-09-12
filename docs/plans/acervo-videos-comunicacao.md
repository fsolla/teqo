# Vertical Comunicação: papel communicator + Acervo pesquisável

Status: rascunho
Atualizado em: 2026-09-12
Issue: #956
Priority: P1
Impeccable: C — fluxo novo na vertical `/campanha/comunicacao`
Rascunho UI: docs/plans/acervo-videos-comunicacao-ui-draft.html
Appetite: ~2–3 dias; um outcome verificável — o assessor de comunicação entra com acesso próprio, busca uma fala por tema/município e assiste/baixa o trecho
Responsável: —

## Intenção

A comunicação da campanha depende de garimpar falas do Solla em YouTube e no portal da Câmara — sem busca, sem minutagem e sem saber o contexto. Este item abre a vertical de comunicação para quem produz conteúdo: um acesso próprio (`communicator`) que mostra só essa área, e o Acervo de falas — busca textual com destaque, filtros por tema/alcance/ano/fase/município e player que já abre no trecho, com transcrição clicável e download.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (jornalista/videomaker), no escritório ou em campo, produzindo card, áudio e vídeo com prazo curto; o Sollinha e o resto da campanha não são o trabalho dela.
- **Job principal:** achar a fala/trecho sobre um assunto, tema ou município e levar para a peça — assistindo no ponto exato e baixando o arquivo.
- **Fluxo desejado:** login → nav "Comunicação" → busca (ex.: "Farmácia Popular") → resultados com trecho destacado e chips de tema → abrir o detalhe → player já no timestamp do trecho → ler a transcrição clicável → baixar/abrir a fonte.
- **Anti-goals de produto:** editor de vídeo/corte no browser; segundo cadastro de pessoas; exposição pública do acervo; permissão por município (comunicação é global, não é carteira).

### Esboço de fluxo (B/C/D)

```text
[login] → nav Comunicação → busca/filtros → resultado com trecho destacado
→ detalhe: player no timestamp + transcrição clicável + baixar → [outcome: matéria-prima na mão]
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/acervo-videos-comunicacao-ui-draft.html` — cenas desktop (resultados e detalhe), mobile (~390px) e vazio.

## Objetivo e aceite

- Papel `communicator` ("Assessor de Comunicação"): vê e navega **só** a vertical (nav própria, sem as demais áreas da campanha); `coordinator`/`candidate` também veem; `advisor`/`leader` não têm acesso.
- `/campanha/comunicacao/acervo` com busca textual sobre os segmentos, destaque do termo e filtros: ano, tema, alcance, fase do discurso, município citado, duração.
- Keywords oficiais aparecem como chips e também são pesquisáveis (termo exato).
- Detalhe com player iniciando no trecho, transcrição clicável por segmento, sumário, contexto da sessão (fase, quem presidia) e ações: baixar (VOD) e abrir fonte.
- Estados críticos: vazio (sem resultado), carregando e sem permissão.
- Mobile utilizável (a assessoria trabalha em campo).
- **Guardrails:** vídeo servido do VOD da Câmara nesta fase (sem espelho); crédito à Câmara (CC BY 4.0); nenhum dashboard de vaidade.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície — resultados com trecho e contagem por faceta.
- **Decisões desbloqueadas:** a assessoria escolhe qual fala cortar para um tema e qual material cobre um município.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição: nada de % estadual absoluto nem KPI de vaidade.

## Dados da decisão (literais)

- **Papel:** `communicator` — rótulo "Assessor de Comunicação".
- **Rotas:** home da vertical `/campanha/comunicacao`; acervo `/campanha/comunicacao/acervo`; detalhe `/campanha/comunicacao/acervo/[id]`.
- **Filtros:** ano · tema · alcance · fase do discurso · município citado · duração.
- **Facetas (rótulos):** os 18 temas e os 3 alcances definidos no C153.
- **Comportamento do player:** abrir no início do segmento selecionado; transcrição clicável posiciona o vídeo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/comunicacao/…` (páginas + server actions), `src/components/campaign/comunicacao/`, `src/lib/campaignRoles.ts` (predicado do papel), `src/components/campaign/shell/nav.ts` (nav do communicator), `src/lib/campaignPageChrome.ts` (título/aba), `src/utilities/campaignPageActor.ts` (gate novo), módulo de access reexportado por `campaignAccess.ts`, e busca em endpoint `POST` no wrapper `campaignJsonMutationRoute`.
- **Precedente a olhar:** `src/components/campaign/supporter/` (lista + filtros), `home-search` (busca com `contains`), `src/app/(campaign)/campanha/(app)/assessores/` (página gated).
- **Risco de acoplamento:** não abrir as demais áreas para o `communicator` (ele não é staff); leader lockdown intocado; nada de permissão por município.

## Dependências

- **C153** (acervo no banco) — sem dados não há busca; o rascunho UI pode ser validado antes.

## Fora de escopo

- Clipes/editor e espelhamento em S3.
- Busca semântica/IA (item futuro próprio).
- Exposição pública e compartilhamento externo.
- Comissões/audiências (Plenário apenas).
- Notificações, favoritos e listas editoriais (avaliar depois de uso real).

## Rabbit holes de produto

- **"Cortar o trecho no browser."** Se alguém "só completar": editor de vídeo, fila de render, storage. **Corte neste item:** player + download; corte é ferramenta externa.
- **"Permissão por município para a comunicação."** Se alguém "só completar": a vertical inteira vira carteira. **Corte neste item:** acesso global à vertical.
- **"Baixar em lote / coleções."** Se alguém "só completar": gerenciador de projetos. **Corte neste item:** busca e download por trecho.

## Questões em aberto (produto)

- **Home do communicator?** **Opções:** A) a própria vertical `/campanha/comunicacao` (recomendado) | B) Início genérico da campanha. **Recomendação:** A — ele não pertence ao fluxo de municípios.
- **Buscar também nas keywords cruas?** **Opções:** A) sim, como termo exato (recomendado) | B) só no texto. **Recomendação:** A — captura termos que a taxonomia não tem (ex.: "Banco Master").
- **Transcrição exibida: oficial ou ASR?** **Opções:** A) oficial para leitura + ASR para posicionar (recomendado) | B) só ASR. **Recomendação:** A — taquigrafia é limpa para citar.

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/acervo-videos-comunicacao-ui-draft.html`
- `AGENTS-campaign.md` (auth e roles) · `src/lib/campaignRoles.ts` · `src/components/campaign/shell/nav.ts` · `docs/research/persona-emendas-coordenador-comunicacao.md`
- C153 (catálogo e facetas) · C155 (backfill/produção)
