# Orientação na shell + aba — sem títulos grandes de seção

Status: rascunho
Atualizado em: 2026-08-02
Issue: #250
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe no shell existente (`CampaignMobileTopBar` + header desktop) e limpeza dos headers de conteúdo
Appetite: ~1–1,5 dia eng; um outcome verificável (orientação fora do corpo da página)
Responsável: —

## Intenção

Espaço vertical no `/campanha` é caro: a equipe não rola por instinto. Quase toda rota de seção abre com um `h1` grande + subtítulo (± chip de escopo), empurrando filtros, mapa e listas para baixo. A orientação “onde estou” deve sair do corpo da página e ir para a chrome estável (header + aba do browser), em tamanho discreto.

Isto **substitui** a abordagem de **B118** (só ocultar título/subtítulo/chip nas listas no mobile; desktop mantinha o bloco). Aqui a remoção vale em todos os viewports; a âncora passa a ser shell + metadata.

## Persona e fluxo

- **Persona / contexto:** staff (coordenador / assessor / candidato) na mesa ou no celular, saltando entre listas e o quadro; quer o conteúdo útil na primeira dobra.
- **Job principal:** saber em que página está sem gastar a dobra de cima com título de seção.
- **Fluxo desejado:** abre a rota → vê título (e subtítulo, quando houver) só no header da app e na aba do browser → o corpo começa direto no trabalho (filtros, mapa, lista, formulário). Em detalhe de entidade, o nome do registro continua no corpo.
- **Anti-goals de produto:** redesign do shell; segundo brand hero; spreadsheet mode; mexer no chrome do wizard; títulos de auth/convite/offline.

### Esboço de fluxo (B)

```text
[nav / deep link]
  → aba: "Solla - Campanha - <Página>"
  → header mobile: L1 título · L2 subtítulo (quando houver)
     header desktop/tablet: uma linha "<título> <subtítulo>"
  → corpo: sem h1/subtítulo/chip de seção
  → [trabalha na lista / quadro / formulário]

exceção detalhe:
  → header = rótulo da seção (ex. Municípios)
  → corpo mantém h1 = nome da entidade
```

## Objetivo e aceite

- Em rotas de **seção** (listas, quadro, contatos da liderança, conceitos, perfil, giros, create/edit estáticos): o corpo **não** mostra título grande, subtítulo de página nem chip de escopo (“435 municípios”, escopo de apoiadores, “N demandas em aberto” como chip de universo).
- A orientação aparece no **header da app** (discreto) e na **aba** no formato `Solla - Campanha - <Página>`.
- **Mobile:** duas linhas — título da página / subtítulo da página (mesmo padrão visual de hoje “Jorge Solla” / “Campanha · Bahia”, com conteúdo da página).
- **Desktop e tablet:** uma linha `<título> <subtítulo>` (mais espaço horizontal).
- **Início (`/campanha`):** header **sem** título de página (nada no lugar do brand/título).
- **Quadro e contatos (liderança):** removem “Olá, {nome}” e o subtítulo de saudação; orientação via shell (“Quadro”, “Contatos”, …) + subtítulo de página quando fizer sentido.
- **Detalhe de entidade:** o `h1` com o **nome do registro** permanece; o header carrega o rótulo da **seção** (não duplica o nome como título de chrome de seção).
- **Create/edit:** títulos estáticos do tipo “Nova liderança” / “Editar …” e seus subtítulos saem do corpo e vão para o header (padrão mobile 2 linhas / desktop 1 linha).
- Auth, convite, offline e chrome do wizard ficam fora.
- Precedente B118 fica **superseded** por este outcome (não reintroduzir título grande só no desktop).

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** nenhuma decisão de alocação/voto — só orientação espacial da UI.
- **Forma:** *adiada ao plano de implementação*.

## Direção no codebase (hipótese)

- **Áreas prováveis:** layout `(app)` + `CampaignMobileTopBar` / header desktop em `src/components/campaign/shell/`; metadata em `src/app/(campaign)/layout.tsx` e rotas filhas; headers inline nas `page.tsx` de listas/quadro/create/edit; `CampaignDashboard`, `LeaderContactsPanel`; chips `CampaignScopeBadge` nas listas; possível precedente parcial `CampaignListPageHeader` (B118 — pode ou não estar no branch atual).
- **Precedente a olhar:** B118 (#205) — hide mobile-only; este item unifica remoção + shell + tab.
- **Risco de acoplamento:** não quebrar wizard (já usa o top bar); não tirar h1 de detalhe de entidade; leader lockdown nas rotas de contatos.

## Dependências

- Nenhuma dura. Soft: consciência de B118 (superseded).

## Fora de escopo

- Login / esqueci / redefinir / convite / offline.
- Passos e flow title do wizard (`/campanha/acoes/…`).
- Redesign visual do shell além de preencher o título discreto.
- Remover o `h1` de nome em páginas de **detalhe** de entidade.
- KPIs / métricas grandes que não são título de página.
- Mudança de IA / copy profunda dos subtítulos (mover o que já existe; não reescrever o glossário).

## Rabbit holes de produto

- **Tratar detalhe como seção.** Se alguém “só completar” e remover o nome do município/liderança do corpo: some a identidade do registro. **Corte:** detalhe mantém h1 da entidade; header = seção.
- **Início com brand de novo.** Preencher o header do Início “para não ficar vazio” traz de volta ruído. **Corte:** Início = nada no título do header.
- **Chip de escopo “útil”.** Reintroduzir “435 municípios” como badge no header recreia o mesmo custo. **Corte:** chips de universo saem; contagem de resultados da lista (footer) permanece.

## Questões em aberto (produto)

- **Subtítulo ausente?** Algumas rotas só têm título. **Opções:** A) só a linha do título (mobile sem L2; desktop só o título) · B) inventar subtítulo. **Recomendação:** A. _(assumido — validar só se doer na execução)_
- **Rótulo curto na aba vs header?** Ex. aba “Municípios” e header com o mesmo. **Opções:** A) mesmo label · B) aba mais curta. **Recomendação:** A — um vocabulário. _(assumido)_

## Referências

- GitHub Issue #250
- Exemplos citados no pedido: `/campanha/quadro`, `/campanha/municipios`
- Shell: `src/app/(campaign)/campanha/(app)/layout.tsx`, `CampaignMobileTopBar.tsx`
- Metadata root: `src/app/(campaign)/layout.tsx`
- B118 — Listas mobile — ocultar título, subtítulo e chip de escopo (#205)
- `AGENTS.md` — convenções de naming / pt-BR em copy
