import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AnnualView from '../../src/renderer/views/AnnualView.vue';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('annual view', () => {
  it.each([
    [new Date(2026, 0, 1), 2025],
    [new Date(2026, 7, 31), 2025],
    [new Date(2026, 8, 1), 2026]
  ])('opens the fiscal year containing %s', async (date, year) => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
    const getAnnual = vi.fn().mockResolvedValue(null);
    vi.stubGlobal('hokanApp', { dashboard: { getAnnual } });

    const wrapper = mount(AnnualView);
    await flushPromises();

    expect(getAnnual).toHaveBeenCalledWith({ year });
    expect(wrapper.text()).toContain(`${year}年9月〜${year + 1}年8月`);
    const input = wrapper.get('input');
    await input.setValue(2024);
    await input.trigger('change');
    await flushPromises();
    expect(getAnnual).toHaveBeenLastCalledWith({ year: 2024 });
    expect(wrapper.text()).toContain('2024年9月〜2025年8月');
    wrapper.unmount();
  });
});
