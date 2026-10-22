# Impl: S48-FOLLOWUP — escape de `<` no JSON-LD da página de petição

Status: aprovado
Atualizado em: 2026-10-22
Issue: S48-FOLLOWUP-JSONLD
Intenção: débito registrado na entrega da Issue #1443 (`docs/plans/abaixo-assinado-pl-5594-2026-impl.md`, D6)
Appetite: ~1h eng — correção pontual de paridade de segurança, sem mudança de shape

## Leitura do débito

- **Outcome:** o JSON-LD das páginas públicas nunca é quebrado por um valor de conteúdo que contenha `</script>`; a página de petição passa a ter a mesma proteção que a página de artigo.
- **O que NÃO negociar:** o shape do JSON-LD (`Article`), a URL canônica e o HTML renderizado não mudam; conteúdo continua admin-only; sem schema/migration.
- **O que reavaliar:** o artigo repete a serialização inline — a correção deve extrair o dono do concern em vez de criar uma segunda cópia.

## Abordagem recomendada

**Opções:** A) repetir `JSON.stringify(jsonLd).replace(/</g, '\\u003c')` inline na petição; B) extrair `serializeJsonLd(value)` em `src/utilities/seo.ts` e usar nas duas páginas; C) sanitizador/escaping de HTML completo.

**Recomendação:** B — `src/utilities/seo.ts` já é o dono do SEO; uma função pura (string JSON com `<` escapado para `\u003c`) elimina a divergência entre artigo e petição e é unit-testável. Aplicar nas duas páginas (`[type]/[category]/[slug]/page.tsx` e `abaixo-assinado/[id]/page.tsx`).

**Rejeitadas:** A porque twina a lógica e deixa a próxima página pública repetir o erro; C porque `JSON.stringify` já cuida de aspas/backslashes e o vetor real é o fechamento de `</script>` — um sanitizador amplo seria cerimônia sem volatilidade.

### Componentes / mudanças

- **`serializeJsonLd`** (`src/utilities/seo.ts`): `JSON.stringify(value).replace(/</g, '\\u003c')`, com comentário do vetor `</script>`.
- **Duas páginas públicas**: trocar o `JSON.stringify` inline pelo helper; nenhuma mudança de shape.
- **Teste**: unit do helper (`</script>` vira `\u003c/script>`, strings normais intactas, JSON continua parseável) e pin de que as duas páginas usam o helper (source-level, como o pin da copy da petição).
- **Migration:** nenhuma.
- **UI:** Impeccable A — sem UI nova; nenhum trigger do `designer`.

## Fases verificáveis

1. **Helper + adoção** — extrair e usar nas duas páginas.
2. **Testes** — unit do helper + pin das páginas; `pnpm test:unit`.
3. **Gates** — `pnpm gate:fast`; entrega com `pnpm push`.

## Rabbit holes / Não escopo

- Não criar sanitizador genérico, não escapar `>`/`&` por reflexo, não mudar o `@type`/campos do JSON-LD.
- Não tocar em canonical/OG/metadata; não criar rota/endpoint.

## Riscos e mitigação

- **Quebrar o JSON-LD** (escape errado): o unit test faz `JSON.parse` do resultado e compara o objeto; a página continua renderizando o script.
- **Divergência futura**: o helper único + pin source-level impede uma terceira cópia inline.

## Aceite de engenharia

- [ ] `serializeJsonLd` é o único caminho de serialização JSON-LD nas páginas públicas.
- [ ] `</script>` em título/subtítulo não fecha o script; JSON permanece válido.
- [ ] Sem schema/migration/URL nova; unit verde e `pnpm gate:fast` limpo.
- [ ] Invariantes AGENTS/engineering-standards preservados (sem PII em log, access inalterado).

## Self-score decision-quality

5/5 — decisão cara (onde mora a serialização) tem rejeitadas; appetite de 1h; rabbit holes nomeados; depth check reusa o dono `src/utilities/seo.ts` em vez de twinar; o outcome original da S48 não é reescrito.
