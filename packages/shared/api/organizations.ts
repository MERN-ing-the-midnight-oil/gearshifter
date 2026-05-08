import { supabase } from './supabase';
import {
  DEFAULT_SELLER_ITEM_PRE_REGISTRATION_ALLOWED_FIELD_NAMES,
  type Organization,
  type PriceReductionSettings,
  type SaleBehaviorSettings,
  type SellerItemPreRegistrationSettings,
} from '../types/models';

const DEFAULT_SELLER_ITEM_PREREG_SETTINGS: SellerItemPreRegistrationSettings = {
  allowedFieldNames: [...DEFAULT_SELLER_ITEM_PRE_REGISTRATION_ALLOWED_FIELD_NAMES],
  allowTagTemplateOnlyFields: false,
};

/** Merge persisted JSON with defaults; omitting `allowedFieldNames` yields the default list (currently description). */
export function normalizeSellerItemPreRegistration(
  patch: Partial<SellerItemPreRegistrationSettings> | null | undefined
): SellerItemPreRegistrationSettings {
  const defaults = DEFAULT_SELLER_ITEM_PREREG_SETTINGS;
  const p = patch && typeof patch === 'object' ? patch : {};
  const hasExplicitAllowed = Object.prototype.hasOwnProperty.call(p, 'allowedFieldNames');
  const allowTagTemplateOnlyFields = p.allowTagTemplateOnlyFields ?? defaults.allowTagTemplateOnlyFields ?? false;

  const allowedFieldNames = hasExplicitAllowed
    ? Array.from(
        new Set((p.allowedFieldNames ?? []).map((name) => name.trim()).filter(Boolean))
      )
    : [...defaults.allowedFieldNames];

  return { allowedFieldNames, allowTagTemplateOnlyFields };
}

const DEFAULT_PRICE_REDUCTION_SETTINGS: PriceReductionSettings = {
  sellerCanSetReduction: true,
  sellerCanSetTime: true,
  priceReductionValueControl: 'seller',
  priceReductionCountControl: 'seller',
  priceReductionTimingControl: 'seller',
  defaultReductionTime: undefined,
  allowedReductionTimes: [],
  sellerItemPreRegistration: DEFAULT_SELLER_ITEM_PREREG_SETTINGS,
};

const DEFAULT_SALE_BEHAVIOR_SETTINGS: SaleBehaviorSettings = {
  notifySellerSmsOnSale: false,
  notifySellerPushOnSale: true,
  defaultSellerReceiptTemplateId: null,
};

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
  const valueControl = updatedSettings.priceReductionValueControl ?? 'seller';
  const timingControl = updatedSettings.priceReductionTimingControl ?? 'seller';
  const countControl = updatedSettings.priceReductionCountControl ?? 'seller';
  updatedSettings.sellerCanSetReduction = valueControl === 'seller';
  updatedSettings.sellerCanSetTime = timingControl === 'seller' && countControl === 'seller';

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
 * Update org-level seller item pre-registration field access settings.
 */
/**
 * Organization-wide choices for what happens after a sale (seller SMS/push defaults, receipt template ID).
 */
export const updateSaleBehaviorSettings = async (
  organizationId: string,
  settings: Partial<SaleBehaviorSettings>
): Promise<Organization> => {
  const org = await getOrganization(organizationId);
  if (!org) throw new Error('Organization not found');

  const next: SaleBehaviorSettings = {
    ...DEFAULT_SALE_BEHAVIOR_SETTINGS,
    ...org.saleBehaviorSettings,
    ...settings,
  };

  const { data, error } = await supabase
    .from('organizations')
    .update({ sale_behavior_settings: next })
    .eq('id', organizationId)
    .select()
    .single();

  if (error) throw error;
  return mapOrganizationFromDb(data);
};

export const updateSellerItemPreRegistrationSettings = async (
  organizationId: string,
  settings: Partial<SellerItemPreRegistrationSettings>
): Promise<Organization> => {
  const org = await getOrganization(organizationId);
  if (!org) throw new Error('Organization not found');

  const nextPreRegSettings = normalizeSellerItemPreRegistration({
    ...(org.priceReductionSettings.sellerItemPreRegistration ?? {}),
    ...settings,
  });

  const nextPriceSettings: PriceReductionSettings = {
    ...org.priceReductionSettings,
    sellerItemPreRegistration: nextPreRegSettings,
  };

  const { data, error } = await supabase
    .from('organizations')
    .update({
      price_reduction_settings: nextPriceSettings,
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
export function mapOrganizationFromDb(dbOrg: any): Organization {
  const rawSaleBehavior =
    dbOrg.sale_behavior_settings && typeof dbOrg.sale_behavior_settings === 'object'
      ? (dbOrg.sale_behavior_settings as SaleBehaviorSettings)
      : {};
  const saleBehaviorSettings: SaleBehaviorSettings = {
    ...DEFAULT_SALE_BEHAVIOR_SETTINGS,
    ...rawSaleBehavior,
  };

  const raw = (dbOrg.price_reduction_settings as PriceReductionSettings) || DEFAULT_PRICE_REDUCTION_SETTINGS;
  const valueControl =
    raw.priceReductionValueControl ?? (raw.sellerCanSetReduction === false ? 'org' : 'seller');
  const timingControl =
    raw.priceReductionTimingControl ?? (raw.sellerCanSetTime === false ? 'org' : 'seller');
  const countControl = raw.priceReductionCountControl ?? 'seller';
  const sellerItemPreRegistration = normalizeSellerItemPreRegistration(raw.sellerItemPreRegistration);
  const normalized: PriceReductionSettings = {
    ...DEFAULT_PRICE_REDUCTION_SETTINGS,
    ...raw,
    priceReductionValueControl: valueControl,
    priceReductionCountControl: countControl,
    priceReductionTimingControl: timingControl,
    sellerCanSetReduction: valueControl === 'seller',
    sellerCanSetTime: timingControl === 'seller' && countControl === 'seller',
    sellerItemPreRegistration,
  };

  return {
    id: dbOrg.id,
    name: dbOrg.name,
    slug: dbOrg.slug,
    commissionRate: dbOrg.commission_rate != null ? parseFloat(dbOrg.commission_rate) : null,
    vendorCommissionRate: dbOrg.vendor_commission_rate != null ? parseFloat(dbOrg.vendor_commission_rate) : null,
    priceReductionSettings: normalized,
    saleBehaviorSettings,
    createdAt: new Date(dbOrg.created_at),
  };
}

