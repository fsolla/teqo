'use client'

import { useId, useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'

import { ContactCombobox, type ContactComboboxOption } from '@/components/campaign/shared/ContactCombobox'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatIsoAsBahiaDateTimeInput } from '@/utilities/campaignTime'

export type ActionPlanTaskFieldValue = {
  key: string
  title: string
  responsible: ContactComboboxOption | null
  due: string
  done: boolean
}

type ActionPlanTaskFieldsProps = {
  initialTasks: Array<{
    id: string | null
    title: string
    responsible: ContactComboboxOption | null
    due: string | null
    done: boolean
  }>
  searchContacts: (query: string) => Promise<ContactComboboxOption[]>
  error?: string
}

let taskKeySequence = 0
const nextTaskKey = (): string => {
  taskKeySequence += 1
  return `new-${taskKeySequence}`
}

const serializeTasks = (tasks: ActionPlanTaskFieldValue[]) =>
  JSON.stringify(
    tasks
      .filter((task) => task.title.trim().length > 0)
      .map((task) => ({
        title: task.title.trim(),
        ...(task.responsible ? { responsible: task.responsible.id } : {}),
        ...(task.due ? { due: task.due } : {}),
        done: task.done,
      })),
  )

export const ActionPlanTaskFields = ({
  initialTasks,
  searchContacts,
  error,
}: ActionPlanTaskFieldsProps) => {
  const fieldId = useId()
  const [tasks, setTasks] = useState<ActionPlanTaskFieldValue[]>(() =>
    initialTasks.map((task) => ({
      key: task.id ?? nextTaskKey(),
      title: task.title,
      responsible: task.responsible,
      due: task.due ? formatIsoAsBahiaDateTimeInput(task.due) : '',
      done: task.done,
    })),
  )

  const updateTask = (key: string, patch: Partial<ActionPlanTaskFieldValue>) => {
    setTasks((current) => current.map((task) => (task.key === key ? { ...task, ...patch } : task)))
  }

  const addTask = () => {
    setTasks((current) => [
      ...current,
      { key: nextTaskKey(), title: '', responsible: null, due: '', done: false },
    ])
  }

  const removeTask = (key: string) => {
    setTasks((current) => current.filter((task) => task.key !== key))
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId}>Tarefas</FieldLabel>
      <input type="hidden" id={fieldId} name="tasksJson" value={serializeTasks(tasks)} readOnly />
      <div className="flex flex-col gap-3">
        {tasks.map((task, index) => (
          <div key={task.key} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start">
            <div className="grid flex-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <Input
                aria-label={`Título da tarefa ${index + 1}`}
                placeholder="Título da tarefa"
                value={task.title}
                maxLength={200}
                className="min-h-11"
                onChange={(event) => updateTask(task.key, { title: event.target.value })}
              />
              <ContactCombobox
                label={`Responsável da tarefa ${index + 1}`}
                current={task.responsible}
                search={searchContacts}
                onChange={(contact) => updateTask(task.key, { responsible: contact })}
              />
              <Input
                aria-label={`Prazo da tarefa ${index + 1}`}
                type="datetime-local"
                value={task.due}
                className="min-h-11"
                onChange={(event) => updateTask(task.key, { due: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 shrink-0"
              onClick={() => removeTask(task.key)}
              aria-label={`Remover tarefa ${index + 1}`}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" className="min-h-11 w-fit" onClick={addTask}>
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        Adicionar tarefa
      </Button>
      {error ? <FieldError id={`${fieldId}-error`}>{error}</FieldError> : null}
    </Field>
  )
}
