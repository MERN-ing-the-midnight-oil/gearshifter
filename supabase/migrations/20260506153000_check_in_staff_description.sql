-- Staff-only handoff notes when no check-in photo (org volunteers document the physical item at receive).

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS check_in_staff_description TEXT;

COMMENT ON COLUMN public.items.check_in_staff_description IS
  'Optional text entered by org staff at physical check-in when no check-in photo; documents what was verified at handoff.';
