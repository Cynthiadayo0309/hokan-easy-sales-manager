import { onUnmounted, ref } from 'vue';

export function useSaveFeedback(durationMs = 5000) {
  const saveFeedback = ref<string | null>(null);
  let timer: number | null = null;

  function clearSaveFeedback(): void {
    saveFeedback.value = null;

    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function showSaveFeedback(label: string): void {
    const savedAt = new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());

    clearSaveFeedback();
    saveFeedback.value = `${label}を保存しました（${savedAt}）`;

    timer = window.setTimeout(() => {
      saveFeedback.value = null;
      timer = null;
    }, durationMs);
  }

  onUnmounted(clearSaveFeedback);

  return {
    clearSaveFeedback,
    saveFeedback,
    showSaveFeedback
  };
}
