/**
 * C242 — the legal texts the selfie search resolves by stable key, versioned in
 * the repo so the delivery that opens the surface owns what the visitor reads:
 *
 * - `busca-selfie-fotos` is the QUERY consent: authorizes the use of the
 *   visitor's own selfie/biometrics for this one search, on device.
 * - `busca-selfie-indice` is the PUBLIC NOTICE of the anonymous archive index
 *   (scope B): transparency about the descriptor index over approved photos
 *   and the self-service opt-out. It is not an enrollment consent — nobody is
 *   individually enrolled.
 *
 * Both are written to the `consent` collection by `pnpm seed:face-consents`
 * (create-if-missing, idempotent, guarded); editing a text here and re-running
 * updates the row (versioned by Payload).
 */

/** Builds the Lexical root of a Consent text from plain paragraphs. */
export const buildConsentRichText = (paragraphs) => ({
  root: {
    type: 'root',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      children: [{ type: 'text', text, version: 1 }],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    })),
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
})

export const FACE_SEARCH_CONSENT_PARAGRAPHS = [
  'Autorizo, de forma livre, informada e específica, o uso da minha selfie e dos dados biométricos faciais dela extraídos exclusivamente para esta consulta: procurar, entre as fotos públicas aprovadas do acervo do mandato de Jorge Solla, aquelas em que eu apareço.',
  'O reconhecimento acontece no meu próprio aparelho. A imagem da selfie não é enviada nem armazenada; ao servidor é enviado apenas o vetor matemático necessário para a comparação, que é descartado ao fim da consulta e não fica guardado.',
  'Estou ciente de que o resultado não mostra nomes de terceiros e não informa grau de semelhança. A busca pode não encontrar fotos, e posso interrompê-la a qualquer momento.',
  'A base legal é o consentimento específico para dados pessoais sensíveis (art. 11, I, da LGPD). Posso retirar este consentimento a qualquer momento, sem custo, pelo próprio fluxo ou pelos canais do mandato — a retirada não afeta o que já foi realizado.',
  'Controlador: campanha Jorge Solla 1313. Mais detalhes na Política de Privacidade do site.',
]

export const FACE_INDEX_CONSENT_PARAGRAPHS = [
  'Aviso público sobre o índice de fotos: as fotos públicas aprovadas do acervo podem conter rostos de várias pessoas. Para que cada pessoa encontre as próprias fotos pela busca por selfie, o sistema mantém um índice biométrico anônimo — vetores matemáticos extraídos dos rostos presentes nessas fotos, sem nome, sem vínculo com cadastro de pessoas e sem qualquer identificação de quem aparece.',
  'O índice serve apenas para localizar as fotos da própria pessoa que faz a busca. Ele nunca é usado para identificar, nomear ou listar terceiros, e nunca cruza os dados biométricos com contatos, lideranças ou apoiadores.',
  'Qualquer pessoa pode retirar seu rosto do índice a qualquer momento, sem custo: use a opção “Minha presença” na página da busca e siga as instruções. A retirada apaga do índice as referências biométricas correspondentes, e o rosto deixa de ser encontrado.',
  'Para pedir a remoção de uma foto específica, use o canal indicado no álbum público. Fotos que não estejam aprovadas para o público não fazem parte do índice.',
]

export const FACE_SEARCH_CONSENT_TEXT = buildConsentRichText(FACE_SEARCH_CONSENT_PARAGRAPHS)
export const FACE_INDEX_CONSENT_TEXT = buildConsentRichText(FACE_INDEX_CONSENT_PARAGRAPHS)
