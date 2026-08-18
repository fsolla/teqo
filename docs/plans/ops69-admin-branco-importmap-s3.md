# Admin do Payload abre em branco em produção (importMap sem o handler do storage S3)

Status: aguardando execução (blocked)
Atualizado em: 2026-08-18
Issue: #77
Priority: P0
Model: composer-2.5
Impeccable: A — sem mudança de UI (corrige regressão que deixa o admin em branco)
Rascunho UI: N/A — sem UI nova
Appetite: ~0,25–0,5 dia eng; um outcome verificável (login do admin renderiza em prod)
Responsável: —

## Intenção

O admin do Payload (`/admin`) está **em branco em produção** (jorgesolla1313.com.br): a página carrega (HTML 200, chunks 200, `/api/users/me` 200), o shell do app hidrata, mas o formulário de login nunca renderiza — nada aparece. Isso trava o time editorial e de campanha: sem admin não há CMS, não há gestão de conteúdo, não há import/export de contatos.

**Diagnóstico verificado (evidência abaixo):** a causa raiz é o `importMap` commitado (`src/app/(payload)/admin/importMap.js`) **sem** a entrada `@payloadcms/storage-s3/client#S3ClientUploadHandler`. O plugin `s3Storage` (OPS52) é ativado só quando as envs `S3_*` estão presentes — em produção elas estão, então o admin precisa resolver o handler do upload do `media` via importMap, e a entrada não existe → o admin falha ao montar a view. Em dev/test as `S3_*` não existem → plugin desligado → importMap consistente → admin funciona. É a divergência dev/prod exata.

O erro reportado no console ("Cross-Origin Request Blocked" + SRI mismatch do `beacon.min.js` do Cloudflare) é **ruído, não causa**: o hash `sha512` declarado no HTML bate com o arquivo real servido (verificado), e o "computed hash" de conteúdo vazio no erro do usuário indica apenas que o fetch do beacon foi bloqueado no browser dele. Bloquear o beacon não muda nada no admin. Não seguir por esse caminho.

## Persona e fluxo

- **Persona / contexto:** time editorial/campanha (staff com acesso ao `/admin`); hoje está parado — abriu o admin, página branca, sem erro aparente.
- **Job principal:** entrar no `/admin` e fazer login.
- **Fluxo desejado:** abrir `jorgesolla1313.com.br/admin` → redirecionar para `/admin/login` → formulário de login visível → logar e usar o CMS normalmente.
- **Anti-goals de produto:** não é para redesenhar o admin, nem mudar o storage de media, nem mexer no contrato `/api/media/file/...`; é restaurar o comportamento que existia.

## Objetivo e aceite

- `/admin` e `/admin/login` renderizam o formulário de login em produção (não página branca), sem erros no console do browser.
- Login no admin funciona de ponta a ponta em prod (autenticar e abrir uma collection/global).
- O upload de media continua funcionando (Garage S3) — o fix não pode quebrar o fluxo OPS52.
- O importMap commitado volta a ser consistente com o config ativado por envs de produção.
- Dev/test continuam funcionando sem as envs `S3_*` (storage local, como hoje).

## Dados (intenção)

- **Vou apresentar dados?** Não — item de infra/regressão, sem superfície de dados.
- **Decisões desbloqueadas:** nenhuma de produto; decisão de engenharia (ver Questões em aberto).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(payload)/admin/importMap.js` (arquivo gerado, commitado), `src/payload.config.ts` (plugin `s3Storage` condicional, linhas ~150–172), `src/utilities/mediaStorage.ts` (resolução das envs `S3_*`), `src/collections/Media.ts` (upload), `package.json` (`pnpm generate:importmap`).
- **Precedente a olhar:** commit `dabc00f4` (OPS52 — trocou vercel-blob por s3 e regenerou o importMap **sem** as envs S3, removendo o handler do blob e não adicionando o do S3); o e2e do admin (`tests/e2e/admin.e2e.spec.ts`) não pega isso porque roda sem `S3_*` (mesma divergência dev/prod).
- **Risco de acoplamento:** o importMap é regenerado inteiro por `pnpm generate:importmap` — regenerar com envs S3 altera só as entradas do storage (verificado: +2 linhas do `S3ClientUploadHandler`); não deve tocar nas entradas existentes do lexical/import-export.

## Dependências

- Soft: OPS52 (introduziu a regressão — contexto, não blocker).

## Fora de escopo

- Seguir o erro do beacon do Cloudflare (`static.cloudflareinsights.com`) — é ruído de console; registrar como nota para a equipe, não como trabalho.
- Mudar o storage de media (S3→outro), o contrato de URL `/api/media/file/...`, ou o comportamento do plugin em dev/test.
- Melhorias de build/deploy fora do fix mínimo (guard no CI pode entrar como item sucessor — ver Questões).

## Rabbit holes de produto

- **"Já que vou mexer no importMap, aproveito e atualizo tudo".** Regenerar sem envs de produção corretas introduz a MESMA classe de bug de novo. **Corte neste item:** regenerar com as envs S3 setadas (mesmo as de teste apontando para localhost/garage de teste), conferir o diff (só storage), e não tocar em mais nada.
- **"O erro do beacon deve ser o problema, vamos mexer no Cloudflare".** Caminho morto: o beacon não bloqueia o admin (evidência: admin branco também via origem direta, sem Cloudflare no meio). **Corte:** registrar como ruído e focar no importMap.

## Questões em aberto (produto)

- **Como impedir que a divergência dev/prod volte a acontecer?** **Opções:** A) só regenerar e commitear o importMap (mínimo, risco de regressão futura quando um plugin condicional mudar de novo); B) regenerar + nota/documentação no `local-database` ou no AGENTS.md dizendo que `generate:importmap` precisa das envs de produção quando o config for condicional; C) regenerar + guard de CI (ex.: rodar `generate:importmap` com envs S3 de teste e falhar o gate se o arquivo commitado divergir). **Recomendação:** A agora (fix do incidente, mínimo e verificado) + **C como item sucessor** (evidência de que CI/e2e não pegam essa classe de bug — vale um guard, mas não bloqueia o P0). _(assumido — validar com produto)_
- **Prioridade P0 confirmada?** **Recomendação:** sim — admin é a ferramenta central do time; cada dia em branco é dia sem CMS. _(assumido — validar com produto)_

## Referências

- GitHub Issue #77
- Rascunho UI (gate): N/A
- `src/payload.config.ts` (plugin condicional `s3Storage`), `src/app/(payload)/admin/importMap.js` (entrada ausente), `src/utilities/mediaStorage.ts`, commit `dabc00f4` (OPS52), `tests/e2e/admin.e2e.spec.ts` (por que CI não pega)
- Evidência: logs do container prod (`getFromImportMap: PayloadComponent not found in importMap` para `@payloadcms/storage-s3/client#S3ClientUploadHandler`); reprodução local (admin branco com `S3_*` setadas + importMap atual; admin renderiza após regenerar o importMap com as envs e reverter o arquivo)
