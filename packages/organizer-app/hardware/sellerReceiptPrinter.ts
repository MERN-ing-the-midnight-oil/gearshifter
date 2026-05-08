import type { Item, Event, SellerReceiptTemplate, Transaction } from 'shared';
import { printerService } from './printer';

export async function printSellerSaleReceipt(opts: {
  template: SellerReceiptTemplate;
  item: Item;
  transaction: Transaction;
  event?: Event | null;
  sellerDisplayName?: string | null;
  buyerReceiptUrl?: string | null;
}): Promise<boolean> {
  return printerService.printSellerReceipt(opts);
}
