export const CAMPAIGN_PWA_SCOPE = '/campanha'
export const CAMPAIGN_PWA_MANIFEST_PATH = '/campanha/manifest.webmanifest'
export const CAMPAIGN_PWA_SW_PATH = '/campanha/sw.js'
export const CAMPAIGN_PWA_THEME_COLOR = '#c51414'
export const CAMPAIGN_PWA_BACKGROUND_COLOR = '#ffffff'
export const CAMPAIGN_CACHE_PREFIX = 'campanha-'
export const CAMPAIGN_PWA_INSTALL_TOAST_KEY = 'pwa-install-toast-dismissed'
export const CAMPAIGN_PWA_CLEAR_CACHES_MESSAGE = 'clear-campaign-caches' as const

const MANIFEST_ICONS = [
  {
    src: '/campaign-icons/icon-192.png',
    sizes: '192x192',
    type: 'image/png' as const,
    purpose: 'any' as const,
  },
  {
    src: '/campaign-icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png' as const,
    purpose: 'any' as const,
  },
  {
    src: '/campaign-icons/icon-maskable-512.png',
    sizes: '512x512',
    type: 'image/png' as const,
    purpose: 'maskable' as const,
  },
]

/** Precache list: manifest icons + apple-touch (not in the web manifest). */
export const CAMPAIGN_PWA_ICON_PATHS = [
  ...MANIFEST_ICONS.map((icon) => icon.src),
  '/campaign-icons/apple-touch-icon.png',
] as const

export type CampaignWebManifest = {
  name: string
  short_name: string
  description: string
  start_url: string
  scope: string
  display: 'standalone'
  lang: string
  theme_color: string
  background_color: string
  icons: typeof MANIFEST_ICONS
}

export const CAMPAIGN_WEB_MANIFEST: CampaignWebManifest = {
  name: 'Campanha Jorge Solla',
  short_name: 'Campanha',
  description: 'Ferramenta de campo da campanha Jorge Solla',
  start_url: CAMPAIGN_PWA_SCOPE,
  scope: CAMPAIGN_PWA_SCOPE,
  display: 'standalone',
  lang: 'pt-BR',
  theme_color: CAMPAIGN_PWA_THEME_COLOR,
  background_color: CAMPAIGN_PWA_BACKGROUND_COLOR,
  icons: MANIFEST_ICONS,
}

export const resolveCampaignPwaBuildId = (
  env: Record<string, string | undefined> = process.env,
): string => env.VERCEL_GIT_COMMIT_SHA || env.VERCEL_DEPLOYMENT_ID || 'dev'

export const buildCampaignServiceWorkerScript = (buildId: string): string => {
  const cacheName = `${CAMPAIGN_CACHE_PREFIX}${buildId}`
  const precache = JSON.stringify([
    `${CAMPAIGN_PWA_SCOPE}/login`,
    `${CAMPAIGN_PWA_SCOPE}/offline`,
    ...CAMPAIGN_PWA_ICON_PATHS,
  ])

  return `/* Campaign PWA service worker — build ${buildId} */
const CACHE_NAME = ${JSON.stringify(cacheName)};
const CACHE_PREFIX = ${JSON.stringify(CAMPAIGN_CACHE_PREFIX)};
const PRECACHE_URLS = ${precache};
const CLEAR_CACHES_MESSAGE = ${JSON.stringify(CAMPAIGN_PWA_CLEAR_CACHES_MESSAGE)};
const SCOPE = ${JSON.stringify(CAMPAIGN_PWA_SCOPE)};
const OFFLINE_URL = SCOPE + '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === CLEAR_CACHES_MESSAGE) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))),
        ),
    );
  }
});

const isCampaignPath = (pathname) =>
  pathname === SCOPE || pathname.startsWith(SCOPE + '/');

const isInvitePath = (pathname) => pathname.startsWith(SCOPE + '/convite');

const isCampaignIconPath = (pathname) => pathname.startsWith('/campaign-icons/');

const isRscRequest = (request) =>
  request.headers.get('RSC') === '1' || request.headers.has('Next-Router-State-Tree');

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async (request, { navigate = false } = {}) => {
  try {
    const response = await fetch(request);
    if (response && response.ok && !isRscRequest(request)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (!navigate) throw new Error('offline');
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Invite pages are force-no-store and must never be cached.
  if (isInvitePath(url.pathname)) return;

  if (isCampaignIconPath(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (!isCampaignPath(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, { navigate: true }));
    return;
  }

  // RSC/Flight GETs: network-only (never write personalized payloads to Cache Storage).
  if (isRscRequest(request)) return;

  event.respondWith(networkFirst(request));
});

// Push / notificationclick handlers land in D2 (notifications.md).
`
}
