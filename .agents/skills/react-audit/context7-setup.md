# Context7 MCP — setup manual do dono da máquina

O Context7 dá acesso à documentação oficial vigente de React/Next.js dentro das sessões
do opencode (evita fix contra API desatualizada). É **config global da máquina, fora do
git** (precedente OPS89/OPS92) — o repo NÃO declara esse MCP. Sem ele, a skill
`react-audit` funciona igual usando as fontes oficiais embutidas em `anti-patterns.md`.

## Declarar globalmente (uma vez, por máquina)

Edite `~/.config/opencode/opencode.jsonc` e adicione ao bloco `"mcp"` existente
(mesmo shape do MCP `jina` que já vive lá):

```jsonc
{
  "mcp": {
    // ...mcp existentes...
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp",
      "enabled": true
    }
  }
}
```

Valide antes de confiar:

```bash
opencode debug config   # o bloco context7 aparece resolvido, sem erro de schema
```

## Uso na skill

- O executor consulta a doc oficial vigente ANTES de classificar/fixar (Passo 1 e Passo 3).
- Se o MCP não estiver disponível ou falhar: siga com as URLs de
  `anti-patterns.md`, cite-as no relatório e marque o achado como "fonte conferida por URL".
- Nunca bloqueie uma run por falta do Context7 — é aceleração, não requisito.
