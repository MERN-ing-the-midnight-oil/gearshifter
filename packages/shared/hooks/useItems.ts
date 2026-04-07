import { useCallback, useEffect, useRef, useState } from 'react';
import { getSellerItems, getSellerItemsByEvent, getSellerStats } from '../api/items';
import type { Item } from '../types/models';

export function useItems(sellerId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (!sellerId) {
      fetchGenRef.current += 1;
      setLoading(false);
      return;
    }

    loadItems();
  }, [sellerId]);

  const loadItems = async () => {
    if (!sellerId) return;
    const gen = ++fetchGenRef.current;

    try {
      setLoading(true);
      setError(null);
      const data = await getSellerItems(sellerId);
      if (gen !== fetchGenRef.current) return;
      setItems(data);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load items'));
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  };

  const removeItemFromList = useCallback((itemId: string) => {
    fetchGenRef.current += 1;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  return { items, loading, error, refetch: loadItems, removeItemFromList };
}

export function useItemsByEvent(sellerId: string | null, eventId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (!sellerId || !eventId) {
      fetchGenRef.current += 1;
      setLoading(false);
      return;
    }

    loadItems();
  }, [sellerId, eventId]);

  const loadItems = async () => {
    if (!sellerId || !eventId) return;
    const gen = ++fetchGenRef.current;

    try {
      setLoading(true);
      setError(null);
      const data = await getSellerItemsByEvent(sellerId, eventId);
      if (gen !== fetchGenRef.current) return;
      setItems(data);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load items'));
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  };

  const removeItemFromList = useCallback((itemId: string) => {
    fetchGenRef.current += 1;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  return { items, loading, error, refetch: loadItems, removeItemFromList };
}

export function useSellerStats(sellerId: string | null) {
  const [stats, setStats] = useState({
    totalItems: 0,
    soldItems: 0,
    pendingItems: 0,
    checkedInItems: 0,
    forSaleItems: 0,
    donatedItems: 0,
    totalEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    loadStats();
  }, [sellerId]);

  const loadStats = async () => {
    if (!sellerId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getSellerStats(sellerId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load stats'));
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refetch: loadStats };
}

