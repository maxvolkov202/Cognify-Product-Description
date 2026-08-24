-- Legal consent — required "I agree to the terms and conditions" checkbox
-- at signup. Boolean mirrors the checkbox state for at-a-glance reads in
-- Supabase; the timestamp records WHEN the user agreed. Existing accounts
-- keep false/NULL (they predate the checkbox).
ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN cognify_v2.users.terms_accepted IS
  'User checked the required terms-and-conditions + privacy-policy consent box at signup.';
COMMENT ON COLUMN cognify_v2.users.terms_accepted_at IS
  'When the user agreed to the Terms & Conditions and Privacy Policy (client timestamp captured at signup, server-verified on account creation).';
