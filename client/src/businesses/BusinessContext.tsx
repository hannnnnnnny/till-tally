import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { buildBusinessHeaders, fetchBusinesses } from './api';
import { type Business } from './types';

type BusinessStatus = 'loading' | 'ready' | 'error';

type BusinessContextValue = {
  activeBusiness: Business | null;
  activeBusinessHeaders: HeadersInit | null;
  activeBusinessId: string | null;
  businesses: Business[];
  error: string | null;
  status: BusinessStatus;
  addBusiness: (business: Business) => void;
  reloadBusinesses: () => Promise<void>;
  setActiveBusinessId: (businessId: string) => void;
};

const ACTIVE_BUSINESS_STORAGE_KEY = 'till-tally.active-business-id';

const BusinessContext = createContext<BusinessContextValue | null>(null);

function getStoredActiveBusinessId(): string | null {
  return window.sessionStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY);
}

function storeActiveBusinessId(businessId: string | null): void {
  if (businessId) {
    window.sessionStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, businessId);
    return;
  }

  window.sessionStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY);
}

function pickActiveBusinessId(
  businesses: Business[],
  preferredBusinessId: string | null,
): string | null {
  if (preferredBusinessId && businesses.some((business) => business.id === preferredBusinessId)) {
    return preferredBusinessId;
  }

  return businesses[0]?.id ?? null;
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(() =>
    getStoredActiveBusinessId(),
  );
  const [status, setStatus] = useState<BusinessStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const setActiveBusinessId = useCallback((businessId: string) => {
    setActiveBusinessIdState(businessId);
    storeActiveBusinessId(businessId);
  }, []);

  const reloadBusinesses = useCallback(async () => {
    if (!accessToken) {
      setBusinesses([]);
      setActiveBusinessIdState(null);
      storeActiveBusinessId(null);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError(null);

    const nextBusinesses = await fetchBusinesses(accessToken);
    const nextActiveBusinessId = pickActiveBusinessId(nextBusinesses, getStoredActiveBusinessId());

    setBusinesses(nextBusinesses);
    setActiveBusinessIdState(nextActiveBusinessId);
    storeActiveBusinessId(nextActiveBusinessId);
    setStatus('ready');
  }, [accessToken]);

  useEffect(() => {
    let isActive = true;

    async function loadBusinesses() {
      try {
        await reloadBusinesses();
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Something went wrong');
        setStatus('error');
      }
    }

    void loadBusinesses();

    return () => {
      isActive = false;
    };
  }, [reloadBusinesses]);

  const addBusiness = useCallback(
    (business: Business) => {
      setBusinesses((currentBusinesses) => [
        business,
        ...currentBusinesses.filter((currentBusiness) => currentBusiness.id !== business.id),
      ]);
      setActiveBusinessId(business.id);
    },
    [setActiveBusinessId],
  );

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) ?? null,
    [activeBusinessId, businesses],
  );

  const activeBusinessHeaders = useMemo(
    () =>
      accessToken && activeBusinessId ? buildBusinessHeaders(accessToken, activeBusinessId) : null,
    [accessToken, activeBusinessId],
  );

  const value = useMemo<BusinessContextValue>(
    () => ({
      activeBusiness,
      activeBusinessHeaders,
      activeBusinessId,
      businesses,
      error,
      status,
      addBusiness,
      reloadBusinesses,
      setActiveBusinessId,
    }),
    [
      activeBusiness,
      activeBusinessHeaders,
      activeBusinessId,
      businesses,
      error,
      status,
      addBusiness,
      reloadBusinesses,
      setActiveBusinessId,
    ],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinesses(): BusinessContextValue {
  const value = useContext(BusinessContext);

  if (!value) {
    throw new Error('useBusinesses must be used within a BusinessProvider');
  }

  return value;
}
