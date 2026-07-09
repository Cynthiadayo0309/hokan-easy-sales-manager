import { describe, expect, it } from 'vitest';

import { assertPeopleInput, calculateEntryDetail } from '../../src/shared/calculations/entries';

describe('weekly entry calculations', () => {
  it('calculates people and visit totals from three visit frequencies', () => {
    const summary = calculateEntryDetail({
      oneVisitPeople: 10,
      twoVisitPeople: 3,
      threeVisitPeople: 2,
      rateOneYen: 8500,
      rateTwoYen: 16000,
      rateThreeYen: 23000
    });

    expect(summary.peopleCount).toBe(15);
    expect(summary.visitCount).toBe(22);
  });

  it('calculates sales from saved rates without adding frequency multipliers', () => {
    const summary = calculateEntryDetail({
      oneVisitPeople: 10,
      twoVisitPeople: 3,
      threeVisitPeople: 2,
      rateOneYen: 8500,
      rateTwoYen: 16000,
      rateThreeYen: 23000
    });

    expect(summary.salesYen).toBe(179000);
    expect(summary.salesYen).not.toBe(321000);
  });

  it('keeps blank people input distinct from zero for validation', () => {
    expect(assertPeopleInput(null)).toBeNull();
    expect(assertPeopleInput(0)).toBe(0);
    expect(() => assertPeopleInput('')).toThrow('PEOPLE_COUNT_INVALID');
  });

  it('calculates monthly entries from the entered monthly count', () => {
    const summary = calculateEntryDetail({
      peopleCount: 5,
      rateYen: 8500,
      billingMode: 'monthly'
    });

    expect(summary.peopleCount).toBe(5);
    expect(summary.salesYen).toBe(42_500);
  });

  it('recalculates monthly entries from the increased monthly count', () => {
    const summary = calculateEntryDetail({
      peopleCount: 7,
      rateYen: 8500,
      billingMode: 'monthly'
    });

    expect(summary.peopleCount).toBe(7);
    expect(summary.salesYen).toBe(59_500);
  });
});
