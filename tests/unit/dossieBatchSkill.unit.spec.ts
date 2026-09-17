import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// C186: pins the batch contract of the dossie-solla-cidade skill, the per-era
// fan-out and the researcher-only role of its subagent. The batch entry and the
// era briefing are prompt text, so the contract lives in the SKILL.md prose —
// this guard fails the build if the batch/resolver/receipt/serialization/era
// wording is dropped, or if the subagent regains the ssh/build pipeline.

const repoRoot = process.cwd()

const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8')

const skill = read('.agents/skills/dossie-solla-cidade/SKILL.md')
const researcher = read('.opencode/agent/dossie-solla-cidade.md')

describe('skill /dossie-solla-cidade documents the batch contract', () => {
  it('keeps the comma-separated batch entry and the single-city case', () => {
    expect(skill).toContain('## Lote (várias cidades)')
    expect(skill, 'batch example must be literal').toContain(
      '/dossie-solla-cidade Ilheus, Itacare, Una',
    )
    expect(skill, 'single-city must remain valid').toContain('/dossie-solla-cidade Ilheus')
    expect(skill, 'comma is the separator').toContain('vírgula')
    expect(skill, 'N=1 is the preserved path').toContain('N=1')
  })

  it('pins the canonical slug resolution and the ambiguity policy', () => {
    expect(skill).toContain('isMunicipalitySlug')
    expect(skill).toContain('resolveMunicipalityName')
    expect(skill, 'Salvador ambiguity must be explicit').toContain('salvador-ze-N')
    expect(skill, 'ambiguous token is an isolated failure').toContain('ambíguo')
  })

  it('documents the staged pipeline with a serialized extraction', () => {
    expect(skill).toContain('## Pipeline (etapas)')
    expect(skill).toContain('serializada')
    expect(skill, 'isolated failure must be visible as partial success').toContain(
      'sucesso parcial',
    )
    expect(skill, 'summary lists status per entry').toContain('(ok|failed)')
  })

  it('pins the per-era research fan-out and the concurrency guard', () => {
    expect(skill).toContain('## Briefing por era (A/B/C)')
    expect(skill, 'the three eras are the recorte').toContain('Era A')
    expect(skill, 'the three eras are the recorte').toContain('Era B')
    expect(skill, 'the three eras are the recorte').toContain('Era C')
    expect(skill, 'the fan-out must be bounded').toContain('MAX_RESEARCHERS_IN_FLIGHT')
  })

  it('documents the dossiê and the boletim outputs', () => {
    expect(skill).toContain('-dossie.pdf')
    expect(skill).toContain('-boletim.pdf')
    expect(skill, 'the boletim has no source list').toContain('Sem declaração de fontes')
  })
})

describe('finite researcher receipt (C186)', () => {
  it('declares the short receipt and its fields', () => {
    expect(skill).toContain('## Recibo do researcher')
    for (const field of ['itemCount', 'gapCount', 'newsCount', 'failureReason']) {
      expect(skill, `receipt must declare ${field}`).toContain(field)
    }
    expect(skill, 'receipt must never carry the body').toMatch(/corpo\s+do\s+`research\.json`/)
  })

  it('declares the per-era JSON contract', () => {
    expect(skill).toContain('## Contrato dos JSONs')
    expect(skill, 'era is required in the file').toContain('"era": "C"')
    for (const id of ['era_a_formacao', 'era_b_sesab', 'era_c_emendas']) {
      expect(skill, `checklist must list ${id}`).toContain(id)
    }
    expect(skill, 'region/polo is never summed').toMatch(/nunca\*?\*?\s*é\s+somado ao município/)
  })
})

describe('subagent .opencode/agent/dossie-solla-cidade.md is researcher-only', () => {
  it('stays a subagent that writes the era research.json and returns the receipt', () => {
    expect(researcher).toMatch(/^---\n[\s\S]*mode: subagent[\s\S]*\n---/)
    expect(researcher).toContain('researcher')
    expect(researcher).toContain('.c.research.json')
    expect(researcher).toContain('Recibo do researcher')
  })

  it('does not run the deterministic extract/build stages', () => {
    expect(researcher, 'researcher must not run the extractor CLI').not.toContain('--municipality=')
    expect(researcher, 'researcher must not run the builder CLI').not.toContain('--snapshot=')
  })
})
