# Cards personalizados da campanha no site público

Status: registrado (aguardando plano em main)
Atualizado em: 2026-09-12
Issue: #941
Priority: P1
Model: composer-2.5
Impeccable: C — fluxo público novo em `/cards` + encaixe na home de campanha
Rascunho UI: docs/plans/cards-personalizados-campanha-ui-draft.html
Appetite: ~3–4 dias eng; um fluxo completo da descoberta na home ao download de um PNG personalizado
Responsável: —

## Intenção

Dar ao visitante uma forma simples de mostrar apoio a Jorge Solla nas redes. A home faz o convite e apresenta os modelos; a página `/cards` concentra escolha, personalização, prévia e download.

Home e página formam um único funil. A pessoa não precisa criar conta nem entregar seus dados: nome e foto ficam no aparelho durante todo o processo.

## Persona e fluxo

- **Persona / contexto:** visitante do site, geralmente no celular, que quer manifestar apoio e publicar uma imagem com a identidade da campanha.
- **Job principal:** criar em poucos passos um card pessoal, com aparência oficial, pronto para baixar e compartilhar.
- **Fluxo desejado:** encontra o convite na home → escolhe um modelo ali ou entra em `/cards` → informa o nome ou escolhe uma foto → ajusta a prévia → gera e baixa o PNG.
- **Anti-goals de produto:** virar editor gráfico completo, galeria pública, rede social, cadastro de apoiador ou novo canal de coleta de dados.

### Esboço de fluxo (C)

```text
[home: convite + modelos] → [/cards: modelo escolhido]
→ [modal desktop | bottom drawer mobile] → [personalizar + conferir]
→ [card pronto] → [baixar PNG]
```

### Rascunho UI (C)

- Rascunho UI (gate): `docs/plans/cards-personalizados-campanha-ui-draft.html`
- Cenas: home em contexto, escolha em `/cards`, compositor de nome, compositor de foto, resultado e erro recuperável, em desktop e mobile.
- As artes aparecem como placeholders neutros porque o rascunho de gate não embute marca ou imagens reais. Os arquivos originais já estão acessíveis em `/home/fsolla/Documentos/cards/`.

## Objetivo e aceite

- A home ganha uma seção curta de convite com os três modelos e o CTA `Criar meu card`, sem alterar as seções existentes.
- A posição recomendada é depois de `Receba as novidades da campanha` e antes do rodapé, preservando a captura de contato como primeira conversão do fim da página.
- O catálogo mostra os três modelos lado a lado no desktop e como carrossel de um item com parte do próximo visível no mobile.
- O CTA geral leva ao início de `/cards`; tocar em um modelo na home leva ao mesmo endereço com aquele modelo selecionado e abre o compositor, sem um segundo editor na home.
- Quem entra diretamente em `/cards` encontra o catálogo e escolhe um modelo antes de abrir o compositor.
- O modelo de nome usa a base vazia `1080×1440`, insere somente o nome na área prevista e nunca corta texto silenciosamente. A frase final é `#SOU <nome> TÔ COM SOLLA`, como na arte oficial.
- Os dois modelos de foto permitem escolher, reposicionar e ampliar a imagem atrás da máscara transparente, sem alterar o overlay oficial.
- A moldura quadrada gera `1000×1000`; a moldura vertical gera `1000×1440`. Essas são as dimensões reais dos PNGs, apesar dos nomes dos arquivos indicarem largura `1080`.
- O compositor abre em modal central no desktop e bottom drawer no mobile. Fechar devolve a pessoa ao catálogo e ao modelo selecionado.
- Antes de escolher a foto, a pessoa vê que nome e imagem ficam no aparelho e não são enviados nem salvos.
- O estado final mostra a imagem pronta e permite baixar um arquivo `PNG`; `Criar outro card` retorna ao catálogo.
- Se uma foto não puder ser lida, o erro explica o problema e oferece `Escolher outra foto` sem deixar a pessoa presa.
- Escolha, ajuste, fechamento e download funcionam por toque e teclado; a seleção não depende apenas de cor ou gesto de arrastar.
- Proporções, área segura do nome, transparência e posição das faixas seguem os arquivos-mestre, sem aproximação visual; nomes com acentos do português devem continuar legíveis.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — esta entrega não apresenta métricas nem dados para uma decisão operacional.
- **Forma:** _adiada ao plano de implementação_ — nome e foto são somente insumos locais da imagem; nenhum conteúdo pessoal entra em analytics.

## Dados da decisão (literais)

- ID reservado: `S13`
- Tipo: `feature`
- Rota canônica proposta: `/cards`
- Seleção de modelo na URL proposta: `model=eu-sou-solla` | `model=perfil-quadrado` | `model=perfil-retangular`
- Modelo `eu-sou-solla`: `Card com seu nome`
- Modelo `perfil-quadrado`: `Moldura quadrada`
- Modelo `perfil-retangular`: `Moldura vertical`
- Frase final do modelo `eu-sou-solla`: `#SOU <nome> TÔ COM SOLLA`
- Divergência resolvida no gate: o pedido inicial dizia `ESTOU COM SOLLA`; prevalece o `TÔ COM SOLLA` da arte-mestre.
- Eyebrow da home: `Faça parte`
- Título da home: `Mostre que você está com Solla`
- Corpo da home: `Escolha um modelo, coloque seu nome ou sua foto e baixe seu card. Compartilhe com sua gente e fortaleça nossa caminhada.`
- CTA da home: `Criar meu card`
- Título da página: `Crie seu card de apoio`
- Introdução da página: `Escolha um dos três modelos, personalize com seu nome ou sua foto e baixe para compartilhar.`
- Ações do compositor: `Criar meu card` | `Trocar foto` | `Cancelar`
- Resultado: `Seu card está pronto para compartilhar.`
- Ações do resultado: `Baixar meu card` | `Criar outro card`
- Aviso de privacidade: `Seu nome e sua foto são processados apenas no seu aparelho e não são enviados para nós.`
- Formato de saída: `PNG`
- Base vazia do nome: `/home/fsolla/Documentos/cards/eu-sou-solla/template-to-com-solla-site-sem-o-nome.jpg.jpeg` (`1080×1440`)
- Referência preenchida do nome: `/home/fsolla/Documentos/cards/eu-sou-solla/template-to-com-solla-site.jpg.jpeg` (`1080×1440`, exemplo `FULANO`)
- Máscara quadrada: `/home/fsolla/Documentos/cards/perfil-quadrado/card-solla-1080x1080-site.png` (`1000×1000`, RGBA)
- Máscara vertical: `/home/fsolla/Documentos/cards/perfil-retangular/card-solla-1080x1440-site.png` (`1000×1440`, RGBA)
- Fonte final do nome: `BREXTER-BREXTER-700.TTF` (direito de uso web confirmado no gate)
- Fonte excluída: `BREXTER-REGULAR DEMO.OTF`

## Direção no codebase (hipótese)

- **Áreas prováveis:** composição da home e nova rota no namespace `src/app/(frontend)`, componentes públicos próximos das seções de campanha, lógica pura de composição de imagem em `src/lib/` e assets estáticos da campanha.
- **Precedente a olhar:** `CampaignStorySection.tsx` e `CampaignNewsletterSection.tsx` para o convite; S1/S5/S6/S7 para cards e comportamento responsivo; overlays responsivos existentes apenas como referência de interação.
- **Risco de acoplamento:** duplicar o compositor entre home e página, transformar carrosséis específicos em uma abstração prematura ou reaproveitar o upload interno que persiste fotos.

## Dependências

- Nenhuma. O pacote original está disponível em `/home/fsolla/Documentos/cards/` e o direito de uso web da Brexter completa foi confirmado no gate.

## Fora de escopo

- Publicação direta ou integração com APIs de redes sociais.
- Galeria, histórico, conta, cadastro, upload ou persistência de nome, foto ou imagem gerada.
- Filtros, rotação, remoção de fundo, detecção de rosto, recorte livre, texto livre, cores e tipografia configuráveis.
- Novos modelos, gestão dos modelos pelo CMS e métricas de uso nesta primeira versão. Os arquivos `modelo-card-adesivaço-solla*` e `modelo-card-atividade-solla*` não entram nos três modelos iniciais.
- Alteração das artes-mestre ou redesenho das demais seções da home.

## Rabbit holes de produto

- **Editor de imagens completo.** Se alguém "só completar": aparecem filtros, recorte livre e controles tipográficos. **Corte neste item:** reposicionar e ampliar a foto dentro da área prevista.
- **Dois fluxos de criação.** Se alguém "só completar": a home ganha um compositor próprio e os comportamentos divergem. **Corte neste item:** `/cards` é a única superfície de edição.
- **Alteração das artes oficiais.** Se alguém "só completar": dimensões, marcas ou faixas são refeitas dentro do gerador. **Corte neste item:** compor sobre os arquivos-mestre sem redesenhá-los.
- **Compartilhamento direto.** Se alguém "só completar": cada rede traz API, permissão e fallback diferentes. **Corte neste item:** entregar um PNG para download.

## Questões em aberto (produto)

- **Qual frase vale no card de nome?** `#SOU <nome> TÔ COM SOLLA`; só o nome muda. _(decidido no gate — preservar a arte-mestre)_
- **Onde a seção entra na home?** Depois de `Receba as novidades da campanha` e antes do rodapé. _(decidido no gate — a captura continua sendo a primeira conversão)_
- **O que acontece ao tocar num modelo da home?** Navega para `/cards` com o modelo selecionado e abre o compositor ali. _(decidido no gate — um único editor)_
- **Como o catálogo se comporta no desktop?** Três modelos visíveis de uma vez; carrossel com um item e parte do próximo no mobile. _(decidido no gate)_
- **Como tratar nomes maiores que a área segura?** Reduzir e quebrar até o menor tamanho legível; acima desse limite, pedir um nome mais curto. Nunca cortar silenciosamente. _(decidido no gate)_
- **A campanha possui licença para incorporar a Brexter no site?** Sim, para `BREXTER-BREXTER-700.TTF`; o arquivo `DEMO` fica fora. _(confirmado no gate)_

## Referências

- GitHub Issue #941
- Rascunho UI (gate): `docs/plans/cards-personalizados-campanha-ui-draft.html`
- Artes originais: `/home/fsolla/Documentos/cards/` e arquivos listados em `Dados da decisão (literais)`
- `src/app/(frontend)/(home)/page.tsx` e `src/app/(frontend)/styles.css`
- `src/components/CampaignStorySection.tsx` e `src/app/(frontend)/(home)/CampaignNewsletterSection.tsx`
- `tests/e2e/frontend.e2e.spec.ts` e `tests/e2e/campaignNewsletter.e2e.spec.ts`
- `AGENTS.md` e `AGENTS-public.md`
