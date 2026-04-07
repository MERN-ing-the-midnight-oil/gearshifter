-- Run this in Supabase Dashboard → SQL Editor if you get:
-- "Could not find the 'gear_tag_template_id' column of 'item_categories' in the schema cache"
-- This applies the same changes as migration 20250203000000_add_category_fields_and_gear_tag_link.sql

-- Add category_id to item_field_definitions (if missing)
ALTER TABLE item_field_definitions
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES item_categories(id) ON DELETE CASCADE;

-- Add gear_tag_template_id to item_categories (if missing)
ALTER TABLE item_categories
  ADD COLUMN IF NOT EXISTS gear_tag_template_id UUID REFERENCES gear_tag_templates(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_field_definitions_category_id ON item_field_definitions(category_id);
CREATE INDEX IF NOT EXISTS idx_item_categories_gear_tag_template_id ON item_categories(gear_tag_template_id);
