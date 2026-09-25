# Post-mortem: upload de capa em Links de compartilhamento bloqueado pela rota S3

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-25                                                                    |
| Severidade          | alta (bloqueia uploads de mídia em produção)                                  |
| Ambiente            | prod (sintoma e diagnóstico read-only) + dev/worktree (reprodução e correção) |
| Issue(s)            | sem Issue                                                                     |
| PR do fix           | #1354                                                                         |
| Detectado por       | humano                                                                        |

## Timeline

| Momento            | Data/hora                    | Evento                                                                                                               |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Início provável    | não apurado                  | A introdução exata é não apurada. O sintoma foi reportado contra a UI da versão S29, com múltiplos destinos.         |
| Detecção           | 2026-09-25, hora não apurada | O humano relatou que o envio da capa permanecia em "Enviando..." até desistir no admin de Links de compartilhamento. |
| Diagnóstico        | 2026-09-25                   | Diagnóstico read-only em produção associou o bloqueio à rota S3 do container.                                        |
| Correção mergeada  | pendente                     | Correção implementada e PR #1354 aberto; CI e merge pendentes.                                                       |
| Deploy             | pendente                     | O merge dispara o deploy; staging é automático e produção depende de aprovação humana.                               |
| Verificado em prod | pendente — aprovação humana  | CI, PR, deploy e confirmação do comportamento em produção estão pendentes.                                           |

## O bug

Em produção, no admin de Links de compartilhamento, o envio de uma capa permanecia em **Enviando...** até a desistência. O relato ocorreu na versão S29, com múltiplos destinos.

O incidente não foi reproduzido com o storage local do worktree `fix/13`, em `http://localhost:3297`. O envio da capa funcionou tanto na criação de um link quanto na edição de um link com duas linhas no array `destinations`: `Imagem > Criar Novo`, arquivo, alt e Salvar resultaram em `POST /api/media 201` e upload concluído. O formulário e o array não causaram o incidente.

## Causa-raiz

O `PutObject` S3 aguardava uma rota de rede inacessível. Os logs do container em produção registravam `connect ETIMEDOUT 10.0.0.1:3900`; `host.docker.internal` resolvia para `10.0.0.1`, enquanto o gateway IPv4 `10.0.11.1` da rede `stack_default` respondia de imediato ao Garage. A topologia observada tornou o alias `host-gateway` uma rota não confiável até o Garage. A alteração que introduziu essa mudança e a origem exata do incidente são não apuradas. A configuração efetiva do UFW não foi inspecionada, portanto este documento não atribui a causa ao firewall.

`src/payload.config.ts:184-207` repassa `S3_ENDPOINT` ao plugin S3. `src/collections/ShareLink.ts:257-265` define apenas o campo de upload e não participa do POST de `media`. Não há base para atribuir o incidente ao S29; ele é apenas a UI contra a qual o sintoma foi reportado.

### 5 whys

1. Por que a tela fica em "Enviando..."? Porque `POST /api/media` não conclui enquanto aguarda o `PutObject`.
2. Por que o POST não conclui? Porque a operação S3 expira ao tentar conectar em `10.0.0.1:3900`.
3. Por que o container tenta esse endereço? Porque `host.docker.internal` resolve para `10.0.0.1` em produção.
4. Por que essa rota falha? Porque o alias `host-gateway` deixou de alcançar o Garage após a mudança de topologia; o evento exato não foi apurado.
5. Por que o deploy não detectou a indisponibilidade? Porque o caminho S3 não tinha um probe próprio no fluxo de deploy.

## Correção

`scripts/deploy-homeserver.sh` agora testa o endpoint S3 a partir da imagem migrator já construída, antes das migrations. Se `host.docker.internal` falhar, o script testa os gateways IPv4 de `stack_default`; o primeiro gateway acessível gera, por `scripts/lib/mediaEndpoint.mjs`, um override de Compose específico do ambiente. O override altera `S3_ENDPOINT` somente no runner e no serviço de migrations, é validado com `docker compose ... config --quiet` e passa a valer via `COMPOSE_FILE`. Arquivos de ambiente e credenciais não são reescritos.

Depois do healthcheck, o endpoint é sondado de dentro do container em execução; uma falha aciona o rollback. Se nenhum gateway responder, o deploy para antes das migrations. O procedimento também ficou registrado em `docs/ops/teqo-1313-deploy.md`. Nenhuma migration foi criada; o campo de `ShareLink` e a UI não foram alterados.

## Verificação

- Teste de regressão: `tests/unit/mediaEndpoint.unit.spec.ts`, 3/3; no HEAD pré-fix, o novo import de `scripts/lib/mediaEndpoint.mjs` não existia, e o spec passa com a correção.
- Regressão do deploy: `tests/unit/deployScript.unit.spec.ts`, "repairs a broken S3 host gateway before migration and verifies the live route"; falha no estado pré-fix e passa com a correção.
- Suíte: `pnpm gate:fast` verde, 424 arquivos e 4698 testes; integração de ShareLink 25/25; `frontendShareLink` e2e 6/6; `pnpm format:check`, `pnpm check:cycles`, `pnpm knip` e `bash -n` verdes.
- CI: pendente no PR #1354.
- Deploy: pendente de PR, CI e merge; a produção ainda depende de aprovação humana.
- verificado em prod: pendente — aprovação humana.

## Prevenção

| Estratégia                                                                            | Custo  | Estado                                    |
| ------------------------------------------------------------------------------------- | ------ | ----------------------------------------- |
| Probe do S3 na imagem migrator e fallback dinâmico para um gateway IPv4 acessível     | barata | implementada neste worktree               |
| Probe do S3 no container em execução após o healthcheck, com rollback em falha        | barata | implementada neste worktree               |
| Regressões unitárias do helper e do script, mais diagnóstico e recuperação no runbook | barata | implementada neste worktree               |
| Observabilidade contínua do S3 e alertas de falha ou latência                         | cara   | documentada, não implementada neste fluxo |
| Upload sintético de mídia para detectar perda da rota antes do uso humano             | cara   | documentada, não implementada neste fluxo |

**Estratégia implementada:** o deploy passa a validar a rota antes das migrations, ajustar apenas o endpoint dos serviços do ambiente selecionado e repetir a validação no container em execução. Os testes de regressão fixam a ordem e o fallback, e o runbook registra o diagnóstico.

**Estratégia documentada (cara):** observabilidade contínua e alertas do S3, além de upload sintético de mídia.

## Lições

- O storage local prova o caminho do formulário, mas não exercita a rota S3 de produção.
- O campo exibido no admin apontava para `ShareLink`; a falha real ocorreu no POST de `media`. O diagnóstico precisou seguir a requisição até o `PutObject`.
- A versão S29 é o contexto do relato, não uma origem comprovada.
- Health do site e alcance do Garage são dependências diferentes. O deploy precisa testar a segunda antes de declarar o rollout saudável.
- Sem inspeção do UFW, a causa fica limitada à rota observada; atribuir o incidente ao firewall seria especulativo.
