export type MunicipalityListAdvisorsResponse =
  | {
      status: 'success'
      message: string
      advisors: number[]
    }
  | {
      status: 'error'
      message: string
    }
