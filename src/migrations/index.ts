import * as migration_20260715_163458_initial from './20260715_163458_initial';
import * as migration_20260715_163500_consent_text_to_jsonb from './20260715_163500_consent_text_to_jsonb';
import * as migration_20260715_181058_add_post_and_tag from './20260715_181058_add_post_and_tag';
import * as migration_20260715_215834_rename_tag_visible_to_hidden from './20260715_215834_rename_tag_visible_to_hidden';
import * as migration_20260716_010420_add_campaign_user from './20260716_010420_add_campaign_user';
import * as migration_20260718_010733_consolidate_campaign_schema from './20260718_010733_consolidate_campaign_schema';
import * as migration_20260718_190559_territorio_multi_municipio_bairro from './20260718_190559_territorio_multi_municipio_bairro';
import * as migration_20260718_195854_add_election_results from './20260718_195854_add_election_results';
import * as migration_20260718_222656_add_supporter from './20260718_222656_add_supporter';
import * as migration_20260718_222832_add_action_plan from './20260718_222832_add_action_plan';
import * as migration_20260719_011015_add_supporter_import_batch from './20260719_011015_add_supporter_import_batch';
import * as migration_20260719_014906_action_plan_list_perf from './20260719_014906_action_plan_list_perf';
import * as migration_20260719_020000_add_contact_trgm_index from './20260719_020000_add_contact_trgm_index';
import * as migration_20260719_054522_add_nucleus_goals_strategy from './20260719_054522_add_nucleus_goals_strategy';
import * as migration_20260719_054706_add_privacy_policy_global from './20260719_054706_add_privacy_policy_global';
import * as migration_20260719_054707_seed_onda0_consent_and_privacy from './20260719_054707_seed_onda0_consent_and_privacy';
import * as migration_20260719_061302_add_campaign_user_avatar from './20260719_061302_add_campaign_user_avatar';
import * as migration_20260721_020109_remodel_plazas from './20260721_020109_remodel_plazas';
import * as migration_20260721_133444_add_plaza_expected_votes from './20260721_133444_add_plaza_expected_votes';
import * as migration_20260721_133531_add_petition_facebook_pixel_id from './20260721_133531_add_petition_facebook_pixel_id';
import * as migration_20260723_025513_add_import_export_plugin from './20260723_025513_add_import_export_plugin';
import * as migration_20260723_124200_add_vote_estimate_scenarios from './20260723_124200_add_vote_estimate_scenarios';
import * as migration_20260723_200000_remodel_municipalities from './20260723_200000_remodel_municipalities';
import * as migration_20260723_201000_add_state_deputy from './20260723_201000_add_state_deputy';
import * as migration_20260723_202000_reconcile_municipality_remodel from './20260723_202000_reconcile_municipality_remodel';
import * as migration_20260724_133600_drop_municipality_vote_goals from './20260724_133600_drop_municipality_vote_goals';
import * as migration_20260724_175500_contact_phone_optional from './20260724_175500_contact_phone_optional';
import * as migration_20260724_180000_add_campaign_foundation_records from './20260724_180000_add_campaign_foundation_records';
import * as migration_20260724_180000_add_campaign_goals_global from './20260724_180000_add_campaign_goals_global';
import * as migration_20260725_022155_add_municipality_budget_notes from './20260725_022155_add_municipality_budget_notes';
import * as migration_20260725_170000_whatsapp_subscription_consent_key from './20260725_170000_whatsapp_subscription_consent_key';
import * as migration_20260725_213000_rename_action_plan_to_activity from './20260725_213000_rename_action_plan_to_activity';
import * as migration_20260727_032523_add_users_roles from './20260727_032523_add_users_roles';
import * as migration_20260727_161752_add_municipality_engagement_level from './20260727_161752_add_municipality_engagement_level';
import * as migration_20260728_041547_add_allocation_decision_adiada_outcome from './20260728_041547_add_allocation_decision_adiada_outcome';
import * as migration_20260728_041958_add_campaign_webauthn_credentials from './20260728_041958_add_campaign_webauthn_credentials';
import * as migration_20260730_010601_simplify_municipality_signal_fields from './20260730_010601_simplify_municipality_signal_fields';
import * as migration_20260730_043306_simplify_leadership_fields from './20260730_043306_simplify_leadership_fields';
import * as migration_20260731_014319_add_campaign_notifications from './20260731_014319_add_campaign_notifications';
import * as migration_20260801_062558_add_campaign_vote_summary_snapshot from './20260801_062558_add_campaign_vote_summary_snapshot';
import * as migration_20260802_230000_strip_engagement_reversal_signals from './20260802_230000_strip_engagement_reversal_signals';
import * as migration_20260804_061017_add_state_deputy_advisors from './20260804_061017_add_state_deputy_advisors';
import * as migration_20260806_082110_add_state_deputy_contact from './20260806_082110_add_state_deputy_contact';
import * as migration_20260806_120000_c14_remodel_activity_agenda from './20260806_120000_c14_remodel_activity_agenda';
import * as migration_20260807_030000_unify_municipality_update from './20260807_030000_unify_municipality_update';
import * as migration_20260808_134911_add_calendar_feed from './20260808_134911_add_calendar_feed';
import * as migration_20260808_184113_remodel_activity_responsible from './20260808_184113_remodel_activity_responsible';

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
  {
    up: migration_20260724_133600_drop_municipality_vote_goals.up,
    down: migration_20260724_133600_drop_municipality_vote_goals.down,
    name: '20260724_133600_drop_municipality_vote_goals',
  },
  {
    up: migration_20260724_175500_contact_phone_optional.up,
    down: migration_20260724_175500_contact_phone_optional.down,
    name: '20260724_175500_contact_phone_optional',
  },
  {
    up: migration_20260724_180000_add_campaign_foundation_records.up,
    down: migration_20260724_180000_add_campaign_foundation_records.down,
    name: '20260724_180000_add_campaign_foundation_records',
  },
  {
    up: migration_20260724_180000_add_campaign_goals_global.up,
    down: migration_20260724_180000_add_campaign_goals_global.down,
    name: '20260724_180000_add_campaign_goals_global',
  },
  {
    up: migration_20260725_022155_add_municipality_budget_notes.up,
    down: migration_20260725_022155_add_municipality_budget_notes.down,
    name: '20260725_022155_add_municipality_budget_notes',
  },
  {
    up: migration_20260725_170000_whatsapp_subscription_consent_key.up,
    down: migration_20260725_170000_whatsapp_subscription_consent_key.down,
    name: '20260725_170000_whatsapp_subscription_consent_key',
  },
  {
    up: migration_20260725_213000_rename_action_plan_to_activity.up,
    down: migration_20260725_213000_rename_action_plan_to_activity.down,
    name: '20260725_213000_rename_action_plan_to_activity',
  },
  {
    up: migration_20260727_032523_add_users_roles.up,
    down: migration_20260727_032523_add_users_roles.down,
    name: '20260727_032523_add_users_roles',
  },
  {
    up: migration_20260727_161752_add_municipality_engagement_level.up,
    down: migration_20260727_161752_add_municipality_engagement_level.down,
    name: '20260727_161752_add_municipality_engagement_level',
  },
  {
    up: migration_20260728_041547_add_allocation_decision_adiada_outcome.up,
    down: migration_20260728_041547_add_allocation_decision_adiada_outcome.down,
    name: '20260728_041547_add_allocation_decision_adiada_outcome',
  },
  {
    up: migration_20260728_041958_add_campaign_webauthn_credentials.up,
    down: migration_20260728_041958_add_campaign_webauthn_credentials.down,
    name: '20260728_041958_add_campaign_webauthn_credentials',
  },
  {
    up: migration_20260730_010601_simplify_municipality_signal_fields.up,
    down: migration_20260730_010601_simplify_municipality_signal_fields.down,
    name: '20260730_010601_simplify_municipality_signal_fields',
  },
  {
    up: migration_20260730_043306_simplify_leadership_fields.up,
    down: migration_20260730_043306_simplify_leadership_fields.down,
    name: '20260730_043306_simplify_leadership_fields',
  },
  {
    up: migration_20260731_014319_add_campaign_notifications.up,
    down: migration_20260731_014319_add_campaign_notifications.down,
    name: '20260731_014319_add_campaign_notifications',
  },
  {
    up: migration_20260801_062558_add_campaign_vote_summary_snapshot.up,
    down: migration_20260801_062558_add_campaign_vote_summary_snapshot.down,
    name: '20260801_062558_add_campaign_vote_summary_snapshot',
  },
  {
    up: migration_20260802_230000_strip_engagement_reversal_signals.up,
    down: migration_20260802_230000_strip_engagement_reversal_signals.down,
    name: '20260802_230000_strip_engagement_reversal_signals',
  },
  {
    up: migration_20260804_061017_add_state_deputy_advisors.up,
    down: migration_20260804_061017_add_state_deputy_advisors.down,
    name: '20260804_061017_add_state_deputy_advisors',
  },
  {
    up: migration_20260806_082110_add_state_deputy_contact.up,
    down: migration_20260806_082110_add_state_deputy_contact.down,
    name: '20260806_082110_add_state_deputy_contact',
  },
  {
    up: migration_20260806_120000_c14_remodel_activity_agenda.up,
    down: migration_20260806_120000_c14_remodel_activity_agenda.down,
    name: '20260806_120000_c14_remodel_activity_agenda',
  },
  {
    up: migration_20260807_030000_unify_municipality_update.up,
    down: migration_20260807_030000_unify_municipality_update.down,
    name: '20260807_030000_unify_municipality_update',
  },
  {
    up: migration_20260808_134911_add_calendar_feed.up,
    down: migration_20260808_134911_add_calendar_feed.down,
    name: '20260808_134911_add_calendar_feed',
  },
  {
    up: migration_20260808_184113_remodel_activity_responsible.up,
    down: migration_20260808_184113_remodel_activity_responsible.down,
    name: '20260808_184113_remodel_activity_responsible'
  },
];
