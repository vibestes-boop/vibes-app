# Live-Datenbankschema (Source of Truth)

> Auto-generiert aus `supabase/schema_live.sql` (pg_dump der Live-DB `llymwqfgujwkoxzqxrlm`).
> **78 Tabellen.** Vor jeder Code-Spaltenreferenz hier prüfen — verhindert Bugs wie das fehlende `profiles.follower_count`.
> Neu generieren: `pg_dump … --schema=public --schema-only -f supabase/schema_live.sql` + dieses Skript.

### admin_audit_log (7)
- `id uuid`
- `actor_id uuid`
- `action text`
- `target_type text`
- `target_id uuid`
- `metadata jsonb`
- `created_at timestamp`

### admin_campaign_daily_metrics (10)
- `id uuid`
- `campaign_id uuid`
- `metric_date date`
- `impressions bigint`
- `clicks bigint`
- `conversions bigint`
- `revenue_cents bigint`
- `spend_cents bigint`
- `created_at timestamp`
- `updated_at timestamp`

### admin_campaigns (12)
- `id uuid`
- `title text`
- `channel text`
- `status text`
- `target_metric text`
- `budget_cents bigint`
- `spend_cents bigint`
- `starts_at timestamp`
- `ends_at timestamp`
- `created_by uuid`
- `created_at timestamp`
- `updated_at timestamp`

### admin_region_daily_metrics (13)
- `id uuid`
- `country_code text`
- `country_name text`
- `metric_date date`
- `active_users bigint`
- `new_registrations bigint`
- `posts bigint`
- `views bigint`
- `reports bigint`
- `source text`
- `created_at timestamp`
- `updated_at timestamp`
- `total_profiles bigint`

### admin_support_messages (8)
- `id uuid`
- `thread_id uuid`
- `sender_type text`
- `sender_id uuid`
- `body text`
- `metadata jsonb`
- `read_at timestamp`
- `created_at timestamp`

### admin_support_threads (13)
- `id uuid`
- `source text`
- `user_id uuid`
- `subject text`
- `status text`
- `priority text`
- `assigned_admin_id uuid`
- `last_message_at timestamp`
- `resolved_at timestamp`
- `resolved_by uuid`
- `metadata jsonb`
- `created_at timestamp`
- `updated_at timestamp`

### ai_image_generations (12)
- `id uuid`
- `user_id uuid`
- `purpose public.ai_image_purpose`
- `prompt text`
- `model text`
- `image_url text`
- `storage_path text`
- `size text`
- `cost_cents integer`
- `error text`
- `created_at timestamp`
- `consumed_at timestamp`

### algo_experiments (8)
- `id uuid`
- `name text`
- `description text`
- `is_active boolean`
- `control_params jsonb`
- `treatment_params jsonb`
- `created_at timestamp`
- `ended_at timestamp`

### algo_user_variants (4)
- `user_id uuid`
- `experiment_name text`
- `variant text`
- `assigned_at timestamp`

### bookmarks (4)
- `id uuid`
- `user_id uuid`
- `post_id uuid`
- `created_at timestamp`

### coin_pricing_tiers (10)
- `id text`
- `coins integer`
- `bonus_coins integer`
- `price_cents integer`
- `currency text`
- `stripe_price_id text`
- `badge_label text`
- `sort_order integer`
- `active boolean`
- `created_at timestamp`

### coin_purchases (8)
- `id uuid`
- `user_id uuid`
- `product_id text`
- `coins_credited integer`
- `transaction_id text`
- `event_type text`
- `raw_event jsonb`
- `created_at timestamp`

### coins_wallets (5)
- `user_id uuid`
- `coins integer`
- `diamonds integer`
- `total_gifted integer`
- `updated_at timestamp`

### comment_likes (4)
- `id uuid`
- `comment_id uuid`
- `user_id uuid`
- `created_at timestamp`

### comments (6)
- `id uuid`
- `post_id uuid`
- `user_id uuid`
- `text text`
- `created_at timestamp`
- `parent_id uuid`

### content_reports (10)
- `id uuid`
- `reporter_id uuid`
- `target_type text`
- `target_id uuid`
- `reason text`
- `status text`
- `admin_note text`
- `reviewed_by uuid`
- `reviewed_at timestamp`
- `created_at timestamp`

### conversations (5)
- `id uuid`
- `participant_1 uuid`
- `participant_2 uuid`
- `last_message_at timestamp`
- `created_at timestamp`

### creator_tips (6)
- `id uuid`
- `sender_id uuid`
- `recipient_id uuid`
- `coin_amount integer`
- `message text`
- `created_at timestamp`

### feature_flags (5)
- `flag_key text`
- `enabled boolean`
- `description text`
- `updated_at timestamp`
- `updated_by uuid`

### follow_requests (4)
- `id uuid`
- `sender_id uuid`
- `receiver_id uuid`
- `created_at timestamp`

### follows (4)
- `id uuid`
- `follower_id uuid`
- `following_id uuid`
- `created_at timestamp`

### gift_catalog (12)
- `id text`
- `name text`
- `emoji text`
- `coin_cost integer`
- `diamond_value integer`
- `lottie_url text`
- `color text`
- `sort_order integer`
- `rarity text`
- `season_tag text`
- `available_from timestamp`
- `available_until timestamp`

### gift_transactions (8)
- `id uuid`
- `sender_id uuid`
- `recipient_id uuid`
- `live_session_id text`
- `gift_id text`
- `coin_cost integer`
- `diamond_value integer`
- `created_at timestamp`

### guilds (6)
- `id uuid`
- `name text`
- `description text`
- `member_count integer`
- `vibe_tags text[]`
- `created_at timestamp`

### likes (4)
- `id uuid`
- `post_id uuid`
- `user_id uuid`
- `created_at timestamp`

### live_battle_history (9)
- `id uuid`
- `session_id uuid`
- `host_id uuid`
- `guest_id uuid`
- `host_score integer`
- `guest_score integer`
- `winner text`
- `duration_secs integer`
- `ended_at timestamp`

### live_chat_timeouts (5)
- `session_id uuid`
- `user_id uuid`
- `until_at timestamp`
- `reason text`
- `created_at timestamp`

### live_clip_markers (6)
- `id uuid`
- `session_id uuid`
- `user_id uuid`
- `ts_secs integer`
- `note text`
- `created_at timestamp`

### live_cohost_blocks (5)
- `host_id uuid`
- `blocked_user_id uuid`
- `created_at timestamp`
- `expires_at timestamp`
- `reason text`

### live_cohosts (6)
- `session_id uuid`
- `user_id uuid`
- `invited_by uuid`
- `approved_at timestamp`
- `revoked_at timestamp`
- `slot_index integer`

### live_comments (6)
- `id uuid`
- `session_id uuid`
- `user_id uuid`
- `text text`
- `created_at timestamp`
- `pinned boolean`

### live_duet_history (11)
- `id uuid`
- `session_id uuid`
- `host_id uuid`
- `guest_id uuid`
- `initiated_by text`
- `layout text`
- `started_at timestamp`
- `ended_at timestamp`
- `duration_secs integer`
- `gift_coins_total integer`
- `end_reason text`

### live_duet_invites (13)
- `id uuid`
- `session_id uuid`
- `host_id uuid`
- `invitee_id uuid`
- `direction text`
- `layout text`
- `battle_duration integer`
- `message text`
- `status text`
- `decline_reason text`
- `created_at timestamp`
- `expires_at timestamp`
- `responded_at timestamp`

### live_moderators (4)
- `session_id uuid`
- `user_id uuid`
- `granted_by uuid`
- `created_at timestamp`

### live_placed_products (9)
- `id uuid`
- `session_id uuid`
- `host_id uuid`
- `product_id uuid`
- `position_x real`
- `position_y real`
- `created_at timestamp`
- `updated_at timestamp`
- `removed_at timestamp`

### live_poll_votes (4)
- `poll_id uuid`
- `user_id uuid`
- `option_index integer`
- `created_at timestamp`

### live_polls (7)
- `id uuid`
- `session_id uuid`
- `host_id uuid`
- `question text`
- `options jsonb`
- `created_at timestamp`
- `closed_at timestamp`

### live_reactions (5)
- `id uuid`
- `session_id uuid`
- `user_id uuid`
- `emoji text`
- `created_at timestamp`

### live_recordings (16)
- `id uuid`
- `session_id uuid`
- `host_id uuid`
- `egress_id text`
- `status text`
- `error_message text`
- `file_url text`
- `file_path text`
- `file_size_bytes bigint`
- `duration_secs integer`
- `thumbnail_url text`
- `is_public boolean`
- `view_count integer`
- `started_at timestamp`
- `finished_at timestamp`
- `created_at timestamp`

### live_reports (5)
- `id uuid`
- `session_id uuid`
- `reporter_id uuid`
- `reason text`
- `created_at timestamp`

### live_session_viewers (3)
- `session_id uuid`
- `user_id uuid`
- `joined_at timestamp`

### live_sessions (37)
- `id uuid`
- `host_id uuid`
- `title text`
- `status text`
- `viewer_count integer`
- `peak_viewers integer`
- `room_name text`
- `started_at timestamp`
- `ended_at timestamp`
- `like_count integer`
- `comment_count integer`
- `pinned_comment jsonb`
- `replay_url text`
- `is_replayable boolean`
- `replay_views integer`
- `thumbnail_url text`
- `category text`
- `moderation_enabled boolean`
- `moderation_words text[]`
- `goal_type text`
- `goal_target integer`
- `goal_current integer`
- `goal_title text`
- `goal_reached boolean`
- `allow_comments boolean`
- `allow_gifts boolean`
- `women_only boolean`
- `followers_only_chat boolean`
- `slow_mode_seconds integer`
- `updated_at timestamp`
- `recording_enabled boolean`
- `recording_id uuid`
- `shop_enabled boolean`
- `ingress_id text`
- `ingress_url text`
- `ingress_stream_key text`
- `ingress_type text`

### live_stickers (11)
- `id uuid`
- `session_id uuid`
- `host_id uuid`
- `emoji text`
- `position_x real`
- `position_y real`
- `scale real`
- `rotation real`
- `created_at timestamp`
- `updated_at timestamp`
- `removed_at timestamp`

### live_viewer_welcomes (4)
- `session_id uuid`
- `user_id uuid`
- `tier text`
- `created_at timestamp`

### message_reactions (5)
- `id uuid`
- `message_id uuid`
- `user_id uuid`
- `emoji text`
- `created_at timestamp`

### messages (11)
- `id uuid`
- `conversation_id uuid`
- `sender_id uuid`
- `content text`
- `read boolean`
- `created_at timestamp`
- `post_id uuid`
- `reply_to_id uuid`
- `image_url text`
- `story_media_url text`
- `story_author text`

### moderation_auto_flags (7)
- `id uuid`
- `target_type text`
- `target_id uuid`
- `reason text`
- `confidence numeric`
- `signals jsonb`
- `created_at timestamp`

### muted_live_hosts (3)
- `user_id uuid`
- `host_id uuid`
- `created_at timestamp`

### notifications (14)
- `id uuid`
- `recipient_id uuid`
- `sender_id uuid`
- `type text`
- `post_id uuid`
- `comment_text text`
- `read boolean`
- `created_at timestamp`
- `session_id uuid`
- `comment_id uuid`
- `conversation_id uuid`
- `gift_name text`
- `gift_emoji text`
- `product_name text`

### orders (10)
- `id uuid`
- `buyer_id uuid`
- `seller_id uuid`
- `product_id uuid`
- `quantity integer`
- `total_coins integer`
- `status text`
- `delivery_notes text`
- `download_url text`
- `created_at timestamp`

### payout_requests (11)
- `id uuid`
- `creator_id uuid`
- `diamonds_amount bigint`
- `euro_amount numeric(10,2)`
- `iban text`
- `paypal_email text`
- `note text`
- `status text`
- `admin_note text`
- `created_at timestamp`
- `processed_at timestamp`

### post_drafts (10)
- `id uuid`
- `author_id uuid`
- `caption text`
- `tags text[]`
- `media_type text`
- `media_url text`
- `thumbnail_url text`
- `settings jsonb`
- `created_at timestamp`
- `updated_at timestamp`

### post_dwell_log (4)
- `user_id uuid`
- `post_id uuid`
- `last_seen timestamp`
- `view_count integer`

### post_reports (5)
- `id uuid`
- `reporter_id uuid`
- `post_id uuid`
- `reason text`
- `created_at timestamp`

### post_views (4)
- `id uuid`
- `post_id uuid`
- `user_id uuid`
- `viewed_at timestamp`

### post_views_log (3)
- `post_id uuid`
- `user_id uuid`
- `viewed_at timestamp`

### posts (30)
- `id uuid`
- `author_id uuid`
- `caption text`
- `media_url text`
- `media_type text`
- `dwell_time_score double`
- `tags text[]`
- `guild_id uuid`
- `is_guild_post boolean`
- `created_at timestamp`
- `score_explore double`
- `score_brain double`
- `view_count integer`
- `is_pinned boolean`
- `comment_count integer`
- `like_count integer`
- `bookmark_count integer`
- `thumbnail_url text`
- `privacy text`
- `allow_comments boolean`
- `allow_download boolean`
- `allow_duet boolean`
- `cover_time_ms integer`
- `audio_url text`
- `audio_volume real`
- `is_flagged boolean`
- `flag_reason text`
- `is_visible boolean`
- `women_only boolean`
- `aspect_ratio text`

### product_reviews (7)
- `id uuid`
- `product_id uuid`
- `reviewer_id uuid`
- `order_id uuid`
- `rating smallint`
- `comment text`
- `created_at timestamp`

### products (20)
- `id uuid`
- `seller_id uuid`
- `title text`
- `description text`
- `price_coins integer`
- `category text`
- `cover_url text`
- `file_url text`
- `is_active boolean`
- `stock integer`
- `women_only boolean`
- `sold_count integer`
- `created_at timestamp`
- `updated_at timestamp`
- `image_urls text[]`
- `avg_rating numeric(3,2)`
- `review_count integer`
- `sale_price_coins integer`
- `free_shipping boolean`
- `location text`

### profiles (37)
- `id uuid`
- `username text`
- `bio text`
- `avatar_url text`
- `guild_id uuid`
- `explore_vibe double`
- `brain_vibe double`
- `created_at timestamp`
- `expo_push_token text`
- `onboarding_complete boolean`
- `push_token text`
- `preferred_tags text[]`
- `is_private boolean`
- `consistency_score double`
- `website text`
- `voice_sample_url text`
- `is_verified boolean`
- `teip text`
- `gender text`
- `women_only_verified boolean`
- `verification_level integer`
- `is_admin boolean`
- `is_creator boolean`
- `display_name text`
- `notif_prefs jsonb`
- `is_banned boolean`
- `is_restricted boolean`
- `restricted_until timestamp`
- `is_shadow_banned boolean`
- `is_moderator boolean`
- `is_operator boolean`
- `is_creator_ops boolean`
- `country_code text`
- `country_name text`
- `city text`
- `region_name text`
- `location_consent_at timestamp`

### push_tokens (6)
- `id uuid`
- `user_id uuid`
- `token text`
- `platform text`
- `last_seen_at timestamp`
- `created_at timestamp`

### r2_delete_queue (10)
- `id uuid`
- `post_id uuid`
- `author_id uuid`
- `media_url text`
- `thumbnail_url text`
- `status text`
- `attempts integer`
- `last_error text`
- `created_at timestamp`
- `processed_at timestamp`

### reposts (4)
- `id uuid`
- `user_id uuid`
- `post_id uuid`
- `created_at timestamp`

### saved_products (4)
- `id uuid`
- `user_id uuid`
- `product_id uuid`
- `created_at timestamp`

### scheduled_lives (13)
- `id uuid`
- `host_id uuid`
- `title text`
- `description text`
- `scheduled_at timestamp`
- `status text`
- `allow_comments boolean`
- `allow_gifts boolean`
- `women_only boolean`
- `session_id uuid`
- `reminded_at timestamp`
- `created_at timestamp`
- `updated_at timestamp`

### scheduled_posts (25)
- `id uuid`
- `author_id uuid`
- `caption text`
- `media_url text`
- `media_type text`
- `thumbnail_url text`
- `tags text[]`
- `is_guild_post boolean`
- `guild_id uuid`
- `audio_url text`
- `audio_volume numeric`
- `privacy text`
- `allow_comments boolean`
- `allow_download boolean`
- `allow_duet boolean`
- `women_only boolean`
- `cover_time_ms integer`
- `publish_at timestamp`
- `status text`
- `retries integer`
- `last_error text`
- `published_post_id uuid`
- `created_at timestamp`
- `updated_at timestamp`
- `aspect_ratio text`

### stories (8)
- `id uuid`
- `user_id uuid`
- `media_url text`
- `media_type text`
- `created_at timestamp`
- `interactive jsonb`
- `archived boolean`
- `thumbnail_url text`

### story_comments (6)
- `id uuid`
- `story_id uuid`
- `author_id uuid`
- `content text`
- `is_emoji boolean`
- `created_at timestamp`

### story_highlights (10)
- `id uuid`
- `user_id uuid`
- `story_id uuid`
- `title text`
- `created_at timestamp`
- `media_url text`
- `media_type text`
- `post_id uuid`
- `thumbnail_url text`
- `items jsonb`

### story_likes (4)
- `id uuid`
- `story_id uuid`
- `user_id uuid`
- `created_at timestamp`

### story_views (4)
- `id uuid`
- `story_id uuid`
- `user_id uuid`
- `viewed_at timestamp`

### story_votes (5)
- `id uuid`
- `story_id uuid`
- `user_id uuid`
- `option_idx integer`
- `created_at timestamp`

### user_blocks (3)
- `blocker_id uuid`
- `blocked_id uuid`
- `created_at timestamp`

### user_reports (6)
- `id uuid`
- `reporter_id uuid`
- `reported_id uuid`
- `reason text`
- `note text`
- `created_at timestamp`

### user_vibe_profile (5)
- `user_id uuid`
- `learned_explore double`
- `learned_brain double`
- `interaction_count integer`
- `updated_at timestamp`

### user_whip_ingresses (7)
- `user_id uuid`
- `ingress_id text`
- `ingress_url text`
- `stream_key text`
- `room_name text`
- `created_at timestamp`
- `updated_at timestamp`

### web_coin_orders (16)
- `id uuid`
- `user_id uuid`
- `tier_id text`
- `coins integer`
- `bonus_coins integer`
- `price_cents integer`
- `currency text`
- `status public.coin_order_status`
- `stripe_session_id text`
- `stripe_payment_intent text`
- `invoice_url text`
- `receipt_url text`
- `paid_at timestamp`
- `failed_reason text`
- `created_at timestamp`
- `updated_at timestamp`

### web_push_subscriptions (9)
- `id uuid`
- `user_id uuid`
- `endpoint text`
- `p256dh text`
- `auth text`
- `user_agent text`
- `device_label text`
- `created_at timestamp`
- `last_seen_at timestamp`

