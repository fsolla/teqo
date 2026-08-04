export type MunicipalityListAdvisorsResponse =
  | {
      status: 'success'
      message: string
      advisors: number[]
      /** B154 — present only on the name-only create path; the client registers it locally. */
      createdAdvisor?: { id: number; name: string }
    }
  | {
      status: 'error'
      message: string
    }
