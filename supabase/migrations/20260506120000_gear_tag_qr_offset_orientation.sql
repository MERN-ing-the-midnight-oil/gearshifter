-- Fine QR placement (mm from anchor corner/center) and tag print orientation for templates.
ALTER TABLE gear_tag_templates
  ADD COLUMN IF NOT EXISTS qr_code_offset_x_mm DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qr_code_offset_y_mm DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tag_orientation TEXT NOT NULL DEFAULT 'portrait'
    CHECK (tag_orientation IN ('portrait', 'landscape'));

COMMENT ON COLUMN gear_tag_templates.qr_code_offset_x_mm IS 'Nudge QR right (+) or left (-) from position anchor, mm';
COMMENT ON COLUMN gear_tag_templates.qr_code_offset_y_mm IS 'Nudge QR down (+) or up (-) from position anchor, mm';
COMMENT ON COLUMN gear_tag_templates.tag_orientation IS 'portrait: height >= width intent; landscape: width > height; used when printing';
