# Site público pós-eleição — retirar a propaganda e agradecer os 152.049 votos (S47)

Status: rascunho
Atualizado em: 2026-10-21
Issue: #1442
Priority: P1
Impeccable: C — novo fluxo na home (hero de agradecimento + retirada das seções de campanha)
Design UI: docs/plans/site-pos-eleicao-agradecimento-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável (nenhuma propaganda/1313 visível no site público + agradecimento no ar)
Responsável: —

## Intenção

A eleição para deputado federal terminou em 04/10/2026 e Jorge Solla foi reeleito com 152.049 votos. O site público ainda é uma peça de campanha: hero de candidato, pedido de voto, "1313" em títulos/rodapé/metadados, CTAs de apoio e páginas de material eleitoral. Manter isso no ar depois da eleição confunde o visitante, desatualiza a identidade do mandato e mantém propaganda eleitoral ativa sem campanha. O site precisa virar a casa institucional do deputado: agradecer os votos e seguir publicando o mandato (notícias, fotos, trajetória, bandeiras), sem pedir voto e sem o número 1313.

## Persona e fluxo

- **Persona / contexto:** eleitor que chega pelo link compartilhado/WhatsApp, jornalista que busca o mandato, apoiador que quer acompanhar o trabalho — no celular, logo depois da eleição.
- **Job principal:** entender que a eleição acabou, sentir-se agradecido e encontrar o conteúdo do mandato.
- **Fluxo desejado:** abre o site → vê "Obrigado, Bahia — 152.049 votos" e um texto curto de agradecimento → rola para as notícias/"Acompanhe de perto", a trajetória, as bandeiras e as fotos → encontra o rodapé institucional e as redes.
- **Anti-goals de produto:** não é uma nova campanha; não é um site institucional completo (bio/propostas é PUB2); não cria cadastro de pessoa novo; não vira dashboard de resultados; não apaga o acervo editorial.

### Esboço de fluxo (C)

```text
[chega] → hero "Obrigado, Bahia" (152.049) → notícias → trajetória → bandeiras do mandato → fotos → rodapé institucional
```

### Design UI (C)

- Design UI (gate): `docs/plans/site-pos-eleicao-agradecimento-ui-design.html` (+ assets em `site-pos-eleicao-agradecimento-ui-design-assets/`)
- Cenas: 1280 e 390; estados: home completa, hero de agradecimento, rodapé. NEEDS ASSET para foto nova se o design pedir; usar `JOA00162.webp` como padrão.

## Objetivo e aceite

- Nenhuma superfície pública exibe "1313" como número eleitoral, pedido de voto, "candidato", "propaganda eleitoral" ou CTA de campanha (hero, cards, rodapé, títulos/metadados).
- A home abre com o agradecimento: "152.049 votos" (literal TSE) e texto de agradecimento a quem votou e a quem ajudou na campanha.
- A identidade visível passa a "Jorge Solla — Deputado Federal · PT · Bahia"; o logo usado é o lockup de nome (`jorge-solla-positivo/negativo`), nunca a marca completa com 1313.
- As seções de campanha saem da home: "Por que essa eleição importa", newsletter "da campanha", cards "Mostre que você está com Solla", jingles/rádio 1313 e a seção da Central de Conteúdos.
- As páginas de campanha (`/conteudos`, `/jingles`, `/cards`) saem do ar/do menu; `/fotos`, `/artigos`, `/privacidade` e o acervo de fala continuam. `/potencial` e a Plenária ficam até 25/10 (2º turno) e saem depois — decisão a confirmar no gate.
- O rodapé vira institucional: nome, cargo, partido/estado, redes, artigos, fotos, privacidade; sem "Quero apoiar", sem CNPJ de campanha, sem "1º turno".
- Metadados/SEO: títulos e descrições sem 1313; a URL canônica continua a atual até o cutover (OPS131).
- Nada de PII nova, nenhum Consent novo, nenhuma migration.
- O design hi-fi aprovado é o alvo do port.

Guardrails:

- Não apagar posts/fotos/jingles do CMS; despublicar/retirar da navegação é suficiente (reversível).
- A página do abaixo-assinado (S48) não é tocada aqui.
- O domínio não muda aqui (OPS131).

## Dados (intenção)

- **Vou apresentar dados?** Sim, na superfície: o número de votos no agradecimento.
- **Decisões desbloqueadas:** o visitante entende o resultado e o novo papel do site; a equipe decide o que continua público no mandato.
- **Forma:** número absoluto, sem percentual estadual; o dado é o total de votos, não um ranking. Fonte TSE/G1 (05/10/2026).

## Dados da decisão (literais)

- Votos: **152.049** (TSE, totalização de 05/10/2026; 1,84% dos válidos; 11º mais votado da BA; 417 municípios; Salvador 26.082).
- Mandato: **4º mandato consecutivo** (reeleito em 2026; posse em 01/02/2027).
- Copy do hero (proposta): eyebrow `Obrigado, Bahia`; título `152.049 votos de confiança`; texto `Obrigado a quem votou, a quem caminhou, a quem compartilhou e a quem acreditou. A eleição terminou; o trabalho continua.`; CTA primário `Acompanhe o mandato` → `/artigos`.
- Identidade: `Jorge Solla` · `Deputado Federal` · `PT · Bahia`; o slogan `Mais Saúde, Mais Futuro` pode permanecer como assinatura (não é número/pedido de voto).
- Seções que saem: `problem` (`Por que essa eleição importa`), `cards`, `sound` (jingles/rádio), `contentPieces` (Central), newsletter de campanha; `story` e `flags` ficam com copy de mandato; `content` (Acompanhe de perto), `fotos` e `selfie` ficam.
- Rotas de campanha: `/conteudos`, `/jingles`, `/cards` → fora do ar (404 ou redirect para `/`, decisão do impl plan); `/potencial` e share link `plenaria-vitoria` → até 25/10.
- Arquivos com literais 1313 a limpar: `CampaignHero.tsx`, `CampaignFooter.tsx`, `CampaignPageHeader.tsx`, `CampaignLogoLink.tsx`, `JingleHomeSection.tsx`, `RadioPlayer.tsx`, `ContentPiece*`, `fotos/page.tsx`, `fotos/encontre/page.tsx`, `conteudos/*`, `jingles/page.tsx`, `(home)/page.tsx`, `SITE_METADATA_DEFAULTS` (description "campanhas" → "mandato").
- Download de foto: `jorge-solla-foto-<id>.<ext>` (sem 1313).
- O `1313` em assets do kit (`numero-*`, `marca-*-completa`, `radio/*`) pode permanecer no repositório como acervo, mas nenhum deles é renderizado em superfície pública.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(frontend)/(home)/page.tsx`, `src/components/CampaignHero.tsx`, `CampaignFooter.tsx`, `CampaignPageHeader.tsx`, `CampaignLogoLink.tsx`, `JingleHomeSection.tsx`, `ContentPiece*`, `src/app/(frontend)/fotos/page.tsx`, `conteudos/*`, `jingles/page.tsx`, `src/utilities/seo.ts`/global `metadata`.
- **Precedente a olhar:** S36 (crop do logo), S21/S22 (jingles), S27/S39 (Central), C233 (fotos), `DESIGN.md` §7 e `public/campaign-kit/README.md`.
- **Risco de acoplamento:** `CampaignFooter` é compartilhado por `/fotos`, `/jingles`, `/potencial`, `/cards`, `/conteudos` — a mudança de assinatura afeta todas; `CampaignLogoLink` é o dono do crop do logo; `isPostVisible`/posts não podem ser tocados por engano.

## Dependências

- Nenhuma dura. Suave: S48 (abaixo-assinado) para o CTA de participação, se o gate quiser; OPS130 para o acervo completo de artigos.

## Fora de escopo

- Bio/propostas institucionais novas (PUB2).
- Cutover do domínio (OPS131).
- Conteúdo do abaixo-assinado (S48) e sincronização de artigos (OPS130).
- Apagar dados do CMS ou do acervo de fotos.
- Redesenho de todas as páginas internas do mandato.

## Rabbit holes de produto

- **"Vamos aproveitar e redesenhar o site inteiro."** Vira um projeto institucional. **Corte:** só a home/shell + retirada das campanhas; o resto é PUB2.
- **"Apagar todos os posts de campanha."** Perde histórico e notícia. **Corte:** retirar a propaganda de campanha das superfícies; o acervo editorial fica.
- **"Criar uma nova marca."** O kit 1313 não tem marca de mandato sem o número. **Corte:** usar os lockups de nome existentes; NEEDS ASSET se o humano quiser marca nova.

## Questões em aberto (produto)

- **O que fazer com o 2º turno (Lula) que ainda está no ar?** **Opções:** A) manter `/potencial` e a Plenária até 25/10 e retirar depois; B) retirar tudo agora. **Recomendação:** A — o 2º turno ainda não acabou; o corte imediato é o de Solla/1313. _(assumido — validar no gate)_
- **Manter a seção "Bandeiras"?** **Opções:** A) manter, reescrita como bandeiras do mandato; B) remover junto com o bloco "Por que essa eleição importa". **Recomendação:** A — é conteúdo de posição, não pedido de voto; a copy eleitoral sai. _(assumido)_
- **Newsletter:** **Opções:** A) remover a captura de campanha (sem novo Consent); B) manter com copy de mandato. **Recomendação:** A — evita mudar a finalidade do consentimento sem revisão. _(assumido)_
- **Central/Jingles/Cards:** **Opções:** A) despublicar e tirar do ar; B) manter internos. **Recomendação:** A — são material de campanha; o CMS continua com os registros. _(assumido)_

## Referências

- GitHub Issue #1442
- Design UI (gate): `docs/plans/site-pos-eleicao-agradecimento-ui-design.html`
- TSE/G1: `https://g1.globo.com/ba/bahia/eleicoes/2026/noticia/2026/10/05/eleicoes-2026-jorge-solla-pt-e-eleito-deputado-federal-pela-bahia.ghtml` (152.049 votos, 1,84%, 11º, 417 municípios, Salvador 26.082)
- `AGENTS-public.md` (Posts & Tags), `AGENTS.md` (campaign/public), `DESIGN.md` §7, `public/campaign-kit/README.md`
- `src/app/(frontend)/(home)/page.tsx`, `src/components/CampaignFooter.tsx`, `src/components/CampaignHero.tsx`
