import { expect, test } from '@playwright/test'

// Runs only under playwright.pwa.config.ts (`pnpm test:pwa`), never the main
// `pnpm test` config — see that config's header comment. It needs a real
// production build (`vite build` + `vite preview`) because vite-plugin-pwa's
// injectManifest pipeline (src/sw.ts -> dist/sw.js + manifest.webmanifest)
// only runs during `vite build`; Vite's dev server never produces a real
// service worker to register against.

test.describe('PWA installability', () => {
  test('manifest.webmanifest is served and valid', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/manifest.webmanifest`)
    expect(response.ok()).toBe(true)

    const manifest = await response.json()

    expect(manifest.name).toBe('OpenRep')
    expect(manifest.short_name).toBe('OpenRep')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')

    expect(Array.isArray(manifest.icons)).toBe(true)
    const icon192 = manifest.icons.find((icon: { sizes?: string }) => icon.sizes === '192x192')
    const icon512 = manifest.icons.find((icon: { sizes?: string }) => icon.sizes === '512x512')
    expect(icon192, 'manifest must include a 192x192 icon').toBeTruthy()
    expect(icon512, 'manifest must include a 512x512 icon').toBeTruthy()

    const maskableIcon = manifest.icons.find(
      (icon: { purpose?: string }) => icon.purpose === 'maskable',
    )
    expect(maskableIcon, 'manifest must include a maskable icon').toBeTruthy()
  })

  test('service worker registers on load', async ({ page }) => {
    await page.goto('/')

    // UpdatePrompt (mounted at the root layout) is what triggers
    // registration via useRegisterSW — see src/main.tsx. Waiting on
    // navigator.serviceWorker.ready proves a real SW actually activated
    // against the production build, not just that registration was
    // *attempted*.
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.scope
    })

    expect(scope).toContain('/')
  })

  test('every navigation gets the same precached shell, except /api', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    // The first load isn't controlled yet; a reload is.
    await page.reload()

    // Otherwise `/` would serve the cached (old) shell while a deep link
    // fetched the new one from the server, so which build you ran after an
    // upgrade depended on the URL you opened.
    for (const path of ['/', '/workouts/999999', '/settings']) {
      const response = await page.goto(path)
      expect(response?.fromServiceWorker(), path).toBe(true)
    }

    const docs = await page.goto('/api/docs')
    expect(docs?.fromServiceWorker()).toBe(false)
  })

  test('/api/exercises is not intercepted by the service worker', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)

    // Regression guard for SPEC-pwa-shell.md assumption #5: this module's
    // service worker (src/sw.ts) is precache-only and must never intercept
    // /api/*. If a future change (the offline-data module) starts caching
    // API responses without updating this spec, `response.fromServiceWorker`
    // flips to true and this assertion fails loudly.
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('/api/exercises')),
      page.evaluate(() => fetch('/api/exercises')),
    ])

    expect(response.ok()).toBe(true)
    expect(response.fromServiceWorker()).toBe(false)
  })
})
