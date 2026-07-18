import * as migration_20260715_163458_initial from './20260715_163458_initial';
import * as migration_20260715_163500_consent_text_to_jsonb from './20260715_163500_consent_text_to_jsonb';
import * as migration_20260715_181058_add_post_and_tag from './20260715_181058_add_post_and_tag';
import * as migration_20260715_215834_rename_tag_visible_to_hidden from './20260715_215834_rename_tag_visible_to_hidden';
import * as migration_20260716_010420_add_campaign_user from './20260716_010420_add_campaign_user';
import * as migration_20260718_010733_consolidate_campaign_schema from './20260718_010733_consolidate_campaign_schema';

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
];
