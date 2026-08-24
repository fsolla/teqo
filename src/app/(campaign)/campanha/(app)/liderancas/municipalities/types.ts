export type LeadershipListMunicipalitiesResponse =
  | {
      status: 'success'
      message: string
    }
  | {
      status: 'error'
      message: string
    }
