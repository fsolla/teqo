# Hardening do serving privado de reels (ramo S3)

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1162
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~½ dia eng; cobertura do ramo de produção sem tocar o contrato
Responsável: —

## Intenção

O C193 (#1152) entregou o serving privado dos artefatos de reel com dois ramos no mesmo utilitário: disco local (dev/test) e S3/Garage (produção). A suíte só exercita o ramo de disco — o caminho que roda em produção (`HeadObjectCommand` → `GetObjectCommand` com `Range`, 206/416, 404 de objeto ausente, content-type/disposition) depende de inspeção, e uma regressão passaria o CI verde. Este item fecha essa lacuna com um teste que injeta o cliente S3 (sem depender de infraestrutura real) e pina o contrato de resposta do ramo de produção.

## Contexto

- Utilitário: `src/utilities/reels/reelMediaResponse.ts` (`buildReelMediaResponse`, `openS3Object`, `openLocalObject`).
- Regras puras (já cobertas por unit): `src/lib/reelMedia.ts` (`reelMediaContentType`, `reelMediaContentDisposition`, `reelMediaHeaders`).
- Cobertura atual: `tests/int/reel.int.spec.ts` exercita a rota e o disco local; `tests/unit/reel.unit.spec.ts` cobre o puro.
- Achados que motivaram o item (triage do C193): `isMissingObject` já checava um campo inexistente (`httpStatusCode`) antes do fix da sessão; o ramo S3 ficou sem prova.

## Objetivos

- Um teste (unit ou int, sem S3 real) cobre o ramo S3 de `buildReelMediaResponse`:
  - objeto existente → 200 com `Content-Length`/`Content-Type`/`Cache-Control: private, no-store`;
  - `Range` válido → 206 com `Content-Range` e slice correto;
  - `Range` insatisfazível → 416 com `Content-Range: bytes */<size>`;
  - `NoSuchKey`/404 → 404 silencioso (sem vazar erro do SDK);
  - `ContentLength` ausente → erro interno (nunca 200 enganoso).
- O teste não sobe Garage/S3: injeta um cliente falso no ponto de resolução de storage (extrair uma costura testável se necessário, sem alterar o contrato público).
- Guardrails: nenhuma mudança de comportamento observável na rota; sem migration; sem Consent; `Media.read` intocado.

## Decisões em aberto (implementação)

- **Costura de injeção:** expor um override interno (`__setReelMediaStorageForTests`?) é feio; preferir extrair `openReelMediaObject({ storage, filename, rangeHeader })` como função de módulo testável com um storage fake, mantendo `reelMediaStorage()` privado. Decidir no impl plan.
- **Camada:** unit com fake do `S3Client` (rápido, sem DB) vs int com `vi.mock('@aws-sdk/client-s3')`. Preferir unit — o ramo não toca Payload/DB.

## Fases verificáveis

1. **Costura + unit do ramo S3** — extrair o ponto de injeção e cobrir a matriz acima.
2. **Gates** — `pnpm gate:fast`; push via `pnpm push`.

## Rabbit holes / Não escopo

- Subir MinIO/Garage em CI para testar integração real (custo de infra desproporcional; o contrato do SDK é estável).
- Testar o ramo de disco de novo (já pinado no `reel.int.spec.ts`).
- Mudar o desenho do streaming (roteamento por presign, proxy self-fetch) — decisão travada no impl do C193.
- C194 (#1153) e C195 (#1154) — consumidores do contrato, não deste hardening.

## Aceite de engenharia

- [ ] Ramo S3 coberto com fake, sem infra externa e sem afrouxar asserções.
- [ ] Nenhuma mudança de comportamento no serving; `pnpm gate:fast` verde.
