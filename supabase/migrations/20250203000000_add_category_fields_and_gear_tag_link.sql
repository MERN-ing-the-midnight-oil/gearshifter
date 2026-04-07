-- Migration: Add category-specific fields and gear tag linking
-- Links field definitions to categories and categories to gear tags

-- Add category_id to item_field_definitions to allow category-specific attributes
ALTER TABLE item_field_definitions 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES item_categories(id) ON DELETE CASCADE;

-- Add gear_tag_template_id to item_categories to link categories to gear tags
ALTER TABLE item_categories 
  ADD COLUMN IF NOT EXISTS gear_tag_template_id UUID REFERENCES gear_tag_templates(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_item_field_definitions_category_id ON item_field_definitions(category_id);
CREATE INDEX IF NOT EXISTS idx_item_categories_gear_tag_template_id ON item_categories(gear_tag_template_id);

