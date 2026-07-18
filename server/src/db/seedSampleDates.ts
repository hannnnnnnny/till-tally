const DAY_MS = 86_400_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDayStart(value: string): number {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid sample date: ${value}`);
  }

  const parsed = Date.parse(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid sample date: ${value}`);
  }

  return parsed;
}

/**
 * Days to add to every sample date so the latest one lands on the UTC day
 * before `today`. Sample CSV dates are static, so without a shift the demo
 * dataset ages out of the default 30-day dashboards and analytics windows.
 */
export function computeSampleDateShiftDays(sampleDates: string[], today: Date): number {
  if (sampleDates.length === 0) {
    throw new Error('At least one sample date is required');
  }

  const latest = Math.max(...sampleDates.map(toUtcDayStart));
  const todayUtcStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Math.round((todayUtcStart - DAY_MS - latest) / DAY_MS);
}

export function shiftSampleDate(value: string, shiftDays: number): string {
  const shifted = new Date(toUtcDayStart(value) + shiftDays * DAY_MS);

  return shifted.toISOString().slice(0, 10);
}
