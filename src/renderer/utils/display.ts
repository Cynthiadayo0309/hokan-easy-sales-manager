export function formatAppEnvironment(environment: 'development' | 'production'): string {
  return environment === 'production' ? '配布版' : '開発版';
}

export function formatSetupStep(current: number, total: number): string {
  return `${current} / ${total}`;
}

export function formatMoneyCompact(amountYen: number): string {
  if (Math.abs(amountYen) < 10_000) {
    return `${amountYen.toLocaleString('ja-JP')}円`;
  }

  const tenThousandYen = Math.round(amountYen / 1000) / 10;
  const formatted = Number.isInteger(tenThousandYen)
    ? tenThousandYen.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
    : tenThousandYen.toLocaleString('ja-JP', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1
      });

  return `${formatted}万円`;
}
