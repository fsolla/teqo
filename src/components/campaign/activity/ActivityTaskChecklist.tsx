'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'

import { toggleActivityTaskAction } from '@/app/(campaign)/campanha/(app)/atividades/[slug]/taskActions'
import { Checkbox } from '@/components/ui/Checkbox'
import type { ActivityTaskViewModel } from '@/utilities/activityViewModels'

type ActivityTaskChecklistProps = {
  activityId: number
  tasks: ActivityTaskViewModel[]
}

export const ActivityTaskChecklist = ({ activityId, tasks }: ActivityTaskChecklistProps) => {
  const [isPending, startTransition] = useTransition()
  const [optimisticTasks, setOptimisticDone] = useOptimistic(
    tasks,
    (currentTasks, { taskId, done }: { taskId: string; done: boolean }) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, done } : task)),
  )

  const toggle = (taskId: string | null, done: boolean) => {
    if (!taskId) return

    startTransition(async () => {
      setOptimisticDone({ taskId, done })
      const result = await toggleActivityTaskAction(activityId, taskId, done)
      // On failure the optimistic state rolls back automatically when the
      // transition ends (the action does not revalidate on error).
      if (!result.ok) toast.error(result.message)
    })
  }

  if (!optimisticTasks.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
  }

  return (
    <ul role="list" className="flex flex-col gap-2" aria-busy={isPending}>
      {optimisticTasks.map((task) => (
        <li
          key={task.id ?? task.title}
          className="flex items-start gap-3 rounded-lg border p-3"
          data-done={task.done}
          data-pending={isPending || undefined}
        >
          <Checkbox
            checked={task.done}
            disabled={isPending}
            onCheckedChange={(checked) => toggle(task.id, checked === true)}
            aria-label={`Marcar tarefa "${task.title}" como ${task.done ? 'pendente' : 'concluída'}`}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={`break-words ${task.done ? 'line-through text-muted-foreground' : ''}`}
            >
              {task.title}
            </span>
            {task.responsibleName ? (
              <span className="text-xs text-muted-foreground">Resp: {task.responsibleName}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
