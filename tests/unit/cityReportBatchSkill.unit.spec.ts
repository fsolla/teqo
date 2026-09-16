import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// OPS118: pins the batch contract of the relatorio-cidade skill and the
// researcher-only role of its subagent. The batch entry is prompt text (a
// comma-separated argument), so the contract lives in the SKILL.md prose — this
// guard fails the build if the batch/resolver/receipt/serialization wording is
// dropped, or if the subagent regains the ssh/build pipeline.

const repoRoot = process.cwd()

const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8')

const skill = read('.agents/skills/relatorio-cidade/SKILL.md')
const researcher = read('.opencode/agent/relatorio-cidade.md')

describe('skill /relatorio-cidade documents the batch contract', () => {
  it('keeps the comma-separated batch entry and the single-city case', () => {
    expect(skill).toContain('## Lote (várias cidades)')
    expect(skill, 'batch example must be literal').toContain(
      '/relatorio-cidade Ilheus, Itacare, Una',
    )
    expect(skill, 'single-city must remain valid').toContain('/relatorio-cidade Feira de Santana')
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
})

describe('finite researcher receipt (OPS118)', () => {
  it('declares the short receipt and its fields', () => {
    expect(skill).toContain('## Recibo do researcher')
    for (const field of [
      'itemCount',
      'gapCount',
      'newsCount90d',
      'weakSourceCount',
      'failureReason',
    ]) {
      expect(skill, `receipt must declare ${field}`).toContain(field)
    }
    expect(skill, 'receipt must never carry the body').toContain('corpo do `research.json`')
  })
})

describe('subagent .opencode/agent/relatorio-cidade.md is researcher-only', () => {
  it('stays a subagent that writes research.json and returns the receipt', () => {
    expect(researcher).toMatch(/^---\n[\s\S]*mode: subagent[\s\S]*\n---/)
    expect(researcher).toContain('researcher')
    expect(researcher).toContain('research.json')
    expect(researcher).toContain('Recibo do researcher')
  })

  it('does not run the deterministic extract/build stages', () => {
    expect(researcher, 'researcher must not run the extractor CLI').not.toContain('--municipality=')
    expect(researcher, 'researcher must not run the builder CLI').not.toContain('--snapshot=')
  })
})
