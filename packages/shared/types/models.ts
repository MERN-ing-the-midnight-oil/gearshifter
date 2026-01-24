// Business logic types (not directly tied to database schema)

export type UserRole = 'seller' | 'admin' | 'volunteer';

export type ItemStatus = 
  | 'pending'
  | 'checked_in'
  | 'for_sale'
  | 'sold'
  | 'picked_up'
  | 'donated';

export type EventStatus = 
  | 'registration'
  | 'checkin'
  | 'shopping'
  | 'pickup'
  | 'closed';

export type PaymentMethod = 'cash' | 'card' | 'check';

export interface Seller {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  qrCode: string;
  createdAt: Date;
}

export interface AdminUser {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  permissions: {
    checkIn?: boolean;
    pos?: boolean;
    pickup?: boolean;
    reports?: boolean;
  };
  createdAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  commissionRate: number;
  vendorCommissionRate: number;
  createdAt: Date;
}

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  eventDate: Date;
  registrationOpenDate: Date;
  registrationCloseDate: Date;
  shopOpenTime: Date;
  shopCloseTime: Date;
  priceDropTime?: Date;
  status: EventStatus;
  settings: Record<string, unknown>;
}

export interface Item {
  id: string;
  eventId: string;
  sellerId: string;
  itemNumber: string;
  category: string;
  description: string;
  size?: string;
  originalPrice: number;
  reducedPrice?: number;
  enablePriceReduction: boolean;
  donateIfUnsold: boolean;
  status: ItemStatus;
  qrCode: string;
  checkedInAt?: Date;
  soldAt?: Date;
  soldPrice?: number;
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
  paymentMethod: PaymentMethod;
  processedBy: string;
  soldAt: Date;
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

