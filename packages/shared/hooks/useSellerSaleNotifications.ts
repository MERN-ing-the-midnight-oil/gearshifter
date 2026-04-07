import { useCallback, useEffect, useState } from 'react';
import {
  getSellerTransactionsWithItems,
  type SellerSaleNotificationRow,
} from '../api/transactions';

export function useSellerSaleNotifications(sellerId: string | null) {
  const [rows, setRows] = useState<SellerSaleNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sellerId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSellerTransactionsWithItems(sellerId);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { rows, loading, error, refetch };
}
