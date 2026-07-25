import { SearchIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

type CampaignSearchInputProps = Omit<ComponentProps<typeof InputGroupInput>, 'id'> & {
  id: string
  label: string
  fieldClassName?: string
}

export const CampaignSearchInput = ({
  id,
  label,
  fieldClassName,
  className,
  type = 'search',
  ...props
}: CampaignSearchInputProps) => (
  <Field className={cn('relative flex-1', fieldClassName)}>
    <FieldLabel htmlFor={id} className="sr-only">
      {label}
    </FieldLabel>
    <InputGroup className="min-h-11 rounded-[6px]">
      <InputGroupInput id={id} type={type} className={cn('min-h-11', className)} {...props} />
      <InputGroupAddon align="inline-start">
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
    </InputGroup>
  </Field>
)
