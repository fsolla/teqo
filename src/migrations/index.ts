import * as migration_20260715_163458_initial from './20260715_163458_initial'
import * as migration_20260715_163500_consent_text_to_jsonb from './20260715_163500_consent_text_to_jsonb'
import * as migration_20260715_181058_add_post_and_tag from './20260715_181058_add_post_and_tag'
import * as migration_20260715_215834_rename_tag_visible_to_hidden from './20260715_215834_rename_tag_visible_to_hidden'
import * as migration_20260716_010420_add_campaign_user from './20260716_010420_add_campaign_user'
import * as migration_20260718_010733_consolidate_campaign_schema from './20260718_010733_consolidate_campaign_schema'
import * as migration_20260718_190559_territorio_multi_municipio_bairro from './20260718_190559_territorio_multi_municipio_bairro'
import * as migration_20260718_195854_add_election_results from './20260718_195854_add_election_results'
import * as migration_20260718_222656_add_supporter from './20260718_222656_add_supporter'
import * as migration_20260718_222832_add_action_plan from './20260718_222832_add_action_plan'
import * as migration_20260719_011015_add_supporter_import_batch from './20260719_011015_add_supporter_import_batch'
import * as migration_20260719_014906_action_plan_list_perf from './20260719_014906_action_plan_list_perf'
import * as migration_20260719_020000_add_contact_trgm_index from './20260719_020000_add_contact_trgm_index'
import * as migration_20260719_054522_add_nucleus_goals_strategy from './20260719_054522_add_nucleus_goals_strategy'
import * as migration_20260719_054706_add_privacy_policy_global from './20260719_054706_add_privacy_policy_global'
import * as migration_20260719_054707_seed_onda0_consent_and_privacy from './20260719_054707_seed_onda0_consent_and_privacy'
import * as migration_20260719_061302_add_campaign_user_avatar from './20260719_061302_add_campaign_user_avatar'
import * as migration_20260721_020109_remodel_plazas from './20260721_020109_remodel_plazas'
import * as migration_20260721_133444_add_plaza_expected_votes from './20260721_133444_add_plaza_expected_votes'
import * as migration_20260721_133531_add_petition_facebook_pixel_id from './20260721_133531_add_petition_facebook_pixel_id'
import * as migration_20260723_025513_add_import_export_plugin from './20260723_025513_add_import_export_plugin'
import * as migration_20260723_124200_add_vote_estimate_scenarios from './20260723_124200_add_vote_estimate_scenarios'
import * as migration_20260723_200000_remodel_municipalities from './20260723_200000_remodel_municipalities'
import * as migration_20260723_201000_add_state_deputy from './20260723_201000_add_state_deputy'
import * as migration_20260723_202000_reconcile_municipality_remodel from './20260723_202000_reconcile_municipality_remodel'

export const migrations = [
  {
    up: migration_20260715_163458_initial.up,
    down: migration_20260715_163458_initial.down,
    name: '20260715_163458_initial',
  },
  {
    up: migration_20260715_163500_consent_text_to_jsonb.up,
    down: migration_20260715_163500_consent_text_to_jsonb.down,
    name: '20260715_163500_consent_text_to_jsonb',
  },
  {
    up: migration_20260715_181058_add_post_and_tag.up,
    down: migration_20260715_181058_add_post_and_tag.down,
    name: '20260715_181058_add_post_and_tag',
  },
  {
    up: migration_20260715_215834_rename_tag_visible_to_hidden.up,
    down: migration_20260715_215834_rename_tag_visible_to_hidden.down,
    name: '20260715_215834_rename_tag_visible_to_hidden',
  },
  {
    up: migration_20260716_010420_add_campaign_user.up,
    down: migration_20260716_010420_add_campaign_user.down,
    name: '20260716_010420_add_campaign_user',
  },
  {
    up: migration_20260718_010733_consolidate_campaign_schema.up,
    down: migration_20260718_010733_consolidate_campaign_schema.down,
    name: '20260718_010733_consolidate_campaign_schema',
  },
  {
    up: migration_20260718_190559_territorio_multi_municipio_bairro.up,
    down: migration_20260718_190559_territorio_multi_municipio_bairro.down,
    name: '20260718_190559_territorio_multi_municipio_bairro',
  },
  {
    up: migration_20260718_195854_add_election_results.up,
    down: migration_20260718_195854_add_election_results.down,
    name: '20260718_195854_add_election_results',
  },
  {
    up: migration_20260718_222656_add_supporter.up,
    down: migration_20260718_222656_add_supporter.down,
    name: '20260718_222656_add_supporter',
  },
  {
    up: migration_20260718_222832_add_action_plan.up,
    down: migration_20260718_222832_add_action_plan.down,
    name: '20260718_222832_add_action_plan',
  },
  {
    up: migration_20260719_011015_add_supporter_import_batch.up,
    down: migration_20260719_011015_add_supporter_import_batch.down,
    name: '20260719_011015_add_supporter_import_batch',
  },
  {
    up: migration_20260719_014906_action_plan_list_perf.up,
    down: migration_20260719_014906_action_plan_list_perf.down,
    name: '20260719_014906_action_plan_list_perf',
  },
  {
    up: migration_20260719_020000_add_contact_trgm_index.up,
    down: migration_20260719_020000_add_contact_trgm_index.down,
    name: '20260719_020000_add_contact_trgm_index',
  },
  {
    up: migration_20260719_054522_add_nucleus_goals_strategy.up,
    down: migration_20260719_054522_add_nucleus_goals_strategy.down,
    name: '20260719_054522_add_nucleus_goals_strategy',
  },
  {
    up: migration_20260719_054706_add_privacy_policy_global.up,
    down: migration_20260719_054706_add_privacy_policy_global.down,
    name: '20260719_054706_add_privacy_policy_global',
  },
  {
    up: migration_20260719_054707_seed_onda0_consent_and_privacy.up,
    down: migration_20260719_054707_seed_onda0_consent_and_privacy.down,
    name: '20260719_054707_seed_onda0_consent_and_privacy',
  },
  {
    up: migration_20260719_061302_add_campaign_user_avatar.up,
    down: migration_20260719_061302_add_campaign_user_avatar.down,
    name: '20260719_061302_add_campaign_user_avatar',
  },
  {
    up: migration_20260721_020109_remodel_plazas.up,
    down: migration_20260721_020109_remodel_plazas.down,
    name: '20260721_020109_remodel_plazas',
  },
  {
    up: migration_20260721_133444_add_plaza_expected_votes.up,
    down: migration_20260721_133444_add_plaza_expected_votes.down,
    name: '20260721_133444_add_plaza_expected_votes',
  },
  {
    up: migration_20260721_133531_add_petition_facebook_pixel_id.up,
    down: migration_20260721_133531_add_petition_facebook_pixel_id.down,
    name: '20260721_133531_add_petition_facebook_pixel_id',
  },
  {
    up: migration_20260723_025513_add_import_export_plugin.up,
    down: migration_20260723_025513_add_import_export_plugin.down,
    name: '20260723_025513_add_import_export_plugin',
  },
  {
    up: migration_20260723_124200_add_vote_estimate_scenarios.up,
    down: migration_20260723_124200_add_vote_estimate_scenarios.down,
    name: '20260723_124200_add_vote_estimate_scenarios',
  },
  {
    up: migration_20260723_200000_remodel_municipalities.up,
    down: migration_20260723_200000_remodel_municipalities.down,
    name: '20260723_200000_remodel_municipalities',
  },
  {
    up: migration_20260723_201000_add_state_deputy.up,
    down: migration_20260723_201000_add_state_deputy.down,
    name: '20260723_201000_add_state_deputy',
  },
  {
    up: migration_20260723_202000_reconcile_municipality_remodel.up,
    down: migration_20260723_202000_reconcile_municipality_remodel.down,
    name: '20260723_202000_reconcile_municipality_remodel',
  },
]
