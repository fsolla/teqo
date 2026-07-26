'use server'

import { revalidatePath } from 'next/cache'

import { toggleActivityTask } from '@/app/(campaign)/campanha/actions/activity'

export type ToggleActivityTaskResult = { ok: true } | { ok: false; message: string }

export const toggleActivityTaskAction = async (
  activityId: number,
  taskId: string,
  done: boolean,
): Promise<ToggleActivityTaskResult> => {
  try {
    await toggleActivityTask(activityId, taskId, done)
    // Refresh the RSC props behind the optimistic checkbox — without this the
    // optimistic state reverts to stale server data when the transition ends.
    revalidatePath('/campanha/atividades/[slug]', 'page')
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
