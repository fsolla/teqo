import { tool } from 'ai'
import { z } from 'zod'

export const calculate = tool({
  description:
    'Perform safe arithmetic operations. Use for percentages, sums, growth rates, electoral quotients. NEVER do math yourself — always delegate here.',
  inputSchema: z.object({
    operations: z.array(
      z.object({
        op: z.enum(['sum', 'percentage', 'growth', 'multiply', 'divide']),
        a: z.number().optional().describe('First operand (or numerator for percentage).'),
        b: z
          .number()
          .optional()
          .describe('Second operand (or denominator for percentage, base for growth).'),
        values: z.array(z.number()).optional().describe('List of numbers to sum.'),
      }),
    ),
  }),
  execute: async ({ operations }) => {
    return operations.map(({ op, a, b, values }) => {
      switch (op) {
        case 'sum':
          return {
            op,
            result: (values ?? []).reduce((s, v) => s + v, 0),
          }
        case 'percentage':
          return a != null && b != null && b !== 0
            ? { op, a, b, result: Number(((a / b) * 100).toFixed(1)) }
            : { op, a, b, error: 'Divisão por zero ou operandos ausentes' }
        case 'growth':
          return a != null && b != null && a !== 0
            ? { op, a, b, result: Number((((b - a) / a) * 100).toFixed(1)) }
            : { op, a, b, error: 'Base zero ou operandos ausentes' }
        case 'multiply':
          return { op, result: (a ?? 1) * (b ?? 1) }
        case 'divide':
          return a != null && b != null && b !== 0
            ? { op, result: Number((a / b).toFixed(2)) }
            : { op, a, b, error: 'Divisão por zero ou operandos ausentes' }
      }
    })
  },
})
