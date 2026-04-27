-- Remote databases often never run seed.sql, so organizations can have zero swap
-- registration field definitions and the seller app shows "Registration form not set up yet".
-- These inserts match supabase/seed.sql starter questions; each runs only if that field is missing.

INSERT INTO swap_registration_field_definitions (
  organization_id,
  name,
  label,
  field_type,
  is_required,
  is_optional,
  display_order,
  placeholder,
  help_text,
  validation_rules,
  is_suggested_field
)
SELECT
  o.id,
  'how_heard',
  'How did you hear about this swap?',
  'text',
  false,
  true,
  0,
  'Friend, poster, social media…',
  'Optional; helps organizers improve outreach.',
  '{}',
  false
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM swap_registration_field_definitions f
  WHERE f.organization_id = o.id
    AND f.name = 'how_heard'
)
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO swap_registration_field_definitions (
  organization_id,
  name,
  label,
  field_type,
  is_required,
  is_optional,
  display_order,
  placeholder,
  help_text,
  validation_rules,
  is_suggested_field
)
SELECT
  o.id,
  'seller_notes',
  'Anything we should know?',
  'textarea',
  false,
  true,
  1,
  'Accessibility, large items, etc.',
  'Optional notes for check-in staff.',
  '{}',
  false
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM swap_registration_field_definitions f
  WHERE f.organization_id = o.id
    AND f.name = 'seller_notes'
)
ON CONFLICT (organization_id, name) DO NOTHING;
