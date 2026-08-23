# Débito — teste de steal do allocator dependente do cursor

Intenção: reescrita determinística do teste de steal em
`tests/int/campaignMunicipalityAllocator.int.spec.ts` — hoje o loop (até 120
claims) depende de o cursor compartilhado da sequência visitar o slot stale
dentro do limite; sob MUITA concorrência da suíte paralela a visita pode
demorar (P(miss) pequena mas > 0) e o teste falha por flake, não por
regressão. Fix: consultar o `index` do claim crashado (já disponível via
SQL na tabela `campaign_fixture_municipality_claims`) e dirigir o cursor até
ele (loop sobre `claimMunicipalityIndex` até retornar esse index — o
invariante de steal continua o mesmo: `claimCount(crashed) === 0`).
Aceite: spec do allocator estável sob suíte int completa (re-runs).
