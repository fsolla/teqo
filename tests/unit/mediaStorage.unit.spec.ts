// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { resolveS3StorageEnv, S3_STORAGE_ENV_KEYS } from '../../src/utilities/mediaStorage'

const fullEnv = (): Record<string, string> => ({
  S3_BUCKET: 'teqo-media',
  S3_ENDPOINT: 'http://100.119.220.31:3900',
  S3_ACCESS_KEY_ID: 'AK-test',
  S3_SECRET_ACCESS_KEY: 'secret',
})

describe('resolveS3StorageEnv (OPS52)', () => {
  it('desabilita o storage S3 quando nenhuma env S3_* está presente', () => {
    expect(resolveS3StorageEnv({})).toEqual({ enabled: false })
    expect(resolveS3StorageEnv({ DATABASE_URL: 'x', PAYLOAD_SECRET: 'y' })).toEqual({
      enabled: false,
    })
  })

  it('habilita o storage com todas as envs e region default do Garage', () => {
    expect(resolveS3StorageEnv(fullEnv())).toEqual({
      enabled: true,
      bucket: 'teqo-media',
      endpoint: 'http://100.119.220.31:3900',
      region: 'garage',
      accessKeyId: 'AK-test',
      secretAccessKey: 'secret',
    })
  })

  it('aceita S3_REGION explícita', () => {
    const resolved = resolveS3StorageEnv({ ...fullEnv(), S3_REGION: 'garage-dev' })
    expect(resolved.enabled && resolved.region).toBe('garage-dev')
  })

  it('lança com a lista exata de envs faltantes na configuração parcial', () => {
    const partial: Record<string, string> = { ...fullEnv() }
    delete partial.S3_SECRET_ACCESS_KEY
    delete partial.S3_ENDPOINT
    expect(() => resolveS3StorageEnv(partial)).toThrowError(
      /faltam S3_ENDPOINT, S3_SECRET_ACCESS_KEY/,
    )
  })

  it('ignora envs setadas com valor em branco na contagem de parcial', () => {
    const env = { ...fullEnv(), S3_BUCKET: '  ' }
    expect(() => resolveS3StorageEnv(env)).toThrowError(/faltam S3_BUCKET/)
  })

  it('lista todas as envs esperadas como obrigatórias (exceto region)', () => {
    expect(S3_STORAGE_ENV_KEYS).toHaveLength(4)
    expect(S3_STORAGE_ENV_KEYS).not.toContain('S3_REGION')
  })
})
