// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assignSpeakerKeys,
  reconcileSpeakerLabels,
  RECORDING_DIARIZATION_MAX_SECONDS,
  recordingSpeakerDefaultLabel,
  speakerKeysInOrder,
  speakerNameMatches,
  speakerNamesFromLabels,
  type DiarizedTurn,
} from '@/lib/recordingDiarization'

const segment = (startSeconds: number, endSeconds: number) => ({
  startSeconds,
  endSeconds,
  text: `trecho ${startSeconds}`,
})

const turn = (speaker: string, startSeconds: number, endSeconds: number): DiarizedTurn => ({
  speaker,
  startSeconds,
  endSeconds,
})

describe('recording speaker grouping (C200)', () => {
  it('assigns each segment to the turn with the largest overlap', () => {
    const segments = [segment(0, 10), segment(10, 20), segment(20, 30)]
    const turns = [turn('A', 0, 11), turn('B', 12, 30)]

    const keyed = assignSpeakerKeys(segments, turns)
    expect(keyed.map((entry) => entry.speakerKey)).toEqual(['speaker-1', 'speaker-2', 'speaker-2'])
    // The original fields survive the assignment.
    expect(keyed[1]).toMatchObject({ startSeconds: 10, endSeconds: 20, text: 'trecho 10' })
  })

  it('breaks an overlap tie by the closest midpoint', () => {
    const segments = [segment(0, 10)]
    // Both turns overlap the same 5 s; B's midpoint is closer to the segment's.
    const turns = [turn('B', 5, 20), turn('A', 0, 5)]

    expect(assignSpeakerKeys(segments, turns)[0]?.speakerKey).toBe('speaker-1')
    expect(
      assignSpeakerKeys([segment(0, 10)], [turn('A', 0, 5), turn('B', 5, 20)])[0],
    ).toMatchObject({
      speakerKey: 'speaker-1',
    })
  })

  it('falls back to the nearest turn when there is no overlap at all', () => {
    const segments = [segment(0, 10), segment(30, 40)]
    const turns = [turn('A', 12, 20), turn('B', 45, 60)]

    expect(assignSpeakerKeys(segments, turns).map((entry) => entry.speakerKey)).toEqual([
      'speaker-1',
      'speaker-2',
    ])
  })

  it('numbers clusters globally by first appearance, not by provider name', () => {
    const segments = [segment(0, 5), segment(5, 10), segment(10, 15)]
    const turns = [turn('spk_9', 10, 15), turn('spk_2', 0, 5), turn('spk_9', 0, 10)]

    expect(assignSpeakerKeys(segments, turns).map((entry) => entry.speakerKey)).toEqual([
      'speaker-1',
      'speaker-2',
      'speaker-2',
    ])
  })

  it('keeps every key null without a usable turn and ignores invalid turns', () => {
    expect(assignSpeakerKeys([segment(0, 5)], []).map((entry) => entry.speakerKey)).toEqual([null])
    expect(
      assignSpeakerKeys([segment(0, 5)], [turn('', 0, 5), turn('A', Number.NaN, 5)]).map(
        (entry) => entry.speakerKey,
      ),
    ).toEqual([null])
  })

  it('lists the cluster keys in first-appearance order', () => {
    expect(
      speakerKeysInOrder([
        { speakerKey: 'speaker-2' },
        { speakerKey: null },
        { speakerKey: 'speaker-1' },
        { speakerKey: 'speaker-2' },
      ]),
    ).toEqual(['speaker-2', 'speaker-1'])
  })

  it('reconciles labels 1:1 by time overlap and reports what was dropped', () => {
    const previousSegments = [{ speakerKey: 'speaker-1', startSeconds: 0, endSeconds: 10 }]
    const nextSegments = [{ speakerKey: 'speaker-1', startSeconds: 0, endSeconds: 10 }]

    expect(
      reconcileSpeakerLabels({
        previousLabels: [{ speakerKey: 'speaker-1', label: 'Dep. Jorge Solla' }],
        previousSegments,
        nextSegments,
      }),
    ).toEqual({ labels: [{ speakerKey: 'speaker-1', label: 'Dep. Jorge Solla' }], dropped: false })

    expect(
      reconcileSpeakerLabels({
        previousLabels: [{ speakerKey: 'speaker-1', label: 'Dep. Jorge Solla' }],
        previousSegments,
        nextSegments: [{ speakerKey: 'speaker-1', startSeconds: 40, endSeconds: 50 }],
      }),
    ).toEqual({ labels: [], dropped: true })

    expect(
      reconcileSpeakerLabels({
        previousLabels: [],
        previousSegments,
        nextSegments,
      }),
    ).toEqual({ labels: [], dropped: false })
  })

  it('never shares one new cluster between two old labels (merge)', () => {
    // Two old clusters merged into one new cluster: keeping either label would
    // name the other person's speech, so both are dropped.
    const result = reconcileSpeakerLabels({
      previousLabels: [
        { speakerKey: 'speaker-1', label: 'Solla' },
        { speakerKey: 'speaker-2', label: 'Outra pessoa' },
      ],
      previousSegments: [
        { speakerKey: 'speaker-1', startSeconds: 0, endSeconds: 5 },
        { speakerKey: 'speaker-2', startSeconds: 5, endSeconds: 10 },
      ],
      nextSegments: [{ speakerKey: 'speaker-1', startSeconds: 0, endSeconds: 10 }],
    })

    expect(result).toEqual({ labels: [], dropped: true })
  })

  it('never duplicates one label across two new clusters (split)', () => {
    // One old cluster split into two new ones: the label cannot name both.
    const result = reconcileSpeakerLabels({
      previousLabels: [{ speakerKey: 'speaker-1', label: 'Solla' }],
      previousSegments: [{ speakerKey: 'speaker-1', startSeconds: 0, endSeconds: 10 }],
      nextSegments: [
        { speakerKey: 'speaker-1', startSeconds: 0, endSeconds: 5 },
        { speakerKey: 'speaker-2', startSeconds: 5, endSeconds: 10 },
      ],
    })

    expect(result).toEqual({ labels: [], dropped: true })
  })

  it('derives distinct speaker names case-insensitively, in order', () => {
    expect(
      speakerNamesFromLabels([
        { speakerKey: 'speaker-1', label: '  Dep. Jorge Solla ' },
        { speakerKey: 'speaker-2', label: 'dep. jorge solla' },
        { speakerKey: 'speaker-3', label: 'Presidente' },
        { speakerKey: 'speaker-4', label: '   ' },
      ]),
    ).toEqual(['Dep. Jorge Solla', 'Presidente'])
    expect(speakerNamesFromLabels(null)).toEqual([])
  })

  it('matches a facet term the same way the ILIKE query does', () => {
    expect(speakerNameMatches('Dep. Jorge Solla', 'solla')).toBe(true)
    expect(speakerNameMatches('Dep. Jorge Solla', 'Dep. Jorge')).toBe(true)
    expect(speakerNameMatches('Presidente', 'solla')).toBe(false)
  })

  it('names the default label with a number and pins the provider ceiling', () => {
    expect(recordingSpeakerDefaultLabel(1)).toBe('Falante 1')
    expect(recordingSpeakerDefaultLabel(12)).toBe('Falante 12')
    expect(RECORDING_DIARIZATION_MAX_SECONDS).toBe(10 * 60 * 60)
  })
})
