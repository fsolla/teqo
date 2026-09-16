# Design hi-fi do gate (plan-issue)

Quando o item **muda UI** (classe Impeccable **B / C / D**, ou qualquer superfície que o usuário vê/toca), o gate **obrigatoriamente** apresenta o **design hi-fi** da intenção — não ASCII sozinho, não wireframe de implementação. O meio é **HTML + Tailwind** com **tokens reais, brand e shadcn**, commitado no repo Teqo junto do plano. O artefato é a **fonte de verdade do port**: quem implementa (`work-issue` / `agent-work-issue`) porta **classe-a-classe** para React/Next.

## Para que serve — e para que NÃO serve

Serve para **aprovar o design final antes de qualquer código** e, depois, **portar e criticar com paridade**: layout, espaçamentos, tamanhos, hierarquia, estados, tokens, copy. É a linguagem do gate para "é isso que o usuário vê/toca".

**NÃO é** implementação da feature, **NÃO é** protótipo funcional, **NÃO é** entrega de app, **NÃO é** decisão de engenharia. Não há lógica de negócio, dados reais, chamadas de rede ou persistência.

- **Imutável como registro:** o design aprovado viaja com a Issue e fica no repo; planos antigos (`docs/plans/**`) não se migram.
- **Mutável durante o work-issue:** o `designer` pode estender/ajustar o artefato na execução; **mudança material volta ao humano no PR** — nunca em silêncio.

## Quem produz e quem critica

Mesma doutrina para os dois papéis (fonte única — os prompts dos agentes apontam para cá, não copiam as regras):

- **Criar:** o agente `designer` (`.opencode/agent/designer.md`) produz ou estende o hi-fi a partir do plano de intenção aprovado — tokens/brand reais, copy pt-BR real, cenas 390/1280, estados críticos. O artefato nasce **antes** da implementação e é o alvo do gate.
- **Criticar:** o `designer` relê a **implementação renderizada** (screenshots do app) contra o artefato aprovado e devolve **lista numerada de ajustes concretos** — hierarquia (o CTA primário domina?), contraste, tipografia, espaçamento, mobile, acessibilidade. **A referência é o alvo — nunca a critique.**
- **Visão nativa (fail-closed):** leia screenshots, prints e referências **direto com a tool Read**; nunca peça ao humano para descrever o que você pode ver. Se a leitura da imagem falhar (modelo da sessão sem visão), **pare** e peça a troca de modelo via `/models` antes de julgar a tela; **nunca descreva o que não viu**.
- **Tier degradado:** o `designer-degraded` cria/estende/critica, mas **marca todo output `DEGRADED`** e **nunca certifica** — exige sign-off humano explícito. `DEGRADED` não é design aprovado.
- **Escrita só no artefato (file tools + bash):** os dois agentes têm `permission` fail-closed — `edit`/`write`/`patch` negados fora de `docs/plans/<slug>-ui-design*` e o **bash** nega os vetores de escrita enumerados (redirecionamento, `sed -i`, `tee`, shells/interpretadores) fora do artefato; o resto do shell fica em `ask`. Não tente contornar por shell (o guard cobre os vetores enumerados, não é sandbox de SO) — leia/inspecione à vontade (`cat`, `sed -n`, `git diff`) e grave o artefato pelas file tools.

## O que o design DEVE ter (fidelidade mínima)

1. **Layout real** das superfícies tocadas: zonas (lista, detalhe, formulário, mapa, empty, erro), hierarquia de atenção, CTA primário vs secundário.
2. **Espaçamentos e tamanhos reais** — a mesma escala do app (Tailwind v4: `p-4`, `gap-3`, `h-11`, `text-sm`, `rounded-lg`). **É disso que o gate discorda ou aprova.**
3. **Breakpoints reais**: cena mobile (~390px) e cena desktop (~1280px) quando o fluxo tocar os dois. Um design mobile sem viewport mobile não valida nada.
4. **Estados críticos** se mudarem o aceite (vazio, loading, sem permissão, fail-closed) — como cenas, nunca escondidos atrás de clique não descoberto. Podem ser **cenas estáticas** e/ou **interação mínima** (abaixo); o gate não pode depender de clicar para ver o essencial.
5. **Texto real pt-BR**; valores obviamente genéricos ("Nome da liderança", "12 municípios"); barras cinza para conteúdo desconhecido. **Claims/números só os aprovados no plano** — nunca invente o que não pode ser verificado.

## O teto (é design de gate, não implementação)

1. **JS mínimo, só de apresentação.** Permitido: abrir/fechar modal, trocar de tab, dropdown/accordion, toggle, hover/scroll reveal — coisas que existem para **mostrar** o design. **Proibido:** lógica de negócio, fetch/rede, persistência, validação, cálculo de produto, roteamento, qualquer coisa que decida o comportamento do produto. Sem build e sem imports além do Tailwind CDN; JS inline e autocontido no próprio `.html`.
2. **Zero código de app.** Não importar de `src/`, não escrever o componente final, não nomear componentes/arquivos obrigatórios. O design é **portado**, não copiado como entrega.
3. **Zero decisão de engenharia.** Sem schema, migration, nomes de arquivos obrigatórios, assinaturas — o design mostra superfície e tokens, não solução.
4. **Zero dado real de terceiro.** Sem KPIs realistas, nomes reais, números de votos — placeholders óbvios ou barras cinza.
5. **Um CTA primário.** Nunca dois CTAs de peso igual acima da dobra.
6. **LGPD/TSE.** Consentimento explícito e link de privacidade visíveis onde houver captação; nada de promessa irrealista; identificação da campanha onde couber.
7. **`NEEDS ASSET`.** Marque claramente o que precisa de ativo real (foto, selo, depoimento, cobertura de imprensa). Nunca invente nem use banco de imagens genérico como se fosse real.

## Tokens, brand e shadcn (elevados)

- **Tokens reais são esperados.** Use as cores, raios, sombras e a tipografia da superfície-alvo; se `data-theme='campaign'` for o alvo, os tokens da campanha valem no artefato (definidos inline via CSS variables/classes, na mesma escala do app).
- **Brand é permitida e esperada** — gradiente, sombra, motion de apresentação, logo quando aprovado. O teto protege contra virar implementação, não contra ter acabamento.
- **shadcn/lucide primeiro.** Componentes e ícones seguem o vocabulário do app (button, card, dialog, tabs, badge); custom só quando não houver equivalente.
- **Skeleton completo** abaixo é ponto de partida — o artefato real traz o conteúdo do item.

```html
<!doctype html>
<html lang="pt-BR" data-theme="campaign">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <title>Design — <título do item></title>
  </head>
  <body class="bg-background text-foreground antialiased">
    <main class="mx-auto max-w-5xl p-8">
      <p class="text-sm text-muted-foreground">Persona/job em uma linha + cenas abaixo</p>
      <section class="mt-6">… desktop (1280) …</section>
      <section class="mt-6 w-[390px]">… mobile …</section>
      <section class="mt-6">… vazio …</section>
    </main>
    <script>
      // JS mínimo de apresentação (ex.: abrir/fechar modal, alternar tabs).
    </script>
  </body>
</html>
```

## SVG (assets próprios)

1. **lucide/shadcn primeiro** — se existe equivalente, use o ícone da biblioteca.
2. **Custom só quando não houver equivalente**: grid 24px, `currentColor`, stroke no padrão lucide.
3. **Salve em `docs/plans/<slug>-ui-design-assets/*.svg`** e referencie por caminho relativo — o artefato continua autossuficiente com a pasta ao lado.

## Ladder de modelo (quota/indisponibilidade não pula design)

`openai/gpt-5.6-sol` → `openai/gpt-6-astra` → `opencode-go/deepseek-v4.1-flash` (`DEGRADED`) → `deepseek/deepseek-flash` (`DEGRADED`, inline)

- **Tier 1** (`openai/gpt-5.6-sol`): pin do `designer`. **Tier 2** (`openai/gpt-6-astra`): mesmo agente, troca via `/models` (ou `--model` no headless) quando a crítica for contestada/pixel-critical.
- **Tier 3** (`opencode-go/deepseek-v4.1-flash`, agente `designer-degraded`) e **tier 4** (`deepseek/deepseek-flash`, feito inline pelo orquestrador): sempre `DEGRADED`, nunca certificam, exigem sign-off humano.
- **Queda explícita e auditável:** quota/indisponível/visão falhou ⇒ desce o tier e **registra no PR** (`Design tier: …`) — nunca pula design em silêncio. Se todos os tiers falharem, o design **bloqueia**: o humano decide, não se "segue sem".

## Como fazer (artefato no repo)

1. **Escreva** `docs/plans/<slug>-ui-design.html` — um arquivo por item, autossuficiente (Tailwind **v4** browser CDN; rede só na hora de renderizar no browser).
2. **Assets** em `docs/plans/<slug>-ui-design-assets/*.svg` quando ícones/ilustrações próprios forem necessários.
3. **Commitado com o plano**: o design aprovado é o registro do aceite visual (ver "Imutável como registro" no topo).

## Relação com o plano em `docs/plans/`

- Campo do cabeçalho do plano aponta o caminho do artefato (`Design UI:`) — ou `N/A — sem UI`.
- Link do `.html` no corpo do plano.
- Esboço ASCII no markdown vira **opcional** (backup textual).

## Gate

Antes de `pnpm agent:register`, mostre o overview do lote **e** o link do `.html` — o humano abre no browser para validar. Itere: **editar HTML** (e pedir crítica ao `designer`) até confirmação explícita. Só então registre a Issue. Se o tier for degradado, o sign-off humano é obrigatório e o rótulo `DEGRADED` fica visível.
