import { supabase } from './supabase';
import type { SwapRegistrationPageSettings, FieldGroup } from '../types/models';

/**
 * Get swap registration page settings for an organization
 */
export const getSwapRegistrationPageSettings = async (
  organizationId: string
): Promise<SwapRegistrationPageSettings | null> => {
  const { data, error } = await supabase
    .from('swap_registration_page_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data ? mapPageSettingsFromDb(data) : null;
};

/**
 * Get swap registration page settings for an event (via organization)
 */
export const getEventSwapRegistrationPageSettings = async (
  eventId: string
): Promise<SwapRegistrationPageSettings | null> => {
  // First get the event to find organization
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('organization_id')
    .eq('id', eventId)
    .single();

  if (eventError) throw eventError;
  if (!event) return null;

  return getSwapRegistrationPageSettings(event.organization_id);
};

/**
 * Create or update swap registration page settings
 */
export const saveSwapRegistrationPageSettings = async (
  organizationId: string,
  settings: {
    pageTitle?: string;
    pageDescription?: string;
    welcomeMessage?: string;
    fieldGroups?: FieldGroup[];
    customStyles?: Record<string, unknown>;
  }
): Promise<SwapRegistrationPageSettings> => {
  // Check if settings already exist
  const existing = await getSwapRegistrationPageSettings(organizationId);

  const settingsData: any = {
    organization_id: organizationId,
    page_title: settings.pageTitle || 'Register for Swap',
    page_description: settings.pageDescription || null,
    welcome_message: settings.welcomeMessage || null,
    field_groups: settings.fieldGroups || [],
    custom_styles: settings.customStyles || {},
  };

  if (existing) {
    // Update existing settings
    const { data, error } = await supabase
      .from('swap_registration_page_settings')
      .update(settingsData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return mapPageSettingsFromDb(data);
  } else {
    // Create new settings
    const { data, error } = await supabase
      .from('swap_registration_page_settings')
      .insert(settingsData)
      .select()
      .single();

    if (error) throw error;
    return mapPageSettingsFromDb(data);
  }
};

/**
 * Helper to map database page settings to SwapRegistrationPageSettings model
 */
function mapPageSettingsFromDb(dbSettings: any): SwapRegistrationPageSettings {
  return {
    id: dbSettings.id,
    organizationId: dbSettings.organization_id,
    pageTitle: dbSettings.page_title,
    pageDescription: dbSettings.page_description,
    welcomeMessage: dbSettings.welcome_message,
    fieldGroups: (dbSettings.field_groups as FieldGroup[]) || [],
    customStyles: (dbSettings.custom_styles as Record<string, unknown>) || {},
    createdAt: new Date(dbSettings.created_at),
    updatedAt: new Date(dbSettings.updated_at),
  };
}








