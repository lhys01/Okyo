CREATE TABLE IF NOT EXISTS okyo_private.idea_submissions (
  id uuid PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('idea', 'improvement', 'bug')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 8 AND 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'planned', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idea_submissions_created_at_idx
  ON okyo_private.idea_submissions (created_at DESC);

-- The API runtime role needs INSERT on this table. Keep SELECT for the
-- database owner/admin so submissions remain private to the Okyo team.
