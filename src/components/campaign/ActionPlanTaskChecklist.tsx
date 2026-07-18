'use client'

import { startTransition, useOptimistic } from 'react'
import { toast } from 'sonner'

import { toggleActionPlanTaskAction } from '@/app/(campaign)/campanha/(app)/planos/[slug]/taskActions'
import { Checkbox } from '@/components/ui/Checkbox'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'
import type { ActionPlanTaskViewModel } from '@/utilities/actionPlanViewModels'

type ActionPlanTaskChecklistProps = {
  planId: number
  tasks: ActionPlanTaskViewModel[]
}

export const ActionPlanTaskChecklist = ({ planId, tasks }: ActionPlanTaskChecklistProps) => {
  const [optimisticTasks, setOptimisticDone] = useOptimistic(
    tasks,
    (currentTasks, { taskId, done }: { taskId: string; done: boolean }) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, done } : task)),
  )

  const toggle = (taskId: string | null, done: boolean) => {
    if (!taskId) return

    startTransition(async () => {
      setOptimisticDone({ taskId, done })
      const result = await toggleActionPlanTaskAction(planId, taskId, done)
      if (!result.ok) toast.error(result.message)
    })
  }

  if (!optimisticTasks.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
  }

  return (
    <ul role="list" className="flex flex-col gap-2">
      {optimisticTasks.map((task) => (
        <li
          key={task.id ?? task.title}
          className="flex items-start gap-3 rounded-lg border p-3"
          data-done={task.done}
        >
          <Checkbox
            checked={task.done}
            onCheckedChange={(checked) => toggle(task.id, checked === true)}
            aria-label={`Marcar tarefa "${task.title}" como ${task.done ? 'pendente' : 'concluída'}`}
            className="mt-0.5"
          />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className={task.done ? 'line-through text-muted-foreground' : undefined}>
              {task.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {[
                task.responsibleName ? `Resp: ${task.responsibleName}` : null,
                task.due ? `Prazo: ${formatBahiaDateTimeLabel(task.due)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
