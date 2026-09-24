import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// C218 — pins the incremental catalog skill contract: the single new state
// file (watermark + pending + review), the dated discovery artifact written by
// the subagent, the batch handoff to the C215 ingestion CLI, the curation
// modes and the receipt. The whole flow is prompt text (SKILL.md + agent), so
// this guard fails the build if a contract literal is dropped or if the
// subagent regains the ingestion/download role it must not have.

const repoRoot = process.cwd()

const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8')

const skill = read('.agents/skills/catalogo-falas-web/SKILL.md')
const agent = read('.opencode/agent/catalogo-falas-web.md')

describe('command /catalogo-falas-web couples to the canonical skill', () => {
  it('ships the thin wrapper pointing at the SKILL.md', () => {
    const command = read('.opencode/commands/catalogo-falas-web.md')
    expect(existsSync(resolve(repoRoot, '.agents/skills/catalogo-falas-web/SKILL.md'))).toBe(true)
    expect(command).toContain('`catalogo-falas-web`')
    expect(command).toContain('$ARGUMENTS')
    expect(command).toContain('.agents/skills/catalogo-falas-web/SKILL.md')
    expect(command).toMatch(/^description: .+$/m)
    expect(command).not.toMatch(/^\s*["']?model["']?\s*:/m)
  })
})

describe('skill /catalogo-falas-web documents the incremental pipeline', () => {
  it('pins the single new state file and its fail-closed read', () => {
    expect(skill).toContain('## Contrato do estado')
    expect(skill).toContain('data/falas-web/last-run.json')
    for (const field of ['lastRunAt', 'lastStateAt', 'pending', 'review']) {
      expect(skill, `state contract must carry ${field}`).toContain(field)
    }
    expect(skill, 'the watermark is the discovery window end').toMatch(
      /`lastRunAt` é o `window\.to` da descoberta/,
    )
    expect(skill, 'state lives in a gitignored path').toContain('gitignored')
    expect(skill, 'state write must be atomic').toMatch(/escrita atômica/i)
    expect(skill, 'corrupt state stops the run').toMatch(/fail-closed/)
  })

  it('pins the dated discovery artifact written by the one writer', () => {
    expect(skill).toContain('## Contrato do artefato de descoberta')
    expect(skill).toContain('data/falas-web/discovery-<stamp>.json')
    for (const field of ['generatedAt', 'window', 'queries', 'findings', 'review', 'notes']) {
      expect(skill, `artifact contract must carry ${field}`).toContain(field)
    }
    expect(skill, 'initial scan runs without a watermark').toContain('varredura inicial')
    expect(skill, 'failed discovery writes no partial artifact').toMatch(
      /não escreve artefato parcial/,
    )
  })

  it('hands the batch to the C215 ingestion CLI and reads its report', () => {
    expect(skill).toContain('pnpm falas-web:import --findings')
    expect(skill, 'the batch carries the exact C215 envelope').toContain(
      '{ generatedAt, findings }',
    )
    expect(skill, 'the batch is the handoff artifact').toContain('batch-<stamp>.json')
    expect(skill, 'planning runs read-only first').toContain('Planejar (obrigatório)')
    expect(skill, 'planning runs read-only first').toContain('--dry-run')
    expect(skill, 'the report is the source of the receipt').toContain('data/falas-web/reports/')
    expect(skill, 'invalid/duplicates stop the ingestion').toMatch(/invalid > 0/)
    expect(skill, 'invalid/duplicates stop the ingestion').toMatch(/duplicates > 0/)
    expect(skill, 'invalid/duplicates keep the watermark').toMatch(/não avance o watermark/)
    expect(skill, 'empty batch skips the CLI').toMatch(/pule o CLI/)
  })
})

describe('curation, watermark and retry', () => {
  it('documents the review modes without discovery or ingestion side effects', () => {
    for (const mode of ['revisar', 'aprovar', 'descartar']) {
      expect(skill, `mode ${mode} must be documented`).toContain(mode)
    }
    expect(skill, 'doubtful findings are not ingested before confirmation').toMatch(
      /não é ingerido até confirmação/,
    )
    expect(skill, 'curation demotes to the state review list').toMatch(/não inclua\s+no lote/)
    expect(skill, 'approval does not move the watermark').toMatch(/`lastRunAt` \*\*não\*\* muda/)
  })

  it('pins the watermark semantics and the pending retry', () => {
    expect(skill).toContain('Exit 0')
    expect(skill).toContain('Exit 1')
    expect(skill, 'exit 1 must not advance the window').toMatch(/`lastRunAt` \*\*não\*\* avança/)
    expect(skill, 'retries carry the attempt count').toContain('attempts')
    expect(skill, 'pending is retried first').toMatch(/vão primeiro no próximo lote/)
    expect(skill, 'the --limit tail stays in the batch').toMatch(/restam M−N achados no lote/)
  })

  it('pins the literal receipt', () => {
    expect(skill).toContain('## Recibo (literal)')
    expect(skill).toContain('[catalogo-falas-web] período:')
    for (const field of ['achados:', 'novos:', 'ignorados:', 'falhas:', 'custo/tempo:']) {
      expect(skill, `receipt must declare ${field}`).toContain(field)
    }
  })
})

describe('skill frontier and subagent role', () => {
  it('forbids a second ingestion pipeline inside the skill', () => {
    expect(skill, 'no media download').toMatch(/Não baixa mídia/)
    expect(skill, 'no transcription').toContain('não transcreve')
    expect(skill, 'no facet classification').toContain('não classifica facetas')
    expect(skill, 'no own dedupe').toMatch(/não faz\s+dedupe própria/)
    expect(skill, 'never exports the C215 write confirm flag').toMatch(
      /Nunca exporta `FALAS_WEB_IMPORT_CONFIRM`/,
    )
    expect(skill, 'never exports the C215 write confirm flag').not.toMatch(
      /export\s+FALAS_WEB_IMPORT_CONFIRM/,
    )
  })

  it('keeps the subagent discovery-only', () => {
    expect(agent).toMatch(/^---\n[\s\S]*mode: subagent[\s\S]*\n---/)
    expect(agent).not.toMatch(/^\s*["']?model["']?\s*:/m)
    expect(agent).toContain('discovery-<stamp>.json')
    expect(agent).toContain('Recibo da descoberta')
    expect(agent, 'subagent must not run the ingestion CLI').not.toContain('--findings')
    expect(agent, 'subagent must not write the lote/state').toContain(
      'nem o estado (`last-run.json`)',
    )
    expect(agent, 'radio/audio requires the direct media URL').toContain('mediaUrl')
    for (const field of ['artifactPath', 'findingsCount', 'reviewCount', 'byPlatform']) {
      expect(agent, `receipt must carry ${field}`).toContain(field)
    }
    expect(agent, 'subagent never reads the catalog DB').toMatch(/Não\*\* leia o banco/)
  })
})
