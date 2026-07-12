/// <reference types="vite/client" />

import { describe, expect, test } from 'vitest';

import index from '../index.html?raw';
import manifestText from '../public/manifest.webmanifest?raw';
import serviceWorker from '../public/sw.js?raw';

describe('PWA install assets', () => {
  test('manifest exposes install metadata and maskable svg icons', () => {
    const manifest = JSON.parse(manifestText);

    expect(manifest).toMatchObject({
      name: '로컬 가계부',
      short_name: '가계부',
      start_url: '/',
      display: 'standalone',
      theme_color: '#2864a6',
      background_color: '#eef4f7',
    });
    expect(manifest.icons).toEqual([
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ]);
  });

  test('service worker caches app shell and only handles same-origin GET requests', () => {
    expect(serviceWorker).toContain("const cacheName = 'local-budget-app-v2'");
    expect(serviceWorker).toContain("'/manifest.webmanifest'");
    expect(serviceWorker).toContain("'/icons/icon-192.svg'");
    expect(serviceWorker).toContain("event.request.method !== 'GET'");
    expect(serviceWorker).toContain('event.request.url.startsWith(self.location.origin)');
    expect(serviceWorker).toContain('isFreshAppAsset(event.request)');
    expect(serviceWorker).toContain('function fetchAndCache(request)');
    expect(serviceWorker).toContain('return fetch(request)');
    expect(serviceWorker).toContain('cachedResponse ?? fetch(event.request)');
  });

  test('index advertises the manifest and matching theme color', () => {
    expect(index).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(index).toContain('<meta name="theme-color" content="#2864a6" />');
  });
});
