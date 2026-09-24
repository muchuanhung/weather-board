import { expect, test } from '@playwright/test'

import { mockWeatherOk } from './mock-weather.js'

// 只驗「頁面活著、主要區塊有渲染、搜尋框在」。

test('首頁可以開，主標題與搜尋框都在', async ({ page }) => {
  await mockWeatherOk(page)
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)

  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toBeVisible()
  await expect(heading).not.toBeEmpty()

  await expect(page.getByLabel('搜尋城市')).toBeVisible()
})

test('搜尋城市後，主標題會換成輸入的城市', async ({ page }) => {
  await mockWeatherOk(page)
  await page.goto('/')

  const search = page.getByLabel('搜尋城市')
  await search.fill('Kaohsiung')
  await search.press('Enter')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kaohsiung')
})
