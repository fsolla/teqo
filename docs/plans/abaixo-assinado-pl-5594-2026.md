# Abaixo-assinado do PL 5594/2026 — transparência dos presidenciáveis (S48)

Status: rascunho
Atualizado em: 2026-10-21
Issue: #1443
Priority: P1
Impeccable: A — sem UI nova; usa a página existente de abaixo-assinado (copy do template ajustada)
Design UI: N/A — sem UI nova
Appetite: ~0,5 dia eng; um outcome verificável (petição publicada, assinável e compartilhável)
Responsável: —

## Intenção

Jorge Solla protocolou o PL 5594/2026 em 19/10/2026: candidatos à Presidência e à Vice-Presidência passam a ter de autorizar, no registro da candidatura, o acesso a seus sigilos bancário, fiscal, telefônico e de internet. O tema está no centro do debate desde 18/10, quando Lula desafiou Flávio Bolsonaro a abrir os sigilos. O Teqo já tem a ferramenta de abaixo-assinado; falta a petição do PL — com o texto oficial, a motivação e um pedido claro de tramitação/aprovação.

## Persona e fluxo

- **Persona / contexto:** eleitor que acompanhou o debate e quer cobrar transparência; chega pelo link no WhatsApp/redes, no celular.
- **Job principal:** entender o que o PL faz, por que importa agora e assinar em menos de um minuto.
- **Fluxo desejado:** abre `/abaixo-assinado/pl-5594-2026` → lê o resumo e a motivação → vê o contador → preenche nome/e-mail/celular/estado/cidade/CEP → assina → vê a confirmação e compartilha.
- **Anti-goals de produto:** não é um novo cadastro de pessoa (usa `Contact`); não acusa ninguém de crime; não promete aprovação; não cria um segundo mecanismo de consentimento.

## Objetivo e aceite

- A petição `pl-5594-2026` existe, está `enabled`, com título/subtítulo/corpo/consent e página pública em `/abaixo-assinado/pl-5594-2026` (200).
- O corpo explica, com o texto oficial: autorização no registro; 5 anos de IR; dados bancários/fiscais/telefônicos/de conexão; conteúdo das comunicações excluído; acesso só por órgãos competentes com auditoria; LGPD; divulgação pela Justiça Eleitoral.
- A motivação menciona o debate de 18/10 e o desafio de Lula a Flávio Bolsonaro, sem afirmar crime ou irregularidade.
- O formulário assina de verdade (contato + assinatura + inscrição na mesma transação, padrão existente), com consent válido e contador.
- A página tem canonical/OG/JSON-LD coerentes com o site atual e link para o texto oficial na Câmara.
- Nenhuma migration, nenhuma collection nova, nenhuma PII em log.

## Dados (intenção)

- **Vou apresentar dados?** Sim, o contador de assinaturas (já existente).
- **Decisões desbloqueadas:** o visitante decide assinar; a equipe mede adesão.
- **Forma:** contador absoluto; sem percentual, sem ranking, sem meta inventada.

## Dados da decisão (literais)

- `id` da petição: `pl-5594-2026` (URL `/abaixo-assinado/pl-5594-2026`).
- Título: `Quem quer ser presidente deve abrir os sigilos`.
- Subtítulo: `Apoie o PL 5594/2026: candidatos à Presidência e à Vice-Presidência devem autorizar o acesso aos sigilos bancário, fiscal, telefônico e de internet.`
- PL: **5594/2026**, apresentado em **19/10/2026**, autor **Dep. Jorge Solla (PT/BA)**; ementa oficial: "Dispõe sobre a transparência patrimonial, fiscal e financeira dos candidatos à Presidência da República, estabelece mecanismos de autorização de acesso a informações protegidas por sigilo e altera a Lei nº 9.504, de 30 de setembro de 1997."
- Ficha oficial: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2648344`; inteiro teor: `https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=3184912`.
- Status em 21/10/2026: apenas apresentação na Mesa, sem tramitação posterior.
- Consent: usar o mesmo Consent das 3 petições existentes (`form.consent` id 2, chave `whatsapp-inscricao`), como está em produção; não criar Consent novo sem revisão jurídica.
- Copy do formulário (ajustar o hardcoded "campanha"): `Sua assinatura fortalece esta mobilização.` / `Os dados serão usados para registrar sua participação e a comunicação de conteúdos relacionados.`
- Motivação: debate de **18/10/2026**, Lula desafiou Flávio Bolsonaro a abrir os sigilos; Solla protocolou o PL no dia seguinte. Não afirmar que houve crime, ilícito ou recusa não comprovada.
- Texto do corpo: 5 blocos — (1) o que é; (2) por que agora; (3) o que o PL não faz; (4) o pedido; (5) link oficial.

## Direção no codebase (hipótese)

- **Áreas prováveis:** collection `petition` (admin), página `src/app/(frontend)/abaixo-assinado/[id]/page.tsx`, `PetitionForm`, `submitPetitionSignature`, `getSignatureCount`; conteúdo criado no admin (sem código novo, salvo o ajuste de copy do template).
- **Precedente a olhar:** petições `fim-escala-6x1`, `contra-reducao-maioridade-penal`, `nao-a-privatizacao-da-orla-de-salvador` (produção); o fluxo de Consent das petições existentes.
- **Risco de acoplamento:** o `id` é a URL pública; trocar depois quebra links. O consent é o do documento; o cliente não pode escolher. A action já abre transação.

## Dependências

- Nenhuma dura. Suave: S47 (se o gate quiser um CTA na home/footer para a petição).

## Fora de escopo

- Página de listagem de abaixo-assinados.
- Meta de assinaturas, campos novos, upload de imagem/mídia.
- Nova identidade visual da petição.
- Divulgação paga/WhatsApp em massa.
- Alterar o texto do Consent existente.

## Rabbit holes de produto

- **"Vamos fazer uma campanha de mídia junto."** Vira operação de tráfego. **Corte:** só a página + link direto.
- **"Criar um consent específico e uma nova finalidade."** Exige revisão jurídica. **Corte:** reutilizar o Consent das petições existentes.
- **"Prometer que o PL será aprovado."** **Corte:** pedir apoio à tramitação, sem promessa.

## Questões em aberto (produto)

- **Usar o Consent existente (id 2) ou criar um novo?** **Opções:** A) reutilizar (padrão das 3 petições); B) novo texto. **Recomendação:** A — mantém o fluxo e evita mudança jurídica; se o texto não cobrir a finalidade, o jurídico decide. _(assumido)_
- **Adicionar CTA na home/footer?** **Opções:** A) só link direto agora; B) CTA na home (depende de S47). **Recomendação:** A — a página é compartilhável; o CTA entra quando o design da S47 for aprovado. _(assumido)_
- **Imagem/OG?** **Opções:** A) sem imagem nova (OG do site); B) arte oficial do kit. **Recomendação:** A — não inventar arte; o texto oficial é o herói.

## Referências

- GitHub Issue #1443
- Texto oficial: `https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=3184912`
- Ficha: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2648344`
- Votação de Solla: TSE/G1, totalização de 05/10/2026
- Cobertura do PL e do debate: BPMoney (21/10/2026), A Tarde (20/10/2026), Brasil 247 (21/10/2026)
- `AGENTS-public.md` (Posts & Tags), `AGENTS.md` (Consent/LGPD), `src/collections/Petition.ts`, `src/app/(frontend)/abaixo-assinado/[id]/page.tsx`, `src/app/(frontend)/actions/submitPetitionSignature.ts`
