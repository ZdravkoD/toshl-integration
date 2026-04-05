const TOSHL_API_BASE = 'https://api.toshl.com';
const DEFAULT_PER_PAGE = 500;
const DEFAULT_RATE_LIMIT_DELAY_MS = 250;
const MAX_RETRY_ATTEMPTS = 3;

export interface ToshlCurrency {
  code?: string;
  rate?: number;
  main_rate?: number;
  fixed?: boolean;
}

export interface ToshlAccount {
  id: string;
  name?: string;
  currency?: ToshlCurrency;
  balance?: number;
  [key: string]: unknown;
}

export interface ToshlCategory {
  id: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ToshlTag {
  id: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ToshlEntry {
  id: string;
  amount: number;
  date: string;
  desc?: string;
  currency?: ToshlCurrency;
  account?: string;
  category?: string;
  tags?: string[];
  type?: string;
  transaction?: {
    account?: string;
    currency?: ToshlCurrency;
    [key: string]: unknown;
  };
  modified?: string;
  completed?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
}

export interface ToshlClientOptions {
  token?: string;
  fetchImpl?: typeof fetch;
  rateLimitDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getToshlToken(explicitToken?: string) {
  const token = explicitToken || process.env.TOSHL_ACCESS_TOKEN || process.env.TOSHL_API_TOKEN;

  if (!token) {
    throw new Error('Missing Toshl API token. Set TOSHL_ACCESS_TOKEN or TOSHL_API_TOKEN.');
  }

  return token;
}

function normalizeSearchParams(params?: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams;
}

async function fetchWithRetries(
  path: string,
  params: Record<string, string | number | undefined> | undefined,
  options: ToshlClientOptions,
  attempt = 0
) {
  const token = getToshlToken(options.token);
  const fetchImpl = options.fetchImpl || fetch;
  const rateLimitDelayMs = options.rateLimitDelayMs || DEFAULT_RATE_LIMIT_DELAY_MS;
  const searchParams = normalizeSearchParams(params);
  const url = `${TOSHL_API_BASE}${path}${searchParams.size ? `?${searchParams.toString()}` : ''}`;

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (response.status === 429 && attempt + 1 < MAX_RETRY_ATTEMPTS) {
    const retryAfterHeader = response.headers.get('retry-after');
    const retryDelayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : rateLimitDelayMs * (attempt + 2);
    await sleep(Number.isFinite(retryDelayMs) ? retryDelayMs : rateLimitDelayMs);
    return fetchWithRetries(path, params, options, attempt + 1);
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Toshl API request failed (${response.status}): ${responseText || response.statusText}`);
  }

  return response.json();
}

export async function fetchToshlCollection<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  options: ToshlClientOptions = {}
): Promise<T[]> {
  const perPage = Number(params?.per_page || DEFAULT_PER_PAGE);
  const results: T[] = [];
  let page = 0;

  while (true) {
    const pageItems = await fetchWithRetries(
      path,
      { ...params, per_page: perPage, page },
      options
    ) as T[];

    if (!Array.isArray(pageItems)) {
      throw new Error(`Unexpected Toshl API response for ${path}`);
    }

    results.push(...pageItems);
    console.log(`[toshl] fetched ${pageItems.length} item(s) from ${path} page=${page}`);

    if (pageItems.length < perPage) {
      return results;
    }

    page += 1;
    await sleep(options.rateLimitDelayMs || DEFAULT_RATE_LIMIT_DELAY_MS);
  }
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
