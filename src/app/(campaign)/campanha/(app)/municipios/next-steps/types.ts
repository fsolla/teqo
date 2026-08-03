export type MunicipalityNextStepsResponse =
  | {
      status: 'success'
      message: string
      savedNextSteps: string | null
    }
  | {
      status: 'error'
      message: string
    }
