# Rascunho UI/UX do gate (plan-issue)

Quando o item **muda UI** (classe Impeccable **B / C / D**, ou qualquer superfície que o usuário vê/toca), o gate **obrigatoriamente** apresenta um **rascunho visual** da intenção — não ASCII sozinho, não wireframe de implementação. O meio é **HTML + Tailwind**, commitado no repo Teqo junto do plano.

## Para que serve — e para que NÃO serve

Serve para **colaborar visualmente com o humano** e fechar **layout, espaçamentos e tamanhos**: hierarquia, zonas, CTAs, densidade, medidas reais. É a linguagem do gate para "é isso que o usuário vê/toca".

**NÃO é** implementação da feature, **NÃO é** protótipo funcional, **NÃO é** entrega de app, **NÃO é** decisão de engenharia. Quem executa (`work-issue` / `agent-work-issue`) constrói a partir do plano; o rascunho é descartável como fonte e imutável como registro.

## O que o rascunho DEVE ter (fidelidade mínima)

1. **Layout real** das superfícies tocadas: zonas (lista, detalhe, formulário, mapa, empty, erro), hierarquia de atenção, CTA primário vs secundário.
2. **Espaçamentos e tamanhos reais** — a mesma escala do app (Tailwind v4: `p-4`, `gap-3`, `h-11`, `text-sm`, `rounded-lg`). **É disso que o gate discorda ou aprova.**
3. **Breakpoints reais**: cena mobile (~390px) e cena desktop (~1280px) quando o fluxo tocar os dois. Um rascunho mobile sem viewport mobile não valida nada.
4. **Estados críticos** se mudarem o aceite (vazio, loading, sem permissão, fail-closed) — como **cenas estáticas separadas**, nunca como interação.
5. **Texto real pt-BR**; valores obviamente genéricos ("Nome da liderança", "12 municípios"); barras cinza para conteúdo desconhecido.

## O teto (proibido — é rascunho, não implementação)

1. **Zero funcionalidade.** Nenhum JS de comportamento: sem `onClick`, sem state, sem tabs/drawer/accordion de verdade, sem condicionais. Cada estado = uma cena estática. O único JS do arquivo é o build browser do Tailwind.
2. **Zero código de app.** Não importar de `src/`, não escrever o componente final, não nomear componentes/arquivos obrigatórios. O rascunho é **descartável**: o executor constrói do plano, não copia o rascunho.
3. **Zero brand/polish.** Sem gradientes, emojis, box-shadow, animações, microinteractions, logo/imagens reais, paleta do produto. Cinza neutro (zinc/neutral) + **um único acento** para o CTA primário. Fonte do sistema.
4. **Zero mock de dados.** Sem KPIs realistas, nomes reais, números de votos — placeholders óbvios ou barras cinza.
5. **Zero decisão de engenharia.** Sem schema, migration, nomes de arquivos obrigatórios, assinaturas — o rascunho mostra superfície, não solução.

## Como fazer (artefato no repo)

1. **Escreva** `docs/plans/<slug>-ui-draft.html` — um arquivo por item, autossuficiente:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <title>UI draft — <título do item></title>
  </head>
  <body class="bg-zinc-950 text-zinc-100 antialiased">
    <main class="mx-auto max-w-5xl p-8">
      <p class="text-sm text-zinc-400">Persona/job em uma linha + cenas abaixo</p>
      <section class="mt-6">… desktop …</section>
      <section class="mt-6 w-[390px]">… mobile …</section>
      <section class="mt-6">… vazio …</section>
    </main>
  </body>
</html>
```

   - Tailwind **v4** (`@tailwindcss/browser@4`) — mesma major do app (4.1.x). Requer rede apenas na hora de renderizar no browser.
   - O arquivo **é commitado** com o plano: o rascunho aprovado vira registro permanente do aceite visual.

## Relação com o plano em `docs/plans/`

- Campo **Rascunho UI:** no cabeçalho: `docs/plans/<slug>-ui-draft.html` (ou `N/A — sem UI`).
- Link do `.html` no corpo do plano (secção "Rascunho UI (gate)").
- Esboço ASCII no markdown vira **opcional** (backup textual).
- **É commitado com o plano**: o HTML aprovado é o registro do aceite visual e viaja com a Issue.

## Gate

Antes de `pnpm agent:register`, mostre o overview do lote **e** o link do `.html` fonte — o humano abre no browser para validar. Itere: **editar HTML** até confirmação explícita. Só então registre a Issue.
