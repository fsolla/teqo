'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTransition } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

import { loginCampaign } from '@/app/(campanha)/campanha/actions/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { campaignLoginSchema, type CampaignLoginInput } from '@/lib/schemas/campaign-login'

export const LoginForm = () => {
  const methods = useForm<CampaignLoginInput>({
    resolver: zodResolver(campaignLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const [isSubmitting, startTransition] = useTransition()

  const handleSubmit: SubmitHandler<CampaignLoginInput> = (input) => {
    startTransition(async () => {
      const result = await loginCampaign(input)

      if (result?.error) {
        methods.setError('root', { message: result.error })
      }
    })
  }

  const {
    register,
    formState: { errors },
  } = methods

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Acessar painel</CardTitle>
        <CardDescription>Entre com seu e-mail e senha para continuar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={methods.handleSubmit(handleSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email?.message ? (
                <FieldDescription className="text-destructive">
                  {errors.email.message}
                </FieldDescription>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password?.message ? (
                <FieldDescription className="text-destructive">
                  {errors.password.message}
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              {errors.root?.message ? <FieldError>{errors.root.message}</FieldError> : null}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
