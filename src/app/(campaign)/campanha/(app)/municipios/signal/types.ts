export type MunicipalityListSignalResponse =
  | {
      status: 'success'
      message: string
    }
  | {
      status: 'error'
      message: string
    }
