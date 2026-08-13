/**
 * The gender enum shared by every person-ish collection (contact, leadership,
 * dobradinha, supporter). Leaf module on purpose: `contact.ts` and
 * `leadership.ts` schemas import it from here — a re-export through either
 * would be a module cycle.
 */
export const personGenders = ['feminino', 'masculino', 'outro', 'nao_informado'] as const
