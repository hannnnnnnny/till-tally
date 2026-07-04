import {
  type InventoryInsights,
  type InventoryRiskGroupKey,
  type InventoryRiskItem,
  type InventoryRiskLabel,
} from './types';

export type InventorySummaryCard = {
  key: InventoryRiskGroupKey;
  label: string;
  value: string;
  helper: string;
  className: string;
};

export type InventoryRiskGroup = {
  key: InventoryRiskGroupKey;
  label: string;
  description: string;
};

export const INVENTORY_RISK_GROUPS: InventoryRiskGroup[] = [
  {
    key: 'reorderSoon',
    label: 'Reorder Soon',
    description: 'Products that are selling fast and need replenishment.',
  },
  {
    key: 'lowStock',
    label: 'Low Stock',
    description: 'Products at or below the low-stock threshold.',
  },
  {
    key: 'stockoutRisk',
    label: 'Stockout Risk',
    description: 'Low-stock products with meaningful recent demand.',
  },
  {
    key: 'slowMovers',
    label: 'Slow Movers',
    description: 'Products with stock but weak recent movement.',
  },
  {
    key: 'deadStock',
    label: 'Dead Stock',
    description: 'Products with stock and no recent sales activity.',
  },
  {
    key: 'discountCandidates',
    label: 'Discount Candidates',
    description: 'Products that may need markdowns or merchandising changes.',
  },
  {
    key: 'overstocked',
    label: 'Overstocked',
    description: 'Products with too much stock relative to current sales pace.',
  },
];

const numberFormatter = new Intl.NumberFormat('en-NZ', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const dateRangeFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

export function buildInventorySummaryCards(insights: InventoryInsights): InventorySummaryCard[] {
  return INVENTORY_RISK_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    value: String(insights.summary[group.key]),
    helper: group.description,
    className: getInventoryGroupClass(group.key),
  }));
}

export function getInventoryGroupItems(
  insights: InventoryInsights,
  groupKey: InventoryRiskGroupKey,
): InventoryRiskItem[] {
  return insights[groupKey];
}

export function formatInventoryWindow(insights: InventoryInsights): string {
  const from = createUtcDate(insights.salesWindow.from);
  const to = createUtcDate(insights.salesWindow.to);

  return `${dateFormatter.format(from)} - ${dateRangeFormatter.format(to)}`;
}

export function formatInventoryStock(value: number): string {
  return `${numberFormatter.format(value)} on hand`;
}

export function formatDailySalesRate(value: number): string {
  return `${numberFormatter.format(value)}/day`;
}

export function formatDaysOfStockLeft(value: number | null): string {
  if (value === null) {
    return 'No recent sales pace';
  }

  return `${numberFormatter.format(value)} days left`;
}

export function formatInventoryLastSoldAt(value: string | null): string {
  if (!value) {
    return 'No recent sale';
  }

  return `Last sold ${dateFormatter.format(createUtcDate(value))}`;
}

export function getInventoryLabelClass(label: InventoryRiskLabel): string {
  if (label === 'Reorder Soon') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (label === 'Low Stock') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (label === 'Stockout Risk' || label === 'Dead Stock') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (label === 'Slow Mover' || label === 'Discount Candidate') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

function getInventoryGroupClass(groupKey: InventoryRiskGroupKey): string {
  if (groupKey === 'reorderSoon') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (groupKey === 'lowStock') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (groupKey === 'stockoutRisk' || groupKey === 'deadStock') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (groupKey === 'slowMovers' || groupKey === 'discountCandidates') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

function createUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
