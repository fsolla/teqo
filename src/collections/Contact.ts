import { STATES } from '@/lib/states'
import { CollectionConfig } from 'payload'

export const Contact: CollectionConfig = {
  slug: 'contact',
  labels: {
    singular: 'Contato',
    plural: 'Contatos',
  },
  admin: {
    group: 'Contatos',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
      minLength: 2,
      maxLength: 120,
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      label: 'E-mail',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Celular',
      minLength: 11,
      maxLength: 11,
      required: true,
    },
    {
      name: 'state',
      type: 'select',
      label: 'Estado',
      options: STATES,
      required: true,
    },
    {
      name: 'city',
      type: 'text',
      label: 'Cidade',
      minLength: 2,
      maxLength: 100,
      required: true,
    },
    {
      name: 'postalCode',
      type: 'text',
      label: 'CEP',
      minLength: 8,
      maxLength: 8,
    },
    {
      name: 'comment',
      type: 'textarea',
      label: 'Comentario',
      maxLength: 1000,
    },
  ],
}
