# Detalhe de entidade — título no header (sem hero espaçoso)

Status: rascunho
Atualizado em: 2026-08-02
Issue: #315
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe no shell de `/campanha` + páginas de detalhe existentes
Appetite: ~0,5–1 dia eng; um outcome verificável em todos os detalhes de entidade
Responsável: —

## Intenção

Nas páginas de detalhe de `/campanha` o corpo ainda abre com um bloco grande de título (nome, chips de tipo, “Voltar para…”, linha de assessoria). Isso gasta viewport e repete o que a orientação da shell já deveria carregar. Queremos compactar: a identidade do registro sobe para o header da app; o conteúdo começa direto nas abas/seções úteis.

Isto **revisa** a regra de detalhe do B123 (#250): lá o header ficou com o nome da **seção** e o `h1` da entidade no corpo. Aqui o header passa a carregar a **identidade do registro** no detalhe.

## Persona e fluxo

- **Persona / contexto:** staff (coordenador, candidato, assessor) abrindo dossiês no celular ou no desktop, muitas vezes em sequência.
- **Job principal:** saber *onde está* (qual registro) sem rolar um hero; ir direto ao trabalho (abas, ficha, ações).
- **Fluxo desejado:** abre o detalhe → header mostra título + subtítulo do registro → corpo começa nas abas/seções/chips operacionais → volta à lista pela sidebar ou pelo histórico do browser (sem “Voltar para…” no corpo).
- **Anti-goals de produto:** não redesenhar listas, wizards ou a sidebar; não inventar um segundo lugar para “Assessoria” só porque saiu do hero; não trocar copy de seções da lista.

### Esboço de fluxo (B)

```text
[lista / busca / link]
  → abre detalhe
  → lê identidade no header (título + subtítulo)
  → trabalha nas abas/seções (sem hero)
  → sai pela sidebar ou browser back
```

## Objetivo e aceite

- Em todo detalhe de entidade listado abaixo, o header da shell mostra a identidade do registro (não só o nome da seção).
- O bloco espaçoso de título no corpo some: `h1` da entidade, links “Voltar para…”, e o que for só eco do header (chip de tipo quando o subtítulo o substitui; linha Assessoria / última atualização no município).
- Chips e meta **operacionais** permanecem no corpo (status, acesso ao app, celular/e-mail, “Deputado presente”, kind+data de atividade, etc.).
- Abas e seções de conteúdo ficam; edit routes (`…/editar`) inalteradas (já usam `Editar {nome}`).
- Aba do browser alinha com a identidade do registro no detalhe (não só o nome da seção).
- Listas e rotas sem entidade (perfil, giros, wizard `/acoes`) fora deste item.

## Dados (intenção)

- **Vou apresentar dados?** Não — só reorganização de chrome/orientação.
- **Decisões desbloqueadas:** staff reconhece o registro aberto sem gastar a primeira dobra com título duplicado.
- **Forma:** *adiada ao plano de implementação* — restrição de produto: header com título + subtítulo opcional; corpo sem hero de identidade.

## Mapeamento por página (aceite)

Dois padrões:

| Padrão | Header título | Header subtítulo |
| ------ | ------------- | ---------------- |
| Lugar / registro nomeado | nome do registro | contexto (território, tipo, meta) |
| Pessoa | tipo singular | nome da pessoa |

| Rota | Header título | Header subtítulo | Sai do corpo |
| ---- | ------------- | ---------------- | ------------ |
| `/campanha/municipios/[slug]` | nome do município | território / geografia | `h1`, chip Município/Zona, linha Assessoria (+ última atualização do mesmo bloco) |
| `/campanha/liderancas/[id]` | `Liderança` | nome | “Voltar para lideranças”, `h1` |
| `/campanha/atividades/[slug]` | título da atividade | município (+ localidade se houver) | `h1` |
| `/campanha/demandas/[slug]` | título da demanda | `tipo · município` | “Voltar…”, `h1` |
| `/campanha/dobradinhas/[slug]` | nome do deputado | partido (se houver) | “Voltar…”, `h1`, chip de partido se virou subtítulo |
| `/campanha/organizacoes/[slug]` | nome | tipo (Sindicato, …) | “Voltar…”, `h1`, chip de tipo |
| `/campanha/apoiadores/[id]` | `Apoiador` | nome | “Voltar…”, `h1` |
| `/campanha/assessores/[id]` | `Assessor` | nome | “Voltar…”, `h1` |

## Direção no codebase (hipótese)

- **Áreas prováveis:** catálogo/resolução de chrome (`campaignPageChrome` + overrides por rota de detalhe); shell `CampaignPageChrome*`; páginas sob `src/app/(campaign)/campanha/(app)/*/\[…\]`; componentes de detalhe em `src/components/campaign/<domínio>/`.
- **Precedente a olhar:** B123 (#250) orientação na shell; B133 (#283) subtítulos curtos / override de lista de Municípios; edit routes que já empurram título dinâmico no header.
- **Risco de acoplamento:** não quebrar orientação das **listas** (header = seção); leader lockdown e superfícies sem detalhe de entidade ficam de fora; revisa só a regra de **detalhe** do B123.

## Dependências

- Nenhuma dura. Soft: convive com B123/B133 já em prod (este item atualiza a política de detalhe).

## Fora de escopo

- Listas e filtros salvos (subtítulo de filtro em Municípios permanece como está).
- `/campanha/municipios/[slug]/editar`, `/campanha/atividades/[slug]/editar`.
- Wizard `/campanha/acoes/[slug]`, giros, perfil, contatos (liderança).
- Relocar Assessoria para um bloco novo se já existir em aba/lista — só remover do hero.

## Rabbit holes de produto

- **Tratar lista como detalhe.** Se alguém “só completar” e colocar nome de linha no header da lista: quebra B123/B133. **Corte:** só rotas de detalhe de entidade.
- **Esconder chips operacionais.** Se alguém remover status/acesso/celular junto com o hero: perde sinal útil. **Corte:** só identidade duplicada e “Voltar…”.
- **Segundo lugar para Assessoria.** **Corte:** sumir do hero; não inventar UI nova neste item.

## Questões em aberto (produto)

- Resolvidas no gate 2026-08-02: (1) Assessoria some só do hero; (2) demanda = `tipo · município`; (3) aba do browser alinha com entidade; (4) “Voltar para…” some em todos os detalhes; (5) uma Issue única.

## Referências

- Gate confirmado na conversa de plan-issue (2026-08-02)
- B123 #250 — `docs/plans/orientacao-shell-sem-titulos-secao.md` (política anterior de detalhe)
- B133 #283 — `docs/plans/listas-sem-subtitulo-prosa.md`
- Rotas: `municipios/[slug]`, `liderancas/[id]`, `atividades/[slug]`, `demandas/[slug]`, `dobradinhas/[slug]`, `organizacoes/[slug]`, `apoiadores/[id]`, `assessores/[id]`
