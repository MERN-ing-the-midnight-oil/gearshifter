// Business logic types (not directly tied to database schema)

export type UserRole = 'seller' | 'admin' | 'volunteer';

export type ItemStatus =
  | 'pending'
  | 'checked_in'
  | 'for_sale'
  | 'sold'
  | 'picked_up'
  | 'donated'
  | 'donated_abandoned'
  | 'unclaimed'
  | 'withdrawn'
  | 'lost'
  | 'damaged';

export type EventStatus = 'active' | 'closed';

/** Station-level permissions for org users. Org admins (is_org_admin) have full access. */
export interface AdminPermissions {
  stations: {
    check_in: boolean;
    pos: boolean;
    pickup: boolean;
    reports: boolean;
  };
  // Future: action-level controls, e.g. pos_actions?: { process_refunds?: boolean }
}

export type PaymentMethod = 'cash' | 'card' | 'check';

export type SuggestedFieldType = 
  | 'profile_photo'
  | 'address'
  | 'contact_info'
  | 'marketing_opt_in';

export interface SwapRegistrationFieldDefinition {
  id: string;
  organizationId: string;
  name: string;
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  isOptional: boolean; // If true, sellers can skip this field even if required
  displayOrder: number;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  validationRules?: Record<string, unknown>;
  options?: string[]; // For dropdown fields
  isSuggestedField: boolean; // True for pre-defined suggested fields
  suggestedFieldType?: SuggestedFieldType;
  createdAt: Date;
}

export interface SellerSwapRegistration {
  id: string;
  eventId: string;
  sellerId: string;
  registrationData: Record<string, unknown>; // All field values
  isComplete: boolean; // True if all required fields are filled
  registeredAt: Date;
  updatedAt: Date;
}

// Swap Registration Page Customization
export interface FieldGroup {
  id: string;
  title: string;
  description?: string;
  fields: string[]; // Field names in this group
  order: number;
}

export interface SwapRegistrationPageSettings {
  id: string;
  organizationId: string;
  pageTitle: string;
  pageDescription?: string;
  welcomeMessage?: string;
  fieldGroups: FieldGroup[];
  customStyles: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Gear Tag Templates
export type TagLayoutType = 'standard' | 'compact' | 'detailed';
export type QRCodePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface TagField {
  field: string; // Field name (e.g., "item_number", "description", "price")
  label?: string; // Display label (e.g., "Item #", "Price")
  /** @deprecated Use flow layout - fields are ordered by array index. Kept for backward compat. */
  position?: { x: number; y: number };
  maxLength?: number; // Max characters before truncation (for word wrap / layout)
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  required: boolean; // True if this field must be present on the tag
  format?: string; // Optional format string (e.g., "$%.2f" for price)
}

export interface GearTagTemplate {
  id: string;
  organizationId: string;
  name: string; // e.g., "Bike Tag", "Skis Tag"
  description?: string;
  layoutType: TagLayoutType;
  widthMm: number;
  heightMm: number;
  tagFields: TagField[]; // Fields to display on tag
  requiredFields: string[]; // Required field names for this tag type
  categoryIds?: string[]; // Optional: Link to specific categories
  fontFamily: string;
  fontSize: number;
  borderWidth: number;
  qrCodeSize: number; // QR code size in mm
  qrCodePosition: QRCodePosition;
  qrCodeEnabled: boolean; // QR codes are always enabled on sticker tags
  qrCodeDataFields: string[]; // Fields to include in QR code data (e.g., ["item_number", "price", "reduced_price"])
  qrCodeSellerAccess: string[]; // Fields sellers can see when scanning (empty = org users only)
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Seller {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string; // Optional for guest sellers, required for authenticated sellers
  qrCode: string;
  authUserId?: string; // Link to auth.users if seller has an account
  isGuest: boolean; // True if seller doesn't have an authenticated account
  photoIdVerified: boolean; // True if org user verified photo ID (for guest sellers)
  photoIdVerifiedBy?: string; // Admin user ID who verified the photo ID
  photoIdVerifiedAt?: Date; // When photo ID was verified
  // Optional fields from swap registration
  profilePhotoUrl?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  marketingOptIn: boolean;
  contactInfo?: Record<string, unknown>;
  createdAt: Date;
}

export type OrgUserRole = 'admin' | 'volunteer';

export interface AdminUser {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: OrgUserRole;
  isOrgAdmin: boolean;
  permissions: AdminPermissions;
  createdAt: Date;
}

export interface PriceReductionSettings {
  sellerCanSetReduction: boolean; // Can sellers set price reductions?
  sellerCanSetTime: boolean; // Can sellers set when price reduction occurs?
  defaultReductionTime?: string; // Default time (HH:MM format) if org controls timing
  allowedReductionTimes?: string[]; // Allowed times sellers can choose from (if seller controls time)
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  commissionRate: number | null;
  vendorCommissionRate: number | null;
  priceReductionSettings: PriceReductionSettings;
  createdAt: Date;
}

export interface EventSettings {
  priceDropTimes?: Date[];
  priceDropAmountControl?: 'organization' | 'seller';
  allowSellerPriceDrops?: boolean;
  maxSellerPriceDrops?: number;
  minTimeBetweenSellerPriceDrops?: number; // in minutes
  [key: string]: unknown; // Allow other settings
}

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  eventDate: Date;
  registrationOpenDate?: Date;
  registrationCloseDate?: Date;
  shopOpenTime?: Date;
  shopCloseTime?: Date;
  /** When sellers can pick up unsold equipment (set by org admin). */
  pickupStartTime?: Date;
  pickupEndTime?: Date;
  /** When and where sellers drop off gear (set by org admin). */
  gearDropOffStartTime?: Date;
  gearDropOffEndTime?: Date;
  gearDropOffPlace?: string;
  priceDropTime?: Date; // Legacy field, kept for backward compatibility
  status: EventStatus;
  itemsLocked: boolean;
  /** When set, event is closed for donations; donate_if_unsold+for_sale items are donated, others show as not picked up when scanned. */
  donationDeclaredAt?: Date;
  settings: EventSettings;
}

// Dynamic field system types
export type FieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'dropdown'
  | 'date'
  | 'time';

export interface ItemCategory {
  id: string;
  organizationId: string;
  parentId?: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  gearTagTemplateId?: string; // Link to gear tag template
  createdAt: Date;
  children?: ItemCategory[]; // For nested categories
}

export interface ItemFieldDefinition {
  id: string;
  organizationId: string;
  categoryId?: string; // Link to category (null = organization-wide field)
  name: string; // Field key (e.g., "donate_if_unsold", "item_price")
  label: string; // Display label (e.g., "Donate if Unsold", "Item Price")
  fieldType: FieldType;
  isRequired: boolean;
  displayOrder: number;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  validationRules?: Record<string, unknown>;
  options?: string[]; // For dropdown fields
  isPriceField: boolean; // True if this is the main price field
  isPriceReductionField: boolean; // True if this controls price reduction
  priceReductionPercentage: boolean; // true = percentage reduction, false = fixed amount
  priceReductionTimeControl: 'org' | 'seller'; // Who controls when price drops
  createdAt: Date;
}

export interface PriceReductionTime {
  time: string; // Time in HH:MM format (e.g., "16:00")
  price: number; // Price at this time
  isPercentage?: boolean; // True if price is percentage reduction
}

export interface Item {
  id: string;
  eventId: string;
  sellerId: string;
  itemNumber: string;
  /** Seller-chosen name for the app/dashboard only; not printed on physical tags. */
  sellerItemLabel?: string;
  categoryId?: string; // Reference to item_categories
  category?: string; // Legacy field, kept for backward compatibility
  description: string; // Legacy field, may be replaced by custom fields
  size?: string; // Legacy field, may be replaced by custom fields
  originalPrice: number; // Legacy field, may be replaced by custom fields
  reducedPrice?: number; // Legacy field, may be replaced by custom fields
  enablePriceReduction: boolean; // Legacy field, may be replaced by custom fields
  priceReductionTimes?: PriceReductionTime[]; // Multiple price reduction times
  donateIfUnsold: boolean; // Legacy field, may be replaced by custom fields
  customFields: Record<string, unknown>; // Dynamic field values
  status: ItemStatus;
  qrCode: string;
  checkedInAt?: Date;
  soldAt?: Date;
  soldPrice?: number;
  paidAt?: Date; // When the item was marked as paid (after organization processes payout)
  createdAt: Date;
}

export interface Transaction {
  id: string;
  eventId: string;
  itemId: string;
  sellerId: string;
  soldPrice: number;
  commissionAmount: number;
  sellerAmount: number;
  paymentMethod?: PaymentMethod; // Optional since we're not processing payments
  processedBy: string;
  soldAt: Date;
  // Buyer information
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerContactInfo?: Record<string, unknown>;
}

export interface Payout {
  id: string;
  eventId: string;
  sellerId: string;
  totalAmount: number;
  checkNumber?: string;
  issuedBy: string;
  signedBySeller: boolean;
  paidAt?: Date;
  items: string[];
}

/** Org-level inventory after swaps (storage, resale, donations) — not tied to one event. */
export type OrganizationInventoryStatus =
  | 'in_stock'
  | 'sold'
  | 'disposed'
  | 'donated_out';

export interface OrganizationInventoryItem {
  id: string;
  organizationId: string;
  sourceEventId?: string;
  sourceItemId?: string;
  itemNumberSnapshot?: string;
  description: string;
  category: string;
  size?: string;
  originNote?: string;
  status: OrganizationInventoryStatus;
  listedPrice?: number;
  salePrice?: number;
  soldAt?: Date;
  /** Original consignor when promoted from an event item; optional for manual rows. */
  sellerOfRecordId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

