import { ProductError } from '../product-errors.js?v=d9c621f21a24d07670f8e44abfdbed54027be3e3';

function retryDelay(value) {
  if (value === null) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(60_000, Math.min(Number.MAX_SAFE_INTEGER - Date.now(), seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(60_000, date - Date.now()) : 60_000;
}

export function createOffJsonClient({ fetchImpl = globalThis.fetch, timeoutMs = 10000, headers = {} } = {}) {
  async function getJson(url, signal) {
    if (signal?.aborted) throw new ProductError('cancelled');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    let timer;
    try {
      const operation = (async () => {
        const response = await fetchImpl(url.href, {
          method: 'GET', mode: 'cors', credentials: 'omit',
          headers, signal: controller.signal,
        });
        if (response.status === 429) throw new ProductError('rate-limit', retryDelay(response.headers.get('Retry-After')));
        if (response.status === 403) throw new ProductError('forbidden');
        if (response.status >= 500) throw new ProductError('server');
        if (response.status === 404) return null;
        if (!response.ok) throw new ProductError('response');
        try { return await response.json(); } catch { throw new ProductError('response'); }
      })();
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new ProductError('timeout')); }, timeoutMs);
      });
      return await Promise.race([operation, deadline]);
    } catch (error) {
      if (timedOut) throw new ProductError('timeout');
      if (signal?.aborted) throw new ProductError('cancelled');
      if (error instanceof ProductError) throw error;
      throw new ProductError('network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  return getJson;
}
