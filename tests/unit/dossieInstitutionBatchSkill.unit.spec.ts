import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// C187: pins the batch contract of the dossie-solla-instituicao skill, the
// per-era fan-out and the researcher-only role of its subagent. The batch entry
// and the era briefing are prompt text, so the contract lives in the SKILL.md
// prose — this guard fails the build if the batch/resolver/receipt/fail-closed
// wording is dropped, or if the subagent regains the extract/build pipeline.

const repoRoot = process.cwd()

const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8')

const skill = read('.agents/skills/dossie-solla-instituicao/SKILL.md')
const researcher = read('.opencode/agent/dossie-solla-instituicao.md')
const writer = read('.opencode/agent/dossie-solla-instituicao-redacao.md')

describe('skill /dossie-solla-instituicao documents the batch contract', () => {
  it('keeps the comma-separated batch entry and the single-institution case', () => {
    expect(skill).toContain('## Lote (várias instituições)')
    expect(skill, 'batch example must be literal').toContain(
      '/dossie-solla-instituicao UFBA, Correios',
    )
    expect(skill, 'single-institution must remain valid').toContain(
      '/dossie-solla-instituicao UFBA',
    )
    expect(skill, 'comma is the separator').toContain('vírgula')
    expect(skill, 'N=1 is the preserved path').toContain('N=1')
  })

  it('pins the fail-closed catalog resolution and the one-off escape', () => {
    expect(skill).toContain('isInstitutionSlug')
    expect(skill).toContain('resolveInstitutionName')
    expect(skill, 'unknown token must fail closed').toContain('falha fechado')
    expect(skill, 'must never invent a slug').toContain('nunca')
    expect(skill, 'the one-off escape must be documented').toContain('--slug=<x> --name="<Nome>"')
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

describe('finite researcher receipt (C187)', () => {
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
    expect(skill, 'the unit slug field is institutionSlug').toContain('"institutionSlug": "ufba"')
    for (const id of ['era_a_vinculo', 'era_b_convenios', 'era_c_parcerias']) {
      expect(skill, `checklist must list ${id}`).toContain(id)
    }
    expect(skill, 'setor/rede is never summed').toMatch(/nunca\s+(\*\*)?são?\s+somados/)
  })
})

describe('subagent .opencode/agent/dossie-solla-instituicao.md is researcher-only', () => {
  it('stays a subagent that writes the era research.json and returns the receipt', () => {
    expect(researcher).toMatch(/^---\n[\s\S]*mode: subagent[\s\S]*\n---/)
    expect(researcher).toContain('researcher')
    expect(researcher).toContain('.c.research.json')
    expect(researcher).toContain('Recibo do researcher')
  })

  it('does not run the deterministic extract/build stages', () => {
    expect(researcher, 'researcher must not run the extractor CLI').not.toContain('--institution=')
    expect(researcher, 'researcher must not run the builder CLI').not.toContain('--snapshot=')
  })

  it('leaves the narrative to the redator step', () => {
    expect(researcher, 'the researcher does not write the narrative file').not.toContain(
      'narrative.json',
    )
    expect(researcher).toContain('redator')
  })
})

describe('dossiê institucional sem caps + redação (revisão 2026-09-18)', () => {
  it('documents the flowing sheets and the measured packing', () => {
    expect(skill, 'no caps in the institution dossiê').toContain('não usa caps')
    expect(skill).toContain('grow/shrink')
    expect(skill).toContain('dossiePack.mjs')
    expect(skill, 'continuation sheets carry the header').toContain('continuação N')
  })

  it('documents the opening letter, the synthesis and the charts', () => {
    expect(skill).toContain('A contribuição (carta)')
    expect(skill).toContain('**Síntese**')
    expect(skill).toContain('Gráficos consolidados')
    expect(skill, 'the era opens with a consolidation paragraph').toMatch(
      /O que esta era\s+entrega/,
    )
  })

  it('pins the narrative contract and the writer receipt', () => {
    expect(skill).toContain('## Recibo do redator')
    expect(skill).toContain('"institutionSlug": "ufba"')
    expect(skill, 'the narrative file carries the era paragraphs').toContain('"eras": {')
    expect(skill, 'the orchestrator audits the citations').toMatch(/audita/i)
  })
})

describe('subagent .opencode/agent/dossie-solla-instituicao-redacao.md is writer-only', () => {
  it('stays a subagent that writes the narrative and returns the receipt', () => {
    expect(writer).toMatch(/^---\n[\s\S]*mode: subagent[\s\S]*\n---/)
    expect(writer).toContain('narrative.json')
    expect(writer).toContain('Recibo do redator')
  })

  it('does not run the deterministic extract/build stages', () => {
    expect(writer, 'writer must not run the extractor CLI').not.toContain('--institution=')
    expect(writer, 'writer must not run the builder CLI').not.toContain('--snapshot=')
    expect(writer, 'writer must not edit the research files').toMatch(/não\*\* edite os/)
  })
})

describe('briefing de capacitação como 3º entregável (C210)', () => {
  it('points at the briefing skill, its build and the third output', () => {
    expect(skill).toContain('## Briefing de capacitação (3º entregável, C210)')
    expect(skill).toContain('.agents/skills/briefing-capacitacao-solla/SKILL.md')
    expect(skill).toContain('scripts/build-dossie-solla-briefing.mjs')
    expect(skill).toContain('-briefing.pdf')
    expect(skill).toContain('-briefing.md')
  })

  it('pins the handout guardrails inherited from the briefing skill', () => {
    expect(skill).toContain('Insumo interno de capacitação — não publicar')
    expect(skill).toMatch(/até 4 páginas/i)
    expect(skill).toMatch(/sem segunda pesquisa factual/i)
  })
})
