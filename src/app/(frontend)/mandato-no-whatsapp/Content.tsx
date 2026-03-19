'use client'

import { useState } from 'react'
import { FormStep } from './FormStep'
import { ThankStep } from './ThankStep'

export const Content = () => {
  const [step, setStep] = useState('form')

  if (step === 'form') {
    return <FormStep onSubmit={() => setStep('thank')} />
  }

  return <ThankStep />
}
