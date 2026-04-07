import { supabase } from './supabase';
import type { Organization, PriceReductionSettings } from '../types/models';

/**
 * Create a new organization
 * Note: This typically requires service role key or a special policy
 */
export const createOrganization = async (
  organizationData: {
    name: string;
    slug: string;
    commissionRate?: number | null;
    vendorCommissionRate?: number | null;
  }
): Promise<Organization> => {
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: organizationData.name,
      slug: organizationData.slug,
      commission_rate: organizationData.commissionRate ?? null,
      vendor_commission_rate: organizationData.vendorCommissionRate ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapOrganizationFromDb(data);
};

/**
 * Get organization by ID
 */
export const getOrganization = async (organizationId: string): Promise<Organization | null> => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (error) throw error;
  return data ? mapOrganizationFromDb(data) : null;
};

/**
 * Get organization by admin user ID
 */
export const getOrganizationByAdminId = async (adminUserId: string): Promise<Organization | null> => {
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('organization_id')
    .eq('id', adminUserId)
    .single();

  if (adminError) {
    // Handle case where RLS might be blocking - try with service role if available
    throw adminError;
  }
  if (!adminUser) return null;

  return getOrganization(adminUser.organization_id);
};

/**
 * Update organization commission rates
 */
export const updateCommissionRates = async (
  organizationId: string,
  rates: {
    commissionRate?: number | null;
    vendorCommissionRate?: number | null;
  }
): Promise<Organization> => {
  const updateData: any = {};
  
  if (rates.commissionRate !== undefined) {
    updateData.commission_rate = rates.commissionRate;
  }
  if (rates.vendorCommissionRate !== undefined) {
    updateData.vendor_commission_rate = rates.vendorCommissionRate;
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updateData)
    .eq('id', organizationId)
    .select()
    .single();

  if (error) throw error;
  return mapOrganizationFromDb(data);
};

/**
 * Update organization price reduction settings
 */
export const updatePriceReductionSettings = async (
  organizationId: string,
  settings: Partial<PriceReductionSettings>
): Promise<Organization> => {
  // Get current settings
  const org = await getOrganization(organizationId);
  if (!org) throw new Error('Organization not found');

  const updatedSettings: PriceReductionSettings = {
    ...org.priceReductionSettings,
    ...settings,
  };

  const { data, error } = await supabase
    .from('organizations')
    .update({
      price_reduction_settings: updatedSettings,
    })
    .eq('id', organizationId)
    .select()
    .single();

  if (error) throw error;
  return mapOrganizationFromDb(data);
};

/**
 * Helper to map database organization to Organization model
 */
function mapOrganizationFromDb(dbOrg: any): Organization {
  const defaultPriceReductionSettings: PriceReductionSettings = {
    sellerCanSetReduction: true,
    sellerCanSetTime: true,
    defaultReductionTime: undefined,
    allowedReductionTimes: [],
  };

  return {
    id: dbOrg.id,
    name: dbOrg.name,
    slug: dbOrg.slug,
    commissionRate: dbOrg.commission_rate != null ? parseFloat(dbOrg.commission_rate) : null,
    vendorCommissionRate: dbOrg.vendor_commission_rate != null ? parseFloat(dbOrg.vendor_commission_rate) : null,
    priceReductionSettings: (dbOrg.price_reduction_settings as PriceReductionSettings) || defaultPriceReductionSettings,
    createdAt: new Date(dbOrg.created_at),
  };
}

