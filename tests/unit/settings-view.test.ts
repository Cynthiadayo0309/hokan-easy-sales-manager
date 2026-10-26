import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SettingsView from '../../src/renderer/views/SettingsView.vue';
import type { RateSetting, SaveRateSettingsInput } from '../../src/shared/types/app-api';

afterEach(() => vi.unstubAllGlobals());

function mockSettings() {
  const facilities = [
    { id: 1, name: '施設A' },
    { id: 2, name: '施設B' }
  ];
  const nursingCategories = [
    { id: 1, name: '介護' },
    { id: 2, name: '別表7' }
  ];
  let facilityRates: RateSetting[] = [];
  const ratesFor = (facilityId: number | null, amountYen: number) =>
    nursingCategories.map((category) => ({
      id: category.id,
      facilityId,
      nursingCategoryId: category.id,
      visitFrequency: 1 as const,
      amountYen,
      validFrom: '2026-07-01',
      validTo: null,
      createdAt: '',
      updatedAt: ''
    }));
  const commonRates = ratesFor(null, 8500);
  const list = vi.fn(async ({ facilityId }: { facilityId: number | null }) =>
    facilityId === 1 && facilityRates.length ? facilityRates : commonRates
  );
  const save = vi.fn(async (input: SaveRateSettingsInput) => {
    facilityRates = input.rates.map((rate, index) => ({
      ...ratesFor(input.facilityId ?? null, 0)[index],
      amountYen: Number(rate.amountThousandYen) * 1000
    }));
    return facilityRates;
  });
  vi.stubGlobal('hokanApp', {
    setup: { getStatus: vi.fn().mockResolvedValue({ nursingCategories }) },
    facilities: { list: vi.fn().mockResolvedValue(facilities) },
    rates: { list, save },
    targets: { getByMonth: vi.fn().mockResolvedValue([]) }
  });
  return { list, save };
}

describe('settings facility rates', () => {
  it('prevents saving stale rates when a different month cannot be loaded', async () => {
    const { list, save } = mockSettings();
    const wrapper = mount(SettingsView);
    await flushPromises();
    await wrapper.get('.settings-tabs button:nth-child(2)').trigger('click');
    list.mockRejectedValueOnce(new Error('load failed'));
    await wrapper.get('input[type="month"]').setValue('2026-08');
    await flushPromises();
    expect(wrapper.text()).toContain('設定を読み込めませんでした。対象年月を選び直してください。');
    expect(wrapper.get('button.section-action').attributes('disabled')).toBeDefined();
    expect(wrapper.get('select').attributes('disabled')).toBeDefined();
    await wrapper.get('button.section-action').trigger('click');
    expect(save).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('saves the selected facility and displays its rates without changing other facilities', async () => {
    const { save } = mockSettings();
    const wrapper = mount(SettingsView);
    await flushPromises();
    await wrapper.get('.settings-tabs button:nth-child(2)').trigger('click');
    const select = wrapper.get('select');
    expect(wrapper.get('input[aria-label="全施設共通 介護の単価（千円）"]').element).toHaveProperty(
      'value',
      '8.5'
    );

    await select.setValue(1);
    await wrapper.get('input[aria-label="施設A 介護の単価（千円）"]').setValue('10');
    await wrapper.get('input[aria-label="施設A 別表7の単価（千円）"]').setValue('0');
    await wrapper.get('button.section-action').trigger('click');
    await flushPromises();
    expect(save).toHaveBeenCalledWith({
      facilityId: 1,
      validFrom: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      rates: [
        { nursingCategoryId: 1, amountThousandYen: '10' },
        { nursingCategoryId: 2, amountThousandYen: '0' }
      ]
    });
    expect(wrapper.text()).toContain('施設Aの売上単価を保存しました。');
    await select.setValue(2);
    expect(wrapper.get('input[aria-label="施設B 介護の単価（千円）"]').element).toHaveProperty(
      'value',
      '8.5'
    );
    await select.setValue(1);
    expect(wrapper.get('input[aria-label="施設A 介護の単価（千円）"]').element).toHaveProperty(
      'value',
      '10'
    );
    expect(wrapper.get('input[aria-label="施設A 別表7の単価（千円）"]').element).toHaveProperty(
      'value',
      '0'
    );
    wrapper.unmount();
  });

  it('calculates target sales with the rate for each facility', async () => {
    const { save } = mockSettings();
    await save({
      facilityId: 1,
      validFrom: '2026-07-01',
      rates: [
        { nursingCategoryId: 1, amountThousandYen: '10' },
        { nursingCategoryId: 2, amountThousandYen: '0' }
      ]
    });
    const wrapper = mount(SettingsView);
    await flushPromises();
    await wrapper.get('.settings-tabs button:nth-child(3)').trigger('click');
    const rows = wrapper.findAll('.target-row').slice(1);
    for (const row of rows) {
      await row.get('input[type="number"]').setValue(2);
    }
    expect(
      rows.map((row) => (row.get('input[type="text"]').element as HTMLInputElement).value)
    ).toEqual(['20', '0', '17', '17']);
    wrapper.unmount();
  });

  it('reloads rates for the selected month and reports a failed save', async () => {
    const { list, save } = mockSettings();
    const wrapper = mount(SettingsView);
    await flushPromises();
    await wrapper.get('.settings-tabs button:nth-child(2)').trigger('click');
    await wrapper.get('select').setValue(1);
    await wrapper.get('input[type="month"]').setValue('2026-08');
    await flushPromises();
    expect(list).toHaveBeenCalledWith({ facilityId: 1, validOn: '2026-08-01' });
    save.mockRejectedValueOnce(new Error('save failed'));
    await wrapper.get('button.section-action').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('売上単価を保存できませんでした。');
    expect(wrapper.get('input[aria-label="施設A 介護の単価（千円）"]').element).toHaveProperty(
      'value',
      '8.5'
    );
    wrapper.unmount();
  });
});
