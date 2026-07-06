import type { CalculatedEntrySummary } from '../types/app-api.js';

export interface EntryCalculationInput {
  peopleCount?: number | null;
  rateYen?: number;
  salesYen?: number;
  oneVisitPeople?: number | null;
  twoVisitPeople?: number | null;
  threeVisitPeople?: number | null;
  rateOneYen?: number;
  rateTwoYen?: number;
  rateThreeYen?: number;
}

export function assertPeopleInput(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 99999) {
    throw new Error('PEOPLE_COUNT_INVALID');
  }

  return Number(value);
}

export function isCompletedPeopleInput(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 99999;
}

export function calculateEntryDetail(input: EntryCalculationInput): CalculatedEntrySummary {
  if (input.salesYen !== undefined) {
    const peopleCount =
      input.peopleCount ??
      (input.oneVisitPeople ?? 0) + (input.twoVisitPeople ?? 0) + (input.threeVisitPeople ?? 0);

    return {
      peopleCount,
      visitCount: peopleCount,
      salesYen: input.salesYen
    };
  }

  if (input.peopleCount !== undefined || input.rateYen !== undefined) {
    const peopleCount = input.peopleCount ?? 0;

    return {
      peopleCount,
      visitCount: peopleCount,
      salesYen: peopleCount * (input.rateYen ?? 0)
    };
  }

  const oneVisitPeople = input.oneVisitPeople ?? 0;
  const twoVisitPeople = input.twoVisitPeople ?? 0;
  const threeVisitPeople = input.threeVisitPeople ?? 0;

  return {
    peopleCount: oneVisitPeople + twoVisitPeople + threeVisitPeople,
    visitCount: oneVisitPeople + twoVisitPeople * 2 + threeVisitPeople * 3,
    salesYen:
      oneVisitPeople * (input.rateOneYen ?? 0) +
      twoVisitPeople * (input.rateTwoYen ?? 0) +
      threeVisitPeople * (input.rateThreeYen ?? 0)
  };
}

export function calculateEntrySummary(inputs: EntryCalculationInput[]): CalculatedEntrySummary {
  return inputs.reduce<CalculatedEntrySummary>(
    (summary, input) => {
      const detail = calculateEntryDetail(input);
      return {
        peopleCount: summary.peopleCount + detail.peopleCount,
        visitCount: summary.visitCount + detail.visitCount,
        salesYen: summary.salesYen + detail.salesYen
      };
    },
    { peopleCount: 0, visitCount: 0, salesYen: 0 }
  );
}
