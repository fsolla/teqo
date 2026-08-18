# OPS52-media — Recuperar os arquivos de media de produção (capas dos artigos)

Status: registrado
Atualizado em: 2026-08-18
Issue: #10
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: A — N/A (sem mudança de UI; a seção renderiza certo)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Entregamos a seção de conteúdos (artigos) na home de campanha (S1, 2026-08-17) e as capas dos artigos **não carregam** — nem na seção nova, nem nas páginas de artigo. O diagnóstico aponta para um débito pré-existente à migração Blob→Garage (OPS52): as 40 rows da collection `media` (capas dos ~39 posts) têm URL relativa `/api/media/file/<filename>` e o arquivo **não existe em lugar nenhum** (disco perdido, bucket Garage vazio, sem objetos no Blob com essas chaves). O contrato de URL está certo — o Payload serve `/api/media/file/<filename>` pelo proxy do storage (comprovado no código do Payload 3.82 + OPS52) — só falta o **arquivo no bucket de produção** para a URL resolver. A seção S1 apenas tornou o problema visível na home; o site público está com imagens quebradas na reta final da eleição.

## Persona e fluxo

- **Persona / contexto:** visitante da home de campanha (celular, meio de funil) vendo a seção "Acompanhe de perto" sem capas; editor abrindo artigo sem imagem; quem executa (dev/ops) recuperando arquivos.
- **Job principal:** capa de todo artigo carrega no site público.
- **Fluxo desejado:** visitante rola a home → vê cards com capa → abre o artigo → capa e corpo renderizam; editor sobe conteúdo novo e a capa nova aparece.
- **Anti-goals de produto:** NÃO reescrever URLs públicas em massa; NÃO trocar o contrato de URL (relativa via proxy) que o OPS52 definiu; NÃO inventar placeholder "em breve" em card sem imagem.

### Esboço de fluxo (A — sem UI)

```text
[home S1: card sem capa hoje] → [arquivo restaurado no bucket prod] → [GET /api/media/file/<filename> → 200]
→ [cards com capa; artigo renderiza] → [uploads novos seguem funcionando pelo mesmo proxy]
```

## Objetivo e aceite

- As ~40 capas de media de produção resolvem: `GET https://jorgesolla1313.com.br/api/media/file/<filename>` retorna **200 com a imagem** para todas as rows (verificação por curl/script, uma por filename).
- A seção S1 da home e as páginas de artigo exibem as capas; nenhum erro de imagem no console do navegador.
- As rows da collection `media` **não mudam de URL nem são recriadas sem necessidade** — o contrato relativo já é o que o proxy serve; se o executor recriar rows, precisa preservar os `filename` (chave determinística `<slug>.<ext>` do seed) para as URLs continuarem resolvendo.
- Uploads novos (admin, seed, atividades) continuam servindo pelo mesmo proxy (sem regressão).
- Fail-closed mantido: sem credencial S3 válida, nenhum upload/escrita no bucket — nunca gravar em storage errado.
- Zero mudança de schema/migration/Consent; nenhuma collection nova.

## Dados (intenção)

- **Vou apresentar dados?** Não — são imagens, não métricas.
- **Decisões desbloqueadas:** nenhuma de produto nova (quem decide "o quê" já está no aceite; a fidelidade da capa é a Q1).
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/seed-posts.mjs` (`ensureCoverMedia` — precedente de upload determinístico `<slug>.<ext>`, idempotente por `filename`); bucket de produção Garage `teqo-media` (env `S3_*` do `~/stack/teqo-1313.env`); sem mudança esperada em `src/payload.config.ts`/`src/utilities/mediaStorage.ts` (contrato já comprovado).
- **Precedente a olhar:** Issue #3/OPS52 (decisão A→B: bucket privado + proxy `/api/media/file`); `docs/plans/ops52-blob-vercel-para-garage.md` e `-impl.md` (prova de contrato PUT/GET/DELETE e runbook do bucket).
- **Risco de acoplamento:** a execução escreve no **bucket de produção** — ferramenta de reconciliação deve ser explícita sobre o alvo (nunca rodar contra bucket/ambiente errado; o guard de DB local não cobre bucket); a fonte primária dos arquivos é o WordPress de origem (jorgesolla.com.br — o mesmo fetch do seed), com o Vercel Blob store (chaves determinísticas) e dumps antigos como fontes secundárias. Nenhuma PII envolvida (imagens públicas).

## Dependências

- OPS52 (concluído — storage real definido e deployado). Nenhuma outra.

## Fora de escopo

- Deletar objetos/contas do Vercel Blob (fica para depois do cutover estável — já anotado no OPS52).
- Tornar o bucket público, CDN ou otimização/redimensionamento de imagem.
- Retrabalho da seção S1 ou das páginas de artigo (a UI renderiza certo; o problema é a media).
- Outros storages ou coleções além de `media`.

## Rabbit holes de produto

- **Reescrever URLs das 40 rows no banco.** Se alguém "só completar": reescrita em massa desnecessária e frágil — o contrato relativo já é o que o proxy serve. **Corte:** arquivo no bucket com a chave certa resolve a URL; DB intocado.
- **Caçar arquivos em dumps antigos.** O Postgres não guarda bytes de media (Payload armazena no storage), então dump não tem as imagens. **Corte:** WordPress é a fonte primária (o seed prova o fetch ao vivo); Blob store secundário.
- **"Consertar" a seção com placeholder/imagem fake.** Card sem capa degrada para a banda cinza já existente — não inventar imagem nem texto "em breve". **Corte:** restaurar o máximo possível e registrar as exceções reais.

## Questões em aberto (produto)

- **Prioridade: subir de P2 para P1?** O defeito é visível no site público (home S1 + artigos) na reta final da eleição. **Recomendação:** P1. _(assumido — validar)_
- **Fidelidade da capa restaurada?** **Opções:** A) capa atual do WordPress de origem para cada post (mesma fonte do seed — o que o público já conhece) | B) aceitar qualquer imagem disponível. **Recomendação:** A — restauração fiel à origem, com registro das raras exceções. _(assumido — validar)_
- **E se alguma capa não for recuperável?** **Opções:** A) card sem imagem (degradação existente: banda cinza) | B) placeholder. **Recomendação:** A — honesto e já implementado. _(assumido — validar)_

## Referências

- Forgejo Issue #10 (OPS52-media, `ready`) e #3 (OPS52, concluído)
- `docs/plans/ops52-blob-vercel-para-garage.md` / `-impl.md` (contrato do proxy, runbook do bucket)
- `scripts/seed-posts.mjs` (`ensureCoverMedia` — upload determinístico e idempotente)
- `src/collections/Media.ts`, `src/utilities/mediaStorage.ts` (fail-closed `S3_*`)
- `AGENTS.md` §Media/OPS52 (estado de produção: bucket `teqo-media`, endpoint tailnet, proxy `/api/media/file`)
