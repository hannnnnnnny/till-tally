import { type ProductLabel } from './types';

export const PRODUCT_STATUS_FILTERS: ProductLabel[] = [
  'Best Seller',
  'High Margin',
  'Low Stock',
  'Reorder Soon',
  'Slow Mover',
  'Dead Stock',
  'Discount Candidate',
];

const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  currency: 'NZD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: 'currency',
});

const percentFormatter = new Intl.NumberFormat('en-NZ', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
  style: 'percent',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function formatProductCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatProductPercent(value: number): string {
  return percentFormatter.format(value / 100);
}

export function formatProductStock(value: number): string {
  return `${value} in stock`;
}

export function formatProductLastSoldAt(value: string | null): string {
  if (!value) {
    return 'No recent sales';
  }

  return `Last sold ${dateFormatter.format(new Date(`${value}T00:00:00.000Z`))}`;
}

export function getProductLabelClass(label: ProductLabel): string {
  if (label === 'Best Seller' || label === 'High Margin') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (label === 'Low Stock' || label === 'Reorder Soon') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (label === 'Dead Stock' || label === 'Discount Candidate') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function getAbcClassClass(value: 'A' | 'B' | 'C'): string {
  if (value === 'A') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (value === 'B') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}
