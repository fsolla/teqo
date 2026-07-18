'use server'

import { toggleActionPlanTask } from '@/app/(campaign)/campanha/actions/actionPlan'

export type ToggleActionPlanTaskResult = { ok: true } | { ok: false; message: string }

export const toggleActionPlanTaskAction = async (
  planId: number,
  taskId: string,
  done: boolean,
): Promise<ToggleActionPlanTaskResult> => {
  try {
    await toggleActionPlanTask(planId, taskId, done)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a tarefa. Atualize a página e tente novamente.',
    }
  }
}
