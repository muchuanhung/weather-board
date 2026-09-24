import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { mockWeatherOk } from './mock-weather.js'

// 通過不代表無障礙。這裡的目的是防止已經修好的問題被改回去。
const BLOCKING = ['critical', 'serious']

function scan(page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
}

function report({ violations, incomplete }) {
  for (const violation of violations) {
    console.log(
      `[${violation.impact}] ${violation.id} — ${violation.help}（${violation.nodes.length} 處）`
    )
    for (const node of violation.nodes) {
      console.log(`    ${node.target.join(' ')}`)
    }
  }

  for (const item of incomplete) {
    console.log(`[需人工檢視 / ${item.impact}] ${item.id}（${item.nodes.length} 處）`)
  }

  return violations
    .filter((violation) => BLOCKING.includes(violation.impact))
    .map((violation) => `${violation.impact}/${violation.id}（${violation.nodes.length} 處）`)
}

async function gotoReady(page) {
  await mockWeatherOk(page)
  await page.goto('/')
  // 只在 a11y 掃關掉進場動畫（不改 globals.css），避免 axe 掃到 opacity<1 假陽性
  await page.addStyleTag({
    content: `
      .animate-fade-in-up,
      .animate-fade-in-left,
      .animate-fade-in-right,
      .animate-card-content {
        animation: none !important;
      }
    `,
  })
  await expect(page.getByText('現在天氣')).toBeVisible({ timeout: 30_000 })
}

test('首頁沒有 critical/serious 等級的無障礙問題', async ({ page }) => {
  await gotoReady(page)
  expect(report(await scan(page))).toEqual([])
})

test('搜尋後的狀態也沒有 critical/serious 等級的無障礙問題', async ({ page }) => {
  await gotoReady(page)

  const search = page.getByLabel('搜尋城市')
  await search.fill('Kaohsiung')
  await search.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kaohsiung')
  await expect(page.getByText('現在天氣')).toBeVisible({ timeout: 30_000 })

  expect(report(await scan(page))).toEqual([])
})
