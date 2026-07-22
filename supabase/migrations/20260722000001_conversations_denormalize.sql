-- =========================================================================
-- conversations — denormalize last message + unread counts
-- =========================================================================
-- Adds denormalized columns so the messages list can render previews
-- and unread badges without a second query.
--
-- Columns added:
--   - last_message_body      text — preview of the most recent message
--   - last_message_kind      message_kind — user or system
--   - last_message_sender_id uuid — who sent the last message
--   - host_unread_count      int — messages the host hasn't read
--   - renter_unread_count    int — messages the renter hasn't read
--
-- The existing `update_conversation_last_message` trigger is extended
-- to write ALL of these in a single atomic UPDATE per message insert.
-- =========================================================================

-- 1. New columns
ALTER TABLE public.conversations
  ADD COLUMN last_message_body      text,
  ADD COLUMN last_message_kind     message_kind,
  ADD COLUMN last_message_sender_id uuid REFERENCES public.profiles(id),
  ADD COLUMN host_unread_count     int NOT NULL DEFAULT 0,
  ADD COLUMN renter_unread_count   int NOT NULL DEFAULT 0;

-- 2. Unified trigger: last message preview + unread counters
--    Fires AFTER INSERT on messages (existing trg_message_inserted).
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
     SET last_message_at        = new.created_at,
         last_message_body      = new.body,
         last_message_kind      = new.kind,
         last_message_sender_id = new.sender_id,
         host_unread_count = CASE
           WHEN renter_id = new.sender_id THEN host_unread_count + 1
           ELSE host_unread_count
         END,
         renter_unread_count = CASE
           WHEN host_id = new.sender_id THEN renter_unread_count + 1
           ELSE renter_unread_count
         END
   WHERE id = new.conversation_id;
  RETURN new;
END;
$$;
