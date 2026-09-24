import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    // 固定 light，避免本機／runner OS dark mode 讓 slate 文字對比翻車
    colorScheme: 'light',
    // 關掉進場動畫，避免 axe color-contrast 掃到 opacity<1 假陽性
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
