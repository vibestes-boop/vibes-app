-- ═══════════════════════════════════════════════════════════════════════════
-- Migrations-Tracking begradigen — PRÜFUNG
--
-- 61 Migrationen (20260614190000 bis 20260716130000) gelten im Tracking als
-- nicht eingespielt, obwohl sie damals von Hand im SQL-Editor liefen. Bevor
-- sie als eingespielt markiert werden, muss belegt sein, dass ihr Inhalt
-- wirklich in der Datenbank steht — sonst wird eine echte Lücke für immer
-- unsichtbar.
--
-- Diese Abfrage LIEST NUR. Kein INSERT, kein UPDATE, kein DROP.
--
--   Ergebnis LEER   → alles eingespielt, Reparatur gefahrlos.
--   Ergebnis ZEILEN → genau diese Objekte fehlen. Die betroffene Migration
--                     NICHT markieren, sondern erst nachziehen.
-- ═══════════════════════════════════════════════════════════════════════════

WITH f(version, name) AS (VALUES
  ('20260619130000','buy_product'),
  ('20260624140000','enforce_sale_mode_admin'),
  ('20260624140000','express_product_interest'),
  ('20260624140000','get_my_preorder_summary'),
  ('20260624140000','get_product_preorders'),
  ('20260624140000','set_product_preorders_updated_at'),
  ('20260624160000','get_saved_products'),
  ('20260624160000','get_shop_products'),
  ('20260624170000','get_saved_products'),
  ('20260624170000','get_shop_products'),
  ('20260625120000','notify_preorder_buyers'),
  ('20260626120000','get_active_shop_banners'),
  ('20260627120000','set_product_orders_updated_at'),
  ('20260627130000','confirm_order_delivered'),
  ('20260627130000','mark_preorders_payable'),
  ('20260627130000','set_order_shipped'),
  ('20260627150000','cancel_product_order'),
  ('20260627150000','update_order_shipping_address'),
  ('20260627160000','mark_preorders_payable'),
  ('20260627170000','mark_preorders_payable'),
  ('20260627170000','set_order_shipped'),
  ('20260627180000','cancel_product_order'),
  ('20260627180000','update_order_shipping_address'),
  ('20260628100000','set_order_reviews_updated_at'),
  ('20260628100000','submit_order_review'),
  ('20260628110000','report_order_dispute'),
  ('20260628110000','resolve_order_dispute'),
  ('20260628110000','submit_order_review'),
  ('20260628120000','get_order_rating'),
  ('20260628130000','bump_product_sold_count'),
  ('20260628140000','mark_preorders_payable'),
  ('20260628150000','buy_product'),
  ('20260629170000','send_payment_reminders'),
  ('20260629180000','announce_preorder_round'),
  ('20260629190000','claim_referral'),
  ('20260629190000','get_my_referral_count'),
  ('20260629200000','announce_preorder_round'),
  ('20260630010000','fn_notify_seller_on_save'),
  ('20260701000000','update_dwell_times_batch'),
  ('20260701030000','get_vibe_feed'),
  ('20260701040000','notify_on_dm'),
  ('20260701050000','fn_send_push_on_notification'),
  ('20260702100000','assign_preorder_round'),
  ('20260702100000','close_preorder_round'),
  ('20260702100000','create_preorder_round'),
  ('20260702100000','get_active_preorder_round'),
  ('20260702120000','buy_product'),
  ('20260704100000','get_vibe_feed'),
  ('20260704100000','record_skip'),
  ('20260704100000','refresh_user_tag_affinity'),
  ('20260705120000','admin_remove_post'),
  ('20260705130000','admin_enforce_content_report'),
  ('20260705130000','admin_remove_post'),
  ('20260705140000','add_user_support_message'),
  ('20260705140000','admin_reply_support_thread'),
  ('20260705150000','create_support_thread'),
  ('20260707000000','block_user'),
  ('20260707000000','enforce_comment_not_blocked'),
  ('20260707000000','enforce_conversation_not_blocked'),
  ('20260707000000','enforce_follow_not_blocked'),
  ('20260707000000','enforce_message_not_blocked'),
  ('20260707000000','get_blocked_user_ids'),
  ('20260707000000','users_blocked'),
  ('20260707140000','enforce_single_owner_push_token'),
  ('20260707140000','enforce_single_owner_push_tokens_row'),
  ('20260716110000','get_active_preorder_round_public'),
  ('20260716120000','reschedule_preorder_round'),
  ('20260716130000','approve_women_only'),
  ('20260716130000','get_my_women_only_status'),
  ('20260716130000','get_women_only_requests'),
  ('20260716130000','guard_women_only_verified'),
  ('20260716130000','leave_women_only'),
  ('20260716130000','reject_women_only'),
  ('20260716130000','request_women_only'),
  ('20260716130000','revoke_women_only')
), p(version, name, sch, tbl) AS (VALUES
  ('20260619120000','digital_products_delete_own','storage','objects'),
  ('20260619120000','digital_products_insert_own','storage','objects'),
  ('20260619120000','digital_products_read','storage','objects'),
  ('20260619120000','digital_products_update_own','storage','objects'),
  ('20260621121000','notif_insert_own_sender','public','notifications'),
  ('20260621130000','comments_insert_policy','public','comments'),
  ('20260624140000','preorders_owner_all','public','product_preorders'),
  ('20260624140000','preorders_seller_read','public','product_preorders'),
  ('20260625130000','chat_images_delete_own','storage','objects'),
  ('20260625130000','chat_images_insert_own','storage','objects'),
  ('20260625130000','chat_images_update_own','storage','objects'),
  ('20260626120000','shop_banners_admin_all','public','shop_banners'),
  ('20260626120000','shop_banners_read','public','shop_banners'),
  ('20260627120000','product_orders_party_read','public','product_orders'),
  ('20260627120000','product_orders_service_write','public','product_orders'),
  ('20260627120000','seller_accounts_service_write','public','seller_accounts'),
  ('20260628100000','order_reviews_party_read','public','order_reviews'),
  ('20260628110000','order_disputes_read','public','order_disputes'),
  ('20260702100000','preorder_rounds_read','public','preorder_rounds'),
  ('20260704100000','user_tag_affinity_select_own','public','user_tag_affinity'),
  ('20260710140000','seller_accounts_read_own','public','seller_accounts'),
  ('20260716100000','live_sessions_select_with_women_only','public','live_sessions'),
  ('20260716130000','woz_requests_select_own','public','women_only_requests')
-- Später ersetzte Policies stehen hier bewusst NICHT: Ihr Fehlen ist der
-- Beleg, dass die Nachfolge-Migration gelaufen ist, kein Loch.
), i(version, name) AS (VALUES
  ('20260617220000','idx_posts_bunny_pending'),
  ('20260617220000','idx_posts_bunny_video_id'),
  ('20260621140000','idx_live_sessions_followers_only'),
  ('20260624140000','idx_preorders_product'),
  ('20260624140000','idx_preorders_user'),
  ('20260624140000','idx_products_sale_mode'),
  ('20260626120000','idx_shop_banners_active'),
  ('20260627120000','idx_product_orders_buyer'),
  ('20260627120000','idx_product_orders_seller'),
  ('20260627120000','idx_product_orders_session'),
  ('20260627120000','idx_product_orders_status'),
  ('20260628100000','idx_order_reviews_order'),
  ('20260628100000','idx_order_reviews_reviewee'),
  ('20260628110000','idx_order_disputes_order'),
  ('20260628110000','idx_order_disputes_status'),
  ('20260629160000','idx_posts_product_id'),
  ('20260629190000','idx_profiles_referred_by'),
  ('20260702100000','idx_preorder_rounds_one_open'),
  ('20260702100000','idx_preorder_rounds_status'),
  ('20260702100000','idx_preorders_round'),
  ('20260716130000','idx_woz_requests_pending')
), b(version, name) AS (VALUES
  ('20260619120000','digital-products'),
  ('20260625130000','chat-images')
), di(version, name) AS (VALUES
  ('20260617193000','comment_likes_comment_idx'),
  ('20260617193000','idx_follows_follower_following'),
  ('20260617193000','idx_live_comments_session'),
  ('20260617193000','idx_live_sessions_host'),
  ('20260617193000','idx_notifications_recipient_read'),
  ('20260617193000','notifications_recipient_idx')
), df(version, name) AS (VALUES
  ('20260621120000','add_test_coins'),
  ('20260621120000','debug_send_gift'),
  ('20260701010000','trigger_push_notification')
), nn(version, tbl, col) AS (VALUES
  ('20260624150000','orders','product_id')
)
SELECT 'Funktion fehlt' AS befund, version, name AS objekt FROM f
  WHERE name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_proc pr
    JOIN pg_namespace n ON n.oid=pr.pronamespace
    WHERE n.nspname='public' AND pr.proname=f.name)
UNION ALL
SELECT 'Policy fehlt', version, sch||'.'||tbl||' / '||name FROM p
  WHERE name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname=p.sch AND tablename=p.tbl AND policyname=p.name)
UNION ALL
SELECT 'Index fehlt', version, name FROM i
  WHERE name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname=i.name)
UNION ALL
SELECT 'Eimer fehlt', version, name FROM b
  WHERE name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id=b.name)
UNION ALL
SELECT 'Index nicht geloescht', version, name FROM di
  WHERE name IS NOT NULL AND EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname=di.name)
UNION ALL
SELECT 'Funktion noch da (haette geloescht sein muessen)', version, name FROM df
  WHERE name IS NOT NULL AND EXISTS (SELECT 1 FROM pg_proc pr
    JOIN pg_namespace n ON n.oid=pr.pronamespace
    WHERE n.nspname='public' AND pr.proname=df.name)
UNION ALL
SELECT 'Spalte noch NOT NULL', version, tbl||'.'||col FROM nn
  WHERE tbl IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=nn.tbl AND column_name=nn.col
      AND is_nullable='NO')
ORDER BY 2, 1, 3;
