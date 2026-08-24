export type LeadershipListStateDeputiesResponse =
  | {
      status: 'success'
      message: string
    }
  | {
      status: 'error'
      message: string
    }
