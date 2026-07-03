export type LandingNavItem = {
  label: string;
  href: string;
};

export type LandingFeature = {
  title: string;
  body: string;
};

export type AnalyticsMethod = {
  title: string;
  body: string;
};

export type TechStackItem = {
  name: string;
  body: string;
};

export const LANDING_NAV_ITEMS: LandingNavItem[] = [
  { label: 'Features', href: '#features' },
  { label: 'Preview', href: '#preview' },
  { label: 'Methods', href: '#methods' },
  { label: 'Stack', href: '#stack' },
  { label: 'Demo login', href: '#demo-login' },
];

export const LANDING_FEATURES: LandingFeature[] = [
  {
    title: 'Import sales data',
    body: 'Upload order and product CSVs, map headers, validate rows, and keep import history.',
  },
  {
    title: 'Read retail KPIs',
    body: 'Track revenue, gross profit, margin, order volume, AOV, and units sold.',
  },
  {
    title: 'Rank product performance',
    body: 'Spot best sellers, high margin products, low stock items, and slow movers.',
  },
  {
    title: 'Protect every workspace',
    body: 'Business membership checks keep each retailer separated from other business data.',
  },
];

export const ANALYTICS_METHODS: AnalyticsMethod[] = [
  {
    title: 'KPI summary',
    body: 'Rolls orders and product cost data into revenue, margin, AOV, and unit metrics.',
  },
  {
    title: 'Sales trend',
    body: 'Groups order data by day or week so retailers can see demand movement over time.',
  },
  {
    title: 'Product performance',
    body: 'Ranks products by revenue contribution, margin quality, velocity, and stock status.',
  },
  {
    title: 'Inventory risk',
    body: 'Flags low stock, stockout risk, slow movers, dead stock, and overstock candidates.',
  },
];

export const TECH_STACK_ITEMS: TechStackItem[] = [
  {
    name: 'React',
    body: 'Frontend views, routing, form states, and responsive product surfaces.',
  },
  {
    name: 'TypeScript',
    body: 'Shared type safety across client UI, server services, and test coverage.',
  },
  {
    name: 'Node.js',
    body: 'Express API routes for auth, workspaces, imports, products, and analytics.',
  },
  {
    name: 'PostgreSQL',
    body: 'Relational storage for users, businesses, products, orders, and import jobs.',
  },
  {
    name: 'Prisma',
    body: 'Schema models, migrations, generated client access, and demo seed data.',
  },
  {
    name: 'Docker',
    body: 'Local service orchestration for the app, server, and database.',
  },
];

export const DEMO_LOGIN = {
  email: 'demo@tilltally.local',
  password: 'DemoPass123!',
};
