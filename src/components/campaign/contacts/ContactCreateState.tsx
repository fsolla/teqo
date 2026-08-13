'use client'

import { PlusIcon } from 'lucide-react'
import { createContext, useContext, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

/**
 * C139 — the contacts create surface. One tiny client store shared by the
 * desktop row (inside the table container) and the mobile FAB: opening from
 * either mounts the same row. The row itself is `ContactCreateRow`.
 */
type ContactCreateState = {
  open: boolean
  setOpen: (open: boolean) => void
}

const ContactCreateContext = createContext<ContactCreateState | null>(null)

export const ContactCreateProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  return (
    <ContactCreateContext.Provider value={{ open, setOpen }}>
      {children}
    </ContactCreateContext.Provider>
  )
}

export const useContactCreate = (): ContactCreateState => {
  const context = useContext(ContactCreateContext)
  if (!context) throw new Error('useContactCreate must be used within ContactCreateProvider')
  return context
}

/** Desktop trailing control of the omnibox (the mobile FAB is Fase 5). */
export const ContactCreateButton = () => {
  const { open, setOpen } = useContactCreate()
  return (
    <Button type="button" className="min-h-11" onClick={() => setOpen(!open)} aria-expanded={open}>
      <PlusIcon className="size-4" aria-hidden />
      Novo contato
    </Button>
  )
}
