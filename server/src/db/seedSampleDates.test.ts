import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSampleDateShiftDays, shiftSampleDate } from './seedSampleDates';

describe('seed sample date shifting', () => {
  const today = new Date('2026-07-19T09:30:00.000Z');

  it('lands the latest sample date on the UTC day before seeding', () => {
    const shift = computeSampleDateShiftDays(['2026-06-01', '2026-06-24', '2026-06-12'], today);

    assert.equal(shift, 24);
    assert.equal(shiftSampleDate('2026-06-24', shift), '2026-07-18');
  });

  it('preserves relative spacing between sample dates', () => {
    const shift = computeSampleDateShiftDays(['2026-06-01', '2026-06-24'], today);

    assert.equal(shiftSampleDate('2026-06-01', shift), '2026-06-25');
  });

  it('crosses month and year boundaries safely', () => {
    const shift = computeSampleDateShiftDays(['2025-12-30'], new Date('2026-01-02T00:10:00.000Z'));

    assert.equal(shiftSampleDate('2025-12-30', shift), '2026-01-01');
  });

  it('shifts backwards when sample dates are in the future', () => {
    const shift = computeSampleDateShiftDays(['2030-01-10'], today);

    assert.ok(shift < 0);
    assert.equal(shiftSampleDate('2030-01-10', shift), '2026-07-18');
  });

  it('rejects empty input and malformed dates', () => {
    assert.throws(() => computeSampleDateShiftDays([], today));
    assert.throws(() => computeSampleDateShiftDays(['not-a-date'], today));
    assert.throws(() => shiftSampleDate('junk', 3));
  });
});
