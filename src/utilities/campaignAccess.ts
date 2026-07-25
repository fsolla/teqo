/**
 * Public surface of campaign RBAC; implementations live in
 * `src/utilities/access/*` by domain. Import sites keep importing from
 * `@/utilities/campaignAccess` — add new rules to the matching domain module
 * (or a new one) and re-export them here.
 */

export {
  eligibleCampaignStaffWhere,
  isCampaignCoordinator,
  isCampaignLeader,
  isCampaignStaff,
  isCampaignUnrestricted,
  isPayloadAdmin,
  payloadAdminOnly,
} from '@/utilities/access/shared'

export {
  canCreateCampaignUserPhone,
  canManageCampaignStaffField,
  canManageCampaignUserRole,
  canManageCampaignUsers,
  canReadCampaignStaffField,
  canReadCampaignUserIdentity,
  canReadCampaignUserPhone,
  canReadCampaignUsers,
  canSetCampaignSystemField,
  canUpdateCampaignUser,
  canUpdateCampaignUserAvatar,
  canUpdateCampaignUserPhone,
} from '@/utilities/access/campaignUsers'

export {
  canAssignMunicipalityAdvisors,
  canCreateMunicipality,
  canDeleteMunicipality,
  canManageMunicipalityAdvisors,
  canReadMunicipality,
  canUpdateMunicipality,
  getAccessibleMunicipalityIds,
  getAdvisorMunicipalityIds,
  getEngagedLeaderMunicipalityIds,
} from '@/utilities/access/municipalities'

export { canManageContacts, canReadContacts } from '@/utilities/access/contacts'

export {
  canCreateLeadership,
  canDeleteLeadership,
  canManageLeadership,
  canReadLeadership,
  canSetAdministrativeLeadershipField,
  getAccessibleLeadershipIds,
} from '@/utilities/access/leaderships'

export {
  canCreateVotePledge,
  canDeleteVotePledge,
  canReadVotePledge,
  canUpdateVotePledge,
} from '@/utilities/access/votePledges'

export {
  canCreateAllocationDecision,
  canMutateAllocationDecision,
  canReadAllocationDecision,
} from '@/utilities/access/allocationDecisions'

export {
  canCreateMunicipalityUpdate,
  canMutateMunicipalityUpdate,
  canReadMunicipalityUpdate,
  canSetMunicipalityUpdateAuthor,
} from '@/utilities/access/municipalityUpdates'

export {
  canCreateCampaignInvite,
  canMutateCampaignInvite,
  canReadCampaignInvite,
  canSetCampaignInviteSystemField,
} from '@/utilities/access/invites'

export {
  canCreateSupporter,
  canDeleteSupporter,
  canManageSupporter,
  canReadSupporter,
} from '@/utilities/access/supporters'

export {
  canCreateOrganization,
  canDeleteOrganization,
  canManageOrganization,
  canReadOrganization,
} from '@/utilities/access/organizations'

export {
  canCreateCampaignDemand,
  canDeleteCampaignDemand,
  canReadCampaignDemand,
  canUpdateCampaignDemand,
} from '@/utilities/access/demands'

export {
  canCreateActivity,
  canCreateActivityAdvisors,
  canDeleteActivity,
  canManageActivityAdvisors,
  canReadActivity,
  canSetActivityStatus,
  canSetActivitySystemField,
  canUpdateActivity,
} from '@/utilities/access/activities'

export {
  assertCanReadElectionData,
  canMutateElectionData,
  canReadElectionData,
} from '@/utilities/access/elections'

export {
  canCreateStateDeputy,
  canDeleteStateDeputy,
  canManageStateDeputy,
  canReadStateDeputy,
} from '@/utilities/access/stateDeputies'
