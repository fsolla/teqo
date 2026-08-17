# Migrar a media de produção do Vercel Blob para o Garage S3

Status: registrado
Atualizado em: 2026-08-16
Issue: #3
Priority: P2
Model: cursor-grok-4.5-medium
Impeccable: A — N/A
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável
Responsável: —

## Intenção

A media (capas de posts, fotos de atividades) vive no Vercel Blob via plugin
`vercelBlobStorage` com token `BLOB_READ_WRITE_TOKEN` — inclusive no seed de posts,
que usa `@vercel/blob` direto contra uma store compartilhada entre ambientes. O
homeserver já roda o **Garage S3** (3900/3903). Queremos uploads e serving vindos
de casa, com os objetos existentes migrados e um contrato de URL pública que não
quebre o que já foi publicado.

## Persona e fluxo

- **Persona / contexto:** o dev (humano) migrando; o editor do admin subindo capas; o visitante do site vendo os posts antigos sem imagem quebrada.
- **Job principal:** media de produção inteiramente no Garage, sem dependência do Vercel Blob.
- **Fluxo desejado:** novo upload vai pro Garage → post antigo continua servindo a mesma imagem → seed de posts re-roda escrevendo no Garage → o site renderiza tudo sem referenciar o Blob.
- **Anti-goals de produto:** quebrar URLs públicas já publicadas (posts indexados, emails enviados); manter dois storages vivos para sempre; upload silencioso quando o token/credencial falta.

## Objetivo e aceite

- Storage da collection `media` aponta para o Garage S3; novos uploads não tocam o Vercel Blob.
- Objetos existentes migrados do Blob para o Garage; posts antigos seguem servindo imagens (contrato de URL pública estável ou migração de URLs + redirect).
- `pnpm db:seed:posts` escreve no Garage (e a re-execução do seed continua idempotente).
- Aceite de falha: sem credencial de storage, o upload falha com erro claro (fail-closed), nunca grava em lugar errado nem some.
- Guardrails de produto: a store não é mais compartilhada entre ambientes sem querer — cada ambiente aponta para o bucket certo.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** nenhuma de produto — migração de infra.
- **Forma:** N/A

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/payload.config.ts` (plugin `vercelBlobStorage` → storage S3-compatível para `media`); `scripts/seed-posts.mjs` (usa `@vercel/blob` direto: `put`/`del` de capas); env (`BLOB_READ_WRITE_TOKEN` em `.env.example`); referências a URLs de media em docs/richText.
- **Precedente a olhar:** Garage S3 rodando no homeserver (acessível por LAN/tailnet/túnel); Payload suporta storage S3-compatível (padrão de plugin); infra-solla `plano-implementacao.md` §7.1 (S3→Garage já previsto no branch standalone).
- **Risco de acoplamento:** o contrato de URL pública (domínio das imagens) está embutido em conteúdo já publicado — a migração precisa preservar ou redirecionar; o seed compartilha a store entre ambientes hoje, então o divisor de ambientes precisa ser explícito.

## Dependências

- OPS50 (suave — pipeline/deploy Forgejo para empurrar a troca)
- OPS51 (soft — a media referenciada pelos posts restaurados deve continuar resolvível durante a migração do banco)

## Fora de escopo

- Excluir a conta/objects do Vercel Blob — só após cutover estável.
- Migrar outros storages (não há) ou o Vercel Analytics.
- Cutover de DNS/hospedagem — infra §7.5–7.6.
- E-mail (Stalwart/Brevo) — outro item do §7.1.

## Rabbit holes de produto

- **Reescrever URLs de media no banco em massa.** Frágil e destrutivo se não houver redirect. **Corte neste item:** priorizar contrato de URL estável (mesmo caminho público, outro backend) e reescrever só se o executor provar que é seguro.
- **CDN/otimização de imagens própria.** Fora do apetite; hoje o Blob serve direto. **Corte neste item:** serving simples via túnel/rota existente.

## Questões em aberto (produto)

- **Como servir a media publicamente a partir do Garage?** **Opções:** A) rota pública dedicada via Cloudflare (ex.: media.<domínio>) apontando para o Garage | B) a própria app serve/re-encaminha. **Recomendação:** A — separa tráfego de mídia do container e mantém URLs limpas. _(assumido — validar)_
- **Manter o domínio antigo do Blob como redirect durante a transição?** **Opções:** A) sim, por N dias | B) não. **Recomendação:** A enquanto o Blob existir — posts/emails antigos continuam funcionando. _(assumido — validar)_

## Referências

- `src/payload.config.ts` (plugin `vercelBlobStorage`, collection `media`)
- `scripts/seed-posts.mjs` (uso direto de `@vercel/blob`, capas determinísticas)
- infra-solla: `STATE.md` (Garage em 3900/3903, rota `garage.solla.dev`)
