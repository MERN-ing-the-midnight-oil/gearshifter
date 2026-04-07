import { useEffect, useState } from 'react';
import { getSellerTransactions, getRecentTransactions } from '../api/transactions';
import type { Transaction } from '../types/models';

export function useTransactions(sellerId: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    loadTransactions();
  }, [sellerId]);

  const loadTransactions = async () => {
    if (!sellerId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getSellerTransactions(sellerId);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load transactions'));
    } finally {
      setLoading(false);
    }
  };

  return { transactions, loading, error, refetch: loadTransactions };
}

export function useRecentTransactions(sellerId: string | null, limit = 10) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    loadTransactions();
  }, [sellerId, limit]);

  const loadTransactions = async () => {
    if (!sellerId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getRecentTransactions(sellerId, limit);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load recent transactions'));
    } finally {
      setLoading(false);
    }
  };

  return { transactions, loading, error, refetch: loadTransactions };
}











