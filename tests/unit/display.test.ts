import { describe, expect, it } from 'vitest';

import {
  formatAppEnvironment,
  formatMoneyCompact,
  formatSetupStep
} from '../../src/renderer/utils/display';

describe('display utilities', () => {
  it('formats app environment for users', () => {
    expect(formatAppEnvironment('development')).toBe('開発版');
    expect(formatAppEnvironment('production')).toBe('配布版');
  });

  it('formats setup progress plainly', () => {
    expect(formatSetupStep(1, 4)).toBe('1 / 4');
  });

  it('formats dashboard money in readable units', () => {
    expect(formatMoneyCompact(10_500_000)).toBe('1,050万円');
    expect(formatMoneyCompact(139_000)).toBe('13.9万円');
    expect(formatMoneyCompact(9_000)).toBe('9,000円');
  });
});
