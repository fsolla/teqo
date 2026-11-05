# Post-mortem: card em destaque do board renderizava a legenda inteira do Instagram

> Template do `/bug-fix`. Fatos apurados nesta sessão; o que não foi apurado fica marcado como tal.

## Registro

| Campo               | Valor                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-11-05                                                                                |
| Severidade          | média (regressão visual na home; sem indisponibilidade, perda de dados ou erro funcional) |
| Ambiente            | prod                                                                                      |
| Issue(s)            | sem Issue                                                                                 |
| PR do fix           | a preencher após a abertura do PR                                                         |
| Detectado por       | humano (relato na sessão: “fontes super grandes e o texto não quebra” no board da home)   |

## Timeline

| Momento               | Data/hora   | Evento                                                                                                                   |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Início provável       | 2026-10-22  | S47 (`5635e652`) reescreve `CampaignContentCard` e remove o `line-clamp-3` do título do card em destaque.                |
| Detecção              | 2026-11-05  | Relato humano; o HTML de produção mostrava uma legenda de 889 caracteres como `h3` do destaque, a 31px, sem clamp.       |
| Correção implementada | 2026-11-05  | `fix/board-featured-caption-clamp`: clamp de 3 linhas no destaque, remoção de `text-balance`, `break-words` e `min-w-0`. |
| Correção mergeada     | não apurado | Pendente do CI/PR.                                                                                                       |
| Deploy                | não apurado | Pendente; produção exige approve humano no environment `production`.                                                     |
| Verificado em prod    | não apurado | Pendente de confirmação humana pós-deploy.                                                                               |

## O bug

Na home pública, o board “Acompanhe de perto” (seção de artigos, YouTube e Instagram) renderizava o card em destaque com a legenda completa de um post do Instagram. No caso real, eram **889 caracteres** em um `h3` de **31px** (25px no mobile), sem `line-clamp`, o que esticava a coluna e transformava o destaque em uma parede de texto. Os cards compactos tinham `line-clamp-3`, mas carregavam `text-balance`, que em alguns browsers quebra o funcionamento do `-webkit-line-clamp` — o texto deixava de truncar. Como o board é ordenado por recência e o Instagram era a fonte mais recente, as quatro posições eram legendas, não títulos de matéria.

## Causa-raiz

1. **Por que o texto ficou gigante?** Porque o `h3` do destaque não tinha `line-clamp` e usava o tamanho de título editorial (31px).
2. **Por que não tinha clamp?** A S47 (`5635e652`) separou o card em `featured` e `compact`; o `h3` antigo, que aplicava `line-clamp-3` a todas as variantes, foi substituído por um `h3` de destaque sem clamp (o design assumia um título curto de matéria, não uma legenda de feed).
3. **Por que a legenda inteira virou título?** `toInstagramCardData` usa `post.caption` como `title`; o board ordena posts + YouTube + Instagram por data e corta em 4. Com o feed do Instagram mais recente, a legenda ocupa o destaque.
4. **Por que os compactos também falhavam em alguns browsers?** `text-balance` foi adicionado aos dois `h3`; a combinação com `-webkit-line-clamp` não é confiável em todos os motores.
5. **Por que passou?** O e2e pinava o clamp apenas no card compacto (a legenda longa do stub), nunca no destaque; o card em destaque do stub tem legenda curta.

## Correção

- `src/components/CampaignContentCard.tsx`: `line-clamp-3` no `h3` do destaque; `text-balance` removido dos dois `h3`; `break-words` em ambos; `min-w-0` no wrapper do card.
- `src/components/CampaignContentSection.tsx`: `min-w-0` nas duas colunas do grid (destaque e laterais).
- `tests/e2e/frontend.e2e.spec.ts`: o teste do feed do Instagram agora exige `-webkit-line-clamp: 3` e `overflow: hidden` também no `h3` do card em destaque.

A causa é o card de destaque sem limite; o clamp restaura o comportamento anterior sem esconder a legenda do DOM (o texto completo continua acessível e compartilhável).

## Verificação

- Teste de regressão: `tests/e2e/frontend.e2e.spec.ts` → “renders the Instagram feed…” — a asserção do destaque falha sem o `line-clamp` e passa com o fix (verificação local de CSS; execução no CI).
- Suíte: `pnpm gate:fast` verde (461 arquivos, 5.069 testes).
- CI: pendente do PR.
- Prod: pendente de approve/deploy e confirmação humana.

## Prevenção

| Estratégia                                                                  | Custo  | Estado                         |
| --------------------------------------------------------------------------- | ------ | ------------------------------ |
| Pinar o clamp no card em destaque no e2e (além do compacto)                 | barata | implementada agora             |
| Separar “título de exibição” de “legenda” no feed (excerpt curto na origem) | cara   | documentada — não implementada |

**Estratégia implementada:** a asserção de `-webkit-line-clamp` no destaque fecha o buraco que deixou a regressão passar.

**Estratégia documentada (cara):** derivar um excerpt curto da legenda do Instagram para o card (primeira frase/limite de caracteres), mantendo a legenda completa apenas no `alt`/compartilhamento. Isso reduziria o nome acessível gigante do link e o texto do compartilhamento, mas mexe no contrato de conteúdo do board e merece decisão de produto.

## Lições

- Quando o design assume “título curto” e o dado real é uma legenda de feed, a proteção não pode depender do tamanho do conteúdo: o clamp é parte do componente, não da amostra do teste.
- `text-balance` + `line-clamp` é uma combinação frágil entre motores; usar `text-balance` só em títulos curtos e estáveis (headings de seção).
- O e2e deve pinar a variante que tem o maior tipo e a maior probabilidade de receber conteúdo longo — o destaque.
