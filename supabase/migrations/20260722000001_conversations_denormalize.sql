-- =========================================================================
-- conversations — denormalize last message body + kind
-- =========================================================================
-- Adds `last_message_body`, `last_message_kind`, and
-- `last_message_sender_id` to `conversations` so the messages list
-- can render a preview without a second query. The existing
-- `update_conversation_last_message` trigger is extended to also
-- write these columns on every INSERT into `messages`.
--
-- `unread_count` is NOT denormalized here — it requires a
-- `conversation_reads` table and is deferred to a future phase.
-- =========================================================================

-- 1. New columns
ALTER TABLE public.conversations
  ADD COLUMN last_message_body      text,
  ADD COLUMN last_message_kind     message_kind,
  ADD COLUMN last_message_sender_id uuid REFERENCES public.profiles(id);

-- 2. Extend the existing trigger function to also write the new columns.
--    The trigger `trg_message_inserted` (AFTER INSERT on messages)
--    already exists from 20260719000007_triggers.sql — we only
--    replace the function body.
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
         last_message_sender_id = new.sender_id
   WHERE id = new.conversation_id;
  RETURN new;
END;
$$;
