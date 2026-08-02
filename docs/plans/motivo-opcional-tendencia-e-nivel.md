# Motivo opcional — tendência (wizard) e nível de envolvimento

Status: registrado
Atualizado em: 2026-08-02
Issue: #288
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe em controles staff já existentes (passo de nota do wizard de tendência + Popover de nível)
Appetite: ~1 dia eng; mesma regra de produto + simplificação do modelo de nível
Responsável: —

## Intenção

Dois rituais de leitura/alocação do município pedem texto demais antes de gravar:

1. **Wizard de ações → Mudar tendência** — “Por que mudar a tendência?” obrigatório.
2. **Nível de envolvimento (E14)** — Popover exige **Motivo** e um segundo campo **“O que faria voltar atrás”**.

Pedido de produto:

- **Motivo deixa de ser portão** nos dois (campo permanece, opcional).
- No nível, **remover completamente** “O que faria voltar atrás” do modelo — Motivo basta se a pessoa quiser registrar contexto (incluindo o que faria reavaliar).

Revisa **B64 ✓** (nota obrigatória na tendência) e **E14 ✓** (rito com motivo + sinais de reversão).

## Persona e fluxo

- **Persona / contexto:** CG/Candidato no nível; CG/Assessor na tendência — varredura no polegar ou na lista.
- **Job principal:** gravar nova tendência ou novo nível **sem formulário mínimo de dois textos**.
- **Fluxo desejado:**
  - Tendência: escolhe tile → motivo opcional → Salvar (vazio OK).
  - Nível: escolhe Ni → **só Motivo (opcional)** → Confirmar. Sem segundo campo de reversão.
- **Anti-goals de produto:** não remover Motivo; não auto-salvar ao tocar tile/select; não abrir escrita de nível para `leader`/assessor; não reintroduzir “sinais de reversão” sob outro nome.

### Esboço de fluxo (B)

```text
Tendência (wizard):
  [Escolher tendência] → [Por que mudar? — opcional] → [Salvar] → destino atual

Nível (lista/detalhe):
  [Abrir nível] → [Escolher Ni] → [Motivo opcional] → [Confirmar]
  (histerese / override / choque triangulado: intactos)
```

## Objetivo e aceite

- **Tendência:** Salvar com motivo vazio grava a nova tendência.
- **Nível:** confirmar movimento com Motivo vazio grava o novo nível.
- Motivo preenchido continua sendo gravado nos dois.
- **Nível:** o campo/conceito “O que faria voltar atrás” **some da UI, do modelo de escrita e do banco**; Motivo é o único texto livre do rito. Dados já gravados desse campo são removidos (não ficam “órfãos” só ilegíveis).
- Histerese, choque triangulado, override e registro de decisão de alocação **permanecem** (só muda o que se exige/coleta de texto).
- Prefill / Limpar / Pular no wizard de tendência inalterados em significado.
- Liderança continua sem ver/editar esses campos.

## Dados (intenção)

- **Vou apresentar dados?** Não (classificações já existentes; este item muda portão de escrita e o shape do rito de nível).
- **Decisões desbloqueadas:** staff registra tendência/nível sem articular o porquê; se quiser contexto (inclusive “quando reavaliar”), usa Motivo.
- **Forma:** *adiada ao plano de implementação*.
- **Persistência:** “O que faria voltar atrás” / sinais de reversão **saem do modelo persistido** — apagar do banco (campo/dado nas decisões de nível já gravadas), não só esconder na UI. Motivo (`levelNote` / texto do movimento) permanece como único texto livre opcional.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - Tendência: passo de nota do wizard + write path de tendência (nota já anulável no schema).
  - Nível: Popover de nível; validação/entrada do movimento; snapshot da decisão de alocação que hoje carrega sinais de reversão; glossário/verbete se citar o campo.
- **Precedente a olhar:** [wizard-mudar-tendencia.md](wizard-mudar-tendencia.md) (**B64 ✓**); [niveis-de-envolvimento.md](niveis-de-envolvimento.md) (**E14 ✓**).
- **Risco de acoplamento:** quem pode mover nível (`coordinator`/`candidate`); não reabrir fila E9 / motor E11; não misturar com tendência política.

## Dependências

- Nenhuma dura. Soft: **B64 ✓**, **E14 ✓**, **B97 ✓** / **B98 ✓**.

## Fora de escopo

- Remover Motivo; auto-save no nível; gravar tendência ao tocar o tile.
- Mudar quem move nível; redesign N0–N4; fila E9 / E11.
- Wizard A7 “Definir nível” no Início.
- Copy longa dos Drawers de tendência.

## Rabbit holes de produto

- **Substituir “voltar atrás” por outro campo obrigatório** (“próxima revisão”, checklist). **Corte:** Motivo opcional é suficiente.
- **Soltar histerese/override junto.** **Corte:** regras de movimento ficam; só texto livre enxuga.

## Questões em aberto (produto)

- **Copy do Motivo?** **Opções:** A labels atuais | B + “(opcional)”. **Recomendação:** B nos dois. _(assumido — validar)_
- **Motivo vazio no save: apaga nota anterior ou preserva?** **Opções:** A grava vazio/`null` | B preserva se vazio. **Recomendação:** A. _(assumido — validar)_
- **Dados antigos de sinais de reversão?** **Decidido:** apagar do DB (não preservar histórico desse campo). Forma técnica (coluna vs chave no snapshot JSON, etc.) fica no plano de implementação.

## Referências

- GitHub Issue #288
- Wizard de tendência · Popover de nível · planos B64 / E14
- `PRODUCT.md` — Feel the action / ritual curto
