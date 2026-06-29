export type SalesChannel = 'SHOPIFY' | 'TRADE_ME' | 'IN_STORE' | 'SOCIAL' | 'MANUAL' | 'OTHER';

export type Business = {
  id: string;
  name: string;
  industry?: string | null;
  city?: string | null;
  role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';
  createdAt?: string;
};

export type BusinessFormValues = {
  name: string;
  industry: string;
  city: string;
  channels: SalesChannel[];
};

export type CreateBusinessRequest = {
  name: string;
  industry?: string | null;
  city?: string | null;
};
