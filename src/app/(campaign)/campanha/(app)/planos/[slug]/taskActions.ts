'use server'

import { revalidatePath } from 'next/cache'

import { toggleActionPlanTask } from '@/app/(campaign)/campanha/actions/actionPlan'

export type ToggleActionPlanTaskResult = { ok: true } | { ok: false; message: string }

export const toggleActionPlanTaskAction = async (
  planId: number,
  taskId: string,
  done: boolean,
): Promise<ToggleActionPlanTaskResult> => {
  try {
    await toggleActionPlanTask(planId, taskId, done)
    // Refresh the RSC props behind the optimistic checkbox — without this the
    // optimistic state reverts to stale server data when the transition ends.
    revalidatePath('/campanha/planos/[slug]', 'page')
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
