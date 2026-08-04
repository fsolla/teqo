export type MunicipalityListLeadershipsResponse =
  | {
      status: 'success'
      message: string
      /** The município's resulting leadership id set, for the optimistic reconcile. */
      leadershipIDs: number[]
      /** B155 — present only on the inline-create path; the client registers it locally. */
      createdLeadership?: { id: number; name: string }
    }
  | {
      status: 'error'
      message: string
    }
