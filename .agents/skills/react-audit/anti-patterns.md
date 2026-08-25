# Catálogo fixo de anti-patterns React/Next.js (react-audit)

Enumeração FECHADA de famílias — expandir é PR próprio e deliberado da skill, nunca edição in-run.
Versões de referência (`package.json`): `next` 15.4.11 · `react`/`react-dom` ^19.2.4 · `eslint-config-next` 15.4.11.
Fontes oficiais conferidas vivas em 2026-08-25; re-verifique a URL antes de citá-la num relatório (Context7 ou fetch).

Cada achado só vira fix com os TRÊS selos: `file:line` real + família desta lista + fonte oficial abaixo.
Normas canônicas moram nos `.mdc` — este catálogo NÃO as duplica: adiciona heurística de busca, fonte oficial e receita.

---

## 1. Client boundary violada / server-first esquecido

- **Sintoma/heurística:** `'use client'` em arquivo que não usa hooks/eventos (só renderiza props); import por VALOR de módulo server-only (`utilities/*Data.ts`, loaders) dentro de client component; estado elevado além dos consumidores; view model inteiro passado onde uma seleção basta. Buscar: `grep -rn "'use client'" src | <arquivos sem hooks/event handlers>`, imports de `@/utilities` em arquivos client.
- **Norma no repo:** `.agents/rules/engineering-standards.mdc:22-28` (server-first, contrato client-safe vs `server-only`, state no leaf); `.agents/rules/codebase-map.mdc:12` (client importa server só `import type`; valores compartilhados em módulos de contrato).
- **Fonte oficial:** https://react.dev/reference/rsc/use-client · https://nextjs.org/docs/app/api-reference/directives/use-client · https://react.dev/reference/rsc/server-components
- **Receita:** remover `'use client'` se nenhum hook/handler existir; trocar import de valor por `import type` ou extrair o valor para contrato client-safe (`lib/`); descer o state ao menor consumidor.
- **Precedente:** lição B14 (~21 kB de serializador de URL na sidebar); contratos `municipalityMapContract`, `votePledgeViews`, `lib/campaignRoles`.

## 2. RSC payload bloat

- **Sintoma/heurística:** loader passando doc Payload inteiro (ou array deles) para componente client como prop; campos richText/relacionamentos atravessando o fio sem seleção. Buscar: props tipadas como `Post`/`Municipality`/doc completo em componentes `'use client'`.
- **Norma no repo:** `.agents/rules/codebase-map.mdc` ("view models são por papel"); engineering-audit smell "RSC payload bloat".
- **Fonte oficial:** https://react.dev/reference/rsc/server-components
- **Receita:** selecionar view model mínimo no server (função `*Views` do domínio) e passar só o necessário; strings/formatos pré-computados no server.
- **Precedente:** padrão `*ViewModels`/`*Views` dos loaders `utilities/*Data.ts`.

## 3. Effects fazendo derived-state / stale closures

- **Sintoma/heurística:** `useEffect` escrevendo state derivável de props/state no render; closure sobre state do render que agendou o trabalho (autosave/optimistic); functional updater cujo FALLBACK lê state velho. Buscar: `useEffect(` seguido de `set<A-Z>` na mesma linha; updaters `(current) => current ?? outroState`.
- **Norma no repo:** engineering-audit smell list (:103-105).
- **Fonte oficial:** https://react.dev/learn/you-might-not-need-an-effect · https://react.dev/learn/synchronizing-with-effects
- **Receita:** derivar no render (const local ou `useMemo` se caro); updater funcional SEM fallback externo ou ref espelhando o valor vivo; evento no lugar de effect quando é resposta a ação.
- **Precedente:** classe B34 (closures/fallbacks obsoletos em autosave/optimistic).

## 4. Forms & server actions (reset/transição/optimistic errados)

- **Sintoma/heurística:** `<form action={submitAction}>` onde o form não reseta após submit mas o código assumia reset (ou o contrário); botão sem pending (`useFormStatus`) duplicando submits; optimistic update sem invalidação (`revalidatePath`/`revalidateTag`); feedback de erro fora de `useActionState`. Buscar: `action={`, `useActionState`, `useOptimistic` sem `revalidate` no fluxo.
- **Norma no repo:** `.agents/rules/campanha-action-feedback.mdc` (feedback de action); shells de formAction existentes.
- **Fonte oficial:** https://react.dev/reference/react/useActionState · https://react.dev/reference/react-dom/hooks/useFormStatus · https://react.dev/reference/react/useOptimistic · https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- **Receita:** escolher DELIBERADAMENTE reset vs preservação (React 19 reseta uncontrolled forms com `action=`); pending no botão via `useFormStatus` dentro do form; optimistic sempre parado com revalidação explícita.
- **Precedente:** C139/C140 — ~21 forms da campanha com reset indesejado (`docs/plans/react-19-form-reset-campanha.md`).

## 5. Caching ladder violada

- **Sintoma/heurística:** dado vivo 2026 sob `unstable_cache`/`cache()` sem invalidação no write-path; auth/sessão dentro do core cacheado; fetch sem tag onde o write-path deveria revalidar. Buscar: `unstable_cache(`, `revalidateTag` ausente no domínio que escreve o dado cacheado.
- **Norma no repo:** `.agents/rules/engineering-standards.mdc:34-43` (ladder: `cache()` → `unstable_cache`+tag → artifact script → nunca live data sem invalidação).
- **Fonte oficial:** https://nextjs.org/docs/app/guides/caching · https://nextjs.org/docs/app/api-reference/functions/unstable_cache · https://react.dev/reference/react/cache · https://nextjs.org/docs/app/api-reference/functions/revalidatePath
- **Receita:** subir/descer na ladder conforme volatilidade; tag por domínio + `revalidateTag` no write-path; auth fora do core cacheado.
- **Precedente:** tags `posts`, `election-tse` com bust via `/api/revalidate`.

## 6. URL serializer chegando ao browser

- **Sintoma/heurística:** client component importando módulo de parse/canonicalização de URL de lista (`utilities/*ListUrl.ts`, parsers de `*Data.ts`) por valor; bundle cresce em rota que só renderiza link. Buscar: `import .*ListUrl` em `'use client'`.
- **Norma no repo:** `.agents/rules/codebase-map.mdc:33` (lição B14: casamento URL↔salvo tem de continuar puro e leve — sidebar custava ~21 kB).
- **Fonte oficial:** https://react.dev/reference/rsc/use-client
- **Receita:** mover regra pura para `lib/` (client-safe) e deixar serializador pesado server-only; `import type` quando só tipagem.
- **Precedente:** B14/P4-F (`docs/TECH-DEBT.md`).

## 7. Live-region / a11y de componentes

- **Sintoma/heurística:** `aria-live` montado DENTRO do que desmonta ao fechar (anúncio morre junto); região polite montada unconditionalmente em lista longa (N regiões); role/status faltando em feedback async. Buscar: `aria-live`, `role="status"` em `shared/` e células.
- **Norma no repo:** engineering-audit smell (:104); `.agents/rules/campanha-edit-where-you-see.mdc` quando tocar edição inline.
- **Fonte oficial:** https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions (autoridade ARIA — react.dev/nextjs.org delegam a11y a ela) · https://react.dev/learn
- **Receita:** região persistente FORA do bloco desmontável; UMA região compartilhada por tela, texto injetado no anúncio.
- **Precedente:** B32+ (constantes de mensagem + live-region).

## 8. Loading/streaming feedback errado

- **Sintoma/heurística:** spinner desabilitando o CONTROLE em vez de dimar o resultado; falta `<Suspense>`/`loading.tsx` em rota com await visível; skeleton cobrindo página inteira onde uma ilha basta.
- **Norma no repo:** `.agents/rules/engineering-standards.mdc:29-32` (transitions + Suspense; "dima o resultado, não o controle").
- **Fonte oficial:** https://react.dev/reference/react/Suspense · https://react.dev/reference/react/useTransition · https://nextjs.org/docs/app/guides/caching
- **Receita:** `useTransition`/`isPending` dimando resultado; `loading.tsx` por segmento; `CampaignListPending` como shell pendente de lista.
- **Precedente:** `shared/CampaignListPending.tsx`.

## 9. next/image / next/fonts / assets mal usados

- **Sintoma/heurística:** `<img>` raw onde `next/image` serve (sem motivo documentado — ícone SVG inline é motivo); `width/height` ausentes (CLS); fontes via CSS `@import` em vez de `next/font`; `priority` faltando no hero acima da dobra.
- **Norma no repo:** convenção de Media/MediaProxy do site público (`AGENTS-public.md` quando tocar `/api/media/file`).
- **Fonte oficial:** https://nextjs.org/docs/app/api-reference/components/image · https://nextjs.org/docs/app/api-reference/components/font
- **Receita:** migrar para `next/image` com dims explícitas; `next/font/local|google` com subset; `priority` só no LCP real.
- **Precedente:** capas servindo 200 via proxy `/api/media/file/...` (OPS52).
