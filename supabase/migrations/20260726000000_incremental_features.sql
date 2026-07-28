-- =========================================================================
-- Migration: incremental_features
-- =========================================================================
-- Adds three incremental features:
--   1. Notification preferences (opt-in/out per push type)
--   2. Chat read status (read_at on messages)
--   3. Cancellation reason (cancel_reason on reservations)
-- =========================================================================

-- 1. Notification preferences
CREATE TABLE notification_preferences (
  user_id       uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  reservations  boolean NOT NULL DEFAULT true,
  messages      boolean NOT NULL DEFAULT true,
  reviews       boolean NOT NULL DEFAULT true,
  promotions    boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- 2. Chat read status
ALTER TABLE messages ADD COLUMN read_at timestamptz;

CREATE INDEX idx_messages_unread
  ON messages(conversation_id, read_at)
  WHERE read_at IS NULL;

-- 3. Cancellation reason
ALTER TABLE reservations ADD COLUMN cancel_reason text;


