import { fromBuffer as yauzlFromBuffer } from 'yauzl'

/**
 * Read a single entry from a ZIP buffer by exact filename or suffix match.
 * Returns null when no matching entry exists.
 */
export const readZipEntry = async (
  zipBuffer: Buffer,
  matcher: string | ((fileName: string) => boolean),
): Promise<{ fileName: string; buffer: Buffer } | null> => {
  const match =
    typeof matcher === 'string'
      ? (name: string) => name === matcher || name.endsWith(`/${matcher}`) || name.endsWith(matcher)
      : matcher

  return new Promise((resolve, reject) => {
    yauzlFromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('Falha ao abrir ZIP'))
        return
      }

      let settled = false
      const finish = (value: { fileName: string; buffer: Buffer } | null) => {
        if (settled) return
        settled = true
        try {
          zipfile.close()
        } catch {
          // ignore close errors after resolve
        }
        resolve(value)
      }

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (settled) return
        if (/\/$/.test(entry.fileName) || !match(entry.fileName)) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error(`Falha ao ler ${entry.fileName}`))
            return
          }
          const chunks: Buffer[] = []
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk))
          readStream.on('error', reject)
          readStream.on('end', () => {
            finish({ fileName: entry.fileName, buffer: Buffer.concat(chunks) })
          })
        })
      })
      zipfile.on('end', () => {
        finish(null)
      })
      zipfile.on('error', reject)
    })
  })
}

export const downloadToBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download falhou (${response.status}): ${url}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
