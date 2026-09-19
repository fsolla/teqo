// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  canRetryRecording,
  canServeRecordingMedia,
  formatRecordingFileSize,
  isRecordingStatus,
  RECORDING_FAILURE_INTERRUPTED,
  RECORDING_MAX_BYTES,
  RECORDING_MAX_SIZE_LABEL,
  RECORDING_STATUSES,
  RECORDING_STEPS,
  recordingFailureMessage,
  recordingFileTypeAllowed,
  recordingStatusLabels,
  recordingTooLargeMessage,
  recordingUploadTooLargeMessage,
  toRecordingViewModel,
} from '@/lib/recording'
import {
  buildRecordingAudioFfmpegArgs,
  mergeChunkTranscriptions,
  RECORDING_AUDIO_CHUNK_SECONDS,
  recordingSearchText,
} from '@/lib/recordingTranscription'

describe('recording vocabulary (C199)', () => {
  it('pins the statuses, steps and their labels', () => {
    expect(RECORDING_STATUSES).toEqual(['uploading', 'processing', 'ready', 'failed'])
    expect(Object.keys(recordingStatusLabels).sort()).toEqual([...RECORDING_STATUSES].sort())
    expect(RECORDING_STEPS).toEqual(['extracting', 'transcribing', 'saving'])
    expect(isRecordingStatus('failed')).toBe(true)
    expect(isRecordingStatus('published')).toBe(false)
  })

  it('serves media from processing on, never during the upload stream', () => {
    expect(canServeRecordingMedia('uploading')).toBe(false)
    expect(canServeRecordingMedia('processing')).toBe(true)
    expect(canServeRecordingMedia('failed')).toBe(true)
    expect(canServeRecordingMedia('ready')).toBe(true)
  })

  it('only offers retry for a failed transcription', () => {
    expect(canRetryRecording('failed')).toBe(true)
    expect(canRetryRecording('ready')).toBe(false)
    expect(canRetryRecording('processing')).toBe(false)
  })

  it('maps the failure cause to honest copy', () => {
    expect(
      recordingFailureMessage({ error: RECORDING_FAILURE_INTERRUPTED, step: 'transcribing' }),
    ).toBe(RECORDING_FAILURE_INTERRUPTED)
    expect(recordingFailureMessage({ error: 'raw stderr detail', step: 'extracting' })).toBe(
      'Não foi possível preparar o áudio da gravação.',
    )
    expect(recordingFailureMessage({ error: 'raw stderr detail', step: 'transcribing' })).toBe(
      'Não foi possível transcrever a gravação.',
    )
    expect(recordingFailureMessage({ error: 'raw stderr detail', step: 'saving' })).toBe(
      'Não foi possível guardar a transcrição.',
    )
    expect(recordingFailureMessage({ error: 'raw detail', step: null })).toBe(
      'Não foi possível transcrever a gravação.',
    )
    expect(recordingFailureMessage({ error: null, step: 'transcribing' })).toBeNull()
    expect(recordingFailureMessage({ error: '   ', step: 'transcribing' })).toBeNull()
  })

  it('accepts videos and unknown types, refuses every other type', () => {
    expect(recordingFileTypeAllowed('video/mp4')).toBe(true)
    expect(recordingFileTypeAllowed('video/quicktime')).toBe(true)
    expect(recordingFileTypeAllowed('')).toBe(true)
    expect(recordingFileTypeAllowed(null)).toBe(true)
    expect(recordingFileTypeAllowed('text/plain')).toBe(false)
    expect(recordingFileTypeAllowed('image/png')).toBe(false)
  })

  it('formats sizes in pt-BR and names the limit', () => {
    expect(formatRecordingFileSize(4.6 * 1024 ** 3)).toContain('GB')
    expect(formatRecordingFileSize(812 * 1024 ** 2)).toBe('812 MB')
    expect(recordingTooLargeMessage(4.6 * 1024 ** 3)).toContain('4,6 GB')
    expect(recordingTooLargeMessage(4.6 * 1024 ** 3)).toContain(RECORDING_MAX_SIZE_LABEL)
    expect(recordingUploadTooLargeMessage).toContain(RECORDING_MAX_SIZE_LABEL)
    expect(RECORDING_MAX_BYTES).toBe(4 * 1024 ** 3)
  })

  it('formats the byte range below 1 KB honestly', () => {
    expect(formatRecordingFileSize(0)).toBe('0 B')
    expect(formatRecordingFileSize(900)).toBe('900 B')
    expect(formatRecordingFileSize(2048)).toBe('2 KB')
  })

  it('builds the view model with labels and hrefs', () => {
    const view = toRecordingViewModel({
      id: 7,
      title: '  Plenária da Comissão  ',
      status: 'ready',
      step: null,
      recordedAt: '2026-09-01T00:00:00.000Z',
      durationSeconds: 3725,
    })
    expect(view.title).toBe('Plenária da Comissão')
    expect(view.recordedAtLabel).toBe('01/09/2026')
    expect(view.durationLabel).toBe('1:02:05')
    expect(view.detailHref).toBe('/campanha/comunicacao/acervo/gravacoes/7')
    expect(view.fileHref).toBe('/campanha/comunicacao/acervo/gravacoes/7/arquivo')
    expect(view.downloadHref).toBe('/campanha/comunicacao/acervo/gravacoes/7/arquivo?download=1')
    expect(view.retryHref).toBe('/campanha/comunicacao/acervo/gravacoes/7/retry')
    expect(view.deleteHref).toBe('/campanha/comunicacao/acervo/gravacoes/7/apagar')

    const degraded = toRecordingViewModel({
      id: 8,
      title: '',
      status: 'stray',
      step: 'stray',
      recordedAt: null,
      durationSeconds: null,
    })
    expect(degraded.title).toBe('Gravação 8')
    expect(degraded.status).toBe('failed')
    expect(degraded.step).toBeNull()
    expect(degraded.recordedAtLabel).toBeNull()
    expect(degraded.durationLabel).toBeNull()
  })
})

describe('recording transcription (C199)', () => {
  it('builds the extract-and-split ffmpeg command', () => {
    const args = buildRecordingAudioFfmpegArgs({
      inputPath: '/tmp/in.mkv',
      outputPattern: '/tmp/chunk-%03d.mp3',
    })
    expect(args).toContain('-vn')
    expect(args).toContain('libmp3lame')
    expect(args[args.indexOf('-segment_time') + 1]).toBe(String(RECORDING_AUDIO_CHUNK_SECONDS))
    expect(args.at(-1)).toBe('/tmp/chunk-%03d.mp3')
  })

  it('merges chunks with absolute offsets, contiguous order and clamped spans', () => {
    const merged = mergeChunkTranscriptions([
      {
        offsetSeconds: 0,
        segments: [
          { start: 1, end: 4, text: 'primeiro trecho' },
          { start: 4, end: 2, text: 'clamp aqui' },
          { start: 5, end: 6, text: '   ' },
        ],
      },
      {
        offsetSeconds: 1200,
        segments: [{ start: 0.5, end: 3, text: 'segundo chunk' }],
      },
    ])

    expect(merged).toHaveLength(3)
    expect(merged[0]).toEqual({
      order: 0,
      startSeconds: 1,
      endSeconds: 4,
      text: 'primeiro trecho',
    })
    expect(merged[1]).toEqual({ order: 1, startSeconds: 4, endSeconds: 4, text: 'clamp aqui' })
    expect(merged[2]).toMatchObject({
      order: 2,
      startSeconds: 1200.5,
      endSeconds: 1203,
      text: 'segundo chunk',
    })
  })

  it('normalizes the concatenated search text', () => {
    expect(recordingSearchText([{ text: 'Ação da Comissão' }, { text: '  de EDUCAÇÃO  ' }])).toBe(
      'acao da comissao de educacao',
    )
  })

  it('returns nothing for an empty transcription', () => {
    expect(mergeChunkTranscriptions([])).toEqual([])
    expect(recordingSearchText([])).toBe('')
  })
})
