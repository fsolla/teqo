# Impl: Sollinha: ações rápidas de abertura no chat (chips de pergunta)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #532
Intenção: docs/plans/sollinha-acoes-rapidas-chat.md
Appetite restante: herdado (~0,5–1 dia eng) — cabe folgado

## Leitura da intenção

- **Outcome:** com a conversa vazia, o chat mostra chips de pergunta acima do input; tocar num chip envia aquela pergunta como mensagem do usuário e remove os chips de abertura; chips curados ao que o Sollinha responde bem hoje; leader não vê chip que aciona ferramenta eleitoral travada (fail-closed, B180); funciona no painel desktop e no drawer mobile, tema claro e escuro.
- **O que NÃO negociar:** chips não navegam (só enviam); aparecem só com conversa vazia (`messages.length === 0`); somem no primeiro envio; curadoria por capacidade real das ferramentas; respeito ao lockdown de leader (nada de tool eleitoral / staff).
- **O que reavaliar:** a hipótese "lista como dado de configuração em `src/lib/`" (mantém, com molde `sollinhaChatPanelWidth.ts`); o canvas mostrou um chip de leader "Quais apoiadores eu cadastrei?" — **não há tool de supporter no chat** (o toolset é `buildCampaignLinks`, `calculate`, `getDobradinhas`, `getLeaderships`, `getLeadingMunicipalities`, `getMunicipalityOverview`, `getMunicipalityVotes`, `getOrganizations`, `getTopDeputies`, `searchEntities`) — esse chip violaria a própria regra de curadoria da intenção (nada de sugerir o que não se responde bem). O conjunto de leader é re-curado pelo que as tools de leader **de fato** respondem.

## Abordagem recomendada

```mermaid
flowchart LR
  L[layout (app) — user.role] -->|prop serializable| S[CampaignAISidebarShell]
  S --> P[CampaignAISidebarProvider + role no context]
  P --> C[CampaignAIChat]
  CAT[src/lib/sollinhaOpeningQuestions.ts — catálogo puro] --> C
  C -->|messages 0 + status ready| SLOT[Slot de chips acima do input]
  SLOT --> CHIP[ChatChipGroup — botões pill]
  CHIP -->|sendMessage text| CHAT[useChat]
  CHAT -->|messages cresce| SLOT["chips somem (estado não vazio)"]
```

**Opções consideradas:**

- A — Catálogo curado por papel (`staff` vs `leader`) × viewport em `src/lib/sollinhaOpeningQuestions.ts`, função pura `getOpeningQuestions(role, isMobile)`, chips renderizados no `CampaignAIChat` via um `ChatChipGroup` presentacional.
- B — Catálogo hardcoded dentro do `CampaignAIChat.tsx`.
- C — Chips iguais para todos os papéis (uma lista única).

**Recomendação: A** — o catálogo é dado de configuração (regra da intenção), a função pura é unit-testável e o `ChatChipGroup` é o primitivo que o B192 reusa no mesmo slot. O `role` chega por prop do server layout → shell → context (o `CampaignAISidebarShell` já é cliente e o `CampaignPageChromeProvider` fica **fora** do alcance do chat — ele envolve só o conteúdo principal, não o painel/drawer do Sollinha; o chat não pode ler `useCampaignPageChromeRole()`).
**Rejeitadas:** B porque a curadoria vazaria para dentro de um componente de render (regra da intenção: "a lista vive como dado de configuração, não em código espalhado") e dificulta o teste; C porque viola o fail-closed de leader (B180) que a intenção explicitamente herda.

### Componentes / mudanças

- **`src/lib/sollinhaOpeningQuestions.ts`** (novo): catálogo puro e imutável + `getOpeningQuestions(role, isMobile): string[]`:
  - `staff` (coordinator/advisor/candidate) — 4 chips (3 no mobile): perguntas com resposta garantida pelo toolset atual:
    1. "Quem foi o deputado mais votado em Feira de Santana?" → `getTopDeputies`
    2. "Quantos votos tivemos em Ilhéus em 2022?" → `getMunicipalityVotes`
    3. "Quais dobradinhas temos em Salvador?" → `getDobradinhas`
    4. "Como está o município de Vitória da Conquista?" → `getMunicipalityOverview`
  - `leader` — 3 chips (todos seguros e respondíveis hoje):
    1. "O que você sabe fazer?" → o modelo responde do próprio prompt (meta, sem tool)
    2. "Me manda o link dos meus contatos" → `buildCampaignLinks` (`leaderContacts` — allowlist de leader)
    3. "Me manda o link do meu perfil" → `buildCampaignLinks` (`perfil` — allowlist de leader)
  - Fonte única da divisão de papéis: `isStaffCampaignRole` de `src/lib/campaignRoles.ts` (client-safe, já usado pelo shell).
  - Nada de chips que dependam de tool eleitoral para leader (`getMunicipalityVotes`/`getTopDeputies`/`getLeadingMunicipalities` têm `electionDataGate` → negam).
- **`src/components/campaign/shell/ai/ChatChipGroup.tsx`** (novo, client): primitivo presentacional `{ questions, onPick, className? }` — botões pill (border, rounded-full, tokens do tema, `text-sm`, hover/focus visível), `aria-label` = próprio texto; sem estado próprio. O B192 alimenta o mesmo componente com os follow-ups extraídos da resposta.
- **`CampaignAISidebarContext.tsx`**: context ganha `role: CampaignUser['role']`; o provider recebe `role` como prop e repassa no `value`.
- **`CampaignAISidebarShell.tsx`**: aceita `role: CampaignUser['role']` (client — prop serializável) e repassa ao provider.
- **`src/app/(campaign)/campanha/(app)/layout.tsx`**: `<CampaignAISidebarShell role={user.role}>`.
- **`CampaignAIChat.tsx`**: no bloco da área do input, **acima do `<form>`**, renderiza o slot: quando `messages.length === 0 && status === 'ready'` → `ChatChipGroup` com `getOpeningQuestions(role, isMobile)` e `onPick={(q) => { sendMessage({ text: q }); }}`. Chips somem naturalmente quando `sendMessage` adiciona a mensagem do usuário (`messages.length > 0`) e durante `busy`/recording (estado não-ready não renderiza o slot).
- **Migration:** sem migration (nenhuma mudança de schema/collection).
- **Access / Consent:** nenhum — o catálogo respeita o lockdown pelo **lado da sugestão** (B180 continua sendo o enforcement no `execute` das tools; o chip é só curadoria de sugestão, fail-closed por não existir).
- **UI:** Impeccable B — shape → craft → critique → polish. Shape vem do canvas (`plan-b191-ui-draft.canvas.tsx`): pills acima do input, 4 no desktop / 3 no drawer. Craft: tokens `campaign` (border, background secundária, hover, `focus-visible`), sem sombra/animação nova, acessível (botões reais, contraste claro/escuro). Critique/polish só no que o gate de B apontar — nada de motion novo.

### Dados → forma

- Sem dados novos: chips são textos estáticos. A "forma" é o catálogo `string[]` + o comportamento de envio — nenhuma métrica, KPI ou série nova (pergunta 3 de data-presentation: N/A).

## Fases verificáveis

1. **Catálogo + testes unit (quota ~30%)** — `sollinhaOpeningQuestions.ts` + `tests/unit/campaignSollinhaOpeningQuestions.unit.spec.ts` (staff 4/3; leader nunca contém chip eleitoral; determinismo; papel desconhecido → fallback seguro).
2. **Plumbing de role** — context + shell + layout (passo pequeno, sem teste próprio; coberto por tsc/gates).
3. **UI** — `ChatChipGroup` + slot no `CampaignAIChat` (tema claro/escuro nativo, sem `dark:` manual — tokens do tema).
4. **E2E** — `tests/e2e/campaignAiChatOpeningChips.e2e.spec.ts` (mock do `/campanha/api/ai-chat` como no `campaignAiChatResize.e2e.spec.ts`): chat vazio mostra chips (coordinator: 4; mobile: 3); tocar num chip envia a mensagem e os chips somem; leader não vê chip eleitoral e vê o conjunto seguro.
5. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Não criar componente "chip" genérico além do `ChatChipGroup` presentacional (não é design system novo).
- Não personalizar por histórico/uso (fora de escopo da intenção).
- Não adicionar chips de "prioridades do momento"/"demandas em aberto" (tools inexistentes — fora de escopo explícito).
- Não tocar `systemPrompt.ts`, `route.ts`, tools ou `electionDataGate` (B180 já entregue; nada a mudar).
- Não mexer no B192 (follow-ups) — apenas deixar o `ChatChipGroup` reusável.
- Nenhuma coluna/coleção nova; nenhum endpoint novo.

## Riscos e mitigação

- **Conflito de merge com B187/B188** (mesmo `CampaignAIChat.tsx`): B187 (links) e B188 (sessão) estão `in-progress` em outras branches; este item muda o bloco do input (adição de slot acima do form) — conflito mecânico, resolvível no rebase; não mudamos render de mensagens nem persistência.
- **Advisor com escopo restrito vê chip de município fora do seu escopo** (ex.: "Como está o município de Vitória da Conquista?" para um assessor de outra região): a tool retorna "Município não encontrado"/vazio com resposta honesta (não quebra, não inventa) — aceito no v1 (mesma tolerância da curadoria por capacidade; a intenção não pede escopo no catálogo v1). Gatilho de revisitação: se virar atrito recorrente, o B192 pode instruir o modelo a sugerir só o escopo do usuário.
- **Leader pergunta algo fora do conjunto** (digitação livre): comportamento atual inalterado — tools negam com fail-closed; chips só curam a sugestão.
- **`status` não-`ready` com `messages.length === 0`**: slot não renderiza (busy/erro), sem estado morto visível.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (chips vazios, envio via sendMessage, some no primeiro envio, papel respeitado, desktop+mobile, claro/escuro)
- [x] Invariantes AGENTS/engineering-standards (identificadores em inglês, copy pt-BR, sem schema, sem Consent novo, client boundary respeitado — catálogo puro sem imports server)
- [x] Testes de domínio previstos: unit do catálogo + e2e do fluxo (role leader e staff, viewport)
- [x] B192 (follow-ups) pode reusar `ChatChipGroup` no mesmo slot sem mudança no primitivo
