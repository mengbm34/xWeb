/**
 * 验证脚本：确认前台商品数据以 Supabase 为唯一来源，不再冒出硬编码兜底商品。
 *
 * 通过 Playwright 路由拦截 Supabase REST 调用，模拟两种关键场景：
 *   场景1：products 表只有 2 条 → 前台应恰好显示这 2 条（而非历史上的 150 条）。
 *   场景2：products 表为空 + 本地有旧缓存 → 前台应清空缓存、显示空态。
 *
 * 用法：先启动本地服务 `python3 -m http.server 8081`，再 `node scripts/verify-products-fix.mjs`
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8081/index.html';
const PRODUCTS_RE = /\/rest\/v1\/products/;

/** 统计前台实际渲染出的商品卡片编码 */
async function readRenderedIds(page) {
  return page.$$eval('.product-card', (cards) =>
    cards.map((c) => c.getAttribute('data-id'))
  );
}

async function run() {
  const browser = await chromium.launch();
  let failures = 0;

  // ---------- 场景1：只有 2 条真实商品 ----------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.route(PRODUCTS_RE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'A001', name: '真实商品甲', category: '彩妆', price: 10, is_active: true },
          { id: 'A002', name: '真实商品乙', category: '洗护', price: 20, is_active: true },
        ]),
      })
    );
    await page.goto(BASE);
    await page.waitForTimeout(600);
    const ids = await readRenderedIds(page);
    const ok = ids.length === 2 && ids.includes('A001') && ids.includes('A002');
    console.log(`场景1（2条真实商品）: 渲染 ${ids.length} 条 → ${ok ? 'PASS ✓' : 'FAIL ✗ ' + JSON.stringify(ids)}`);
    if (!ok) failures++;
    await ctx.close();
  }

  // ---------- 场景2：空表 + 旧缓存应被清除 ----------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // 预置一份"旧缓存"（含 3 条已被后台删除的商品）
    await page.addInitScript(() => {
      localStorage.setItem(
        'products_cache',
        JSON.stringify([
          { id: 'OLD1', name: '旧商品1', category: '彩妆', price: 1 },
          { id: 'OLD2', name: '旧商品2', category: '彩妆', price: 1 },
          { id: 'OLD3', name: '旧商品3', category: '彩妆', price: 1 },
        ])
      );
    });
    // Supabase 现在返回空表
    await page.route(PRODUCTS_RE, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto(BASE);
    await page.waitForTimeout(600);
    const ids = await readRenderedIds(page);
    const cache = await page.evaluate(() => localStorage.getItem('products_cache'));
    const emptyStateShown = await page.$('.empty-state');
    const ok = ids.length === 0 && cache === '[]' && !!emptyStateShown;
    console.log(`场景2（空表清旧缓存）: 渲染 ${ids.length} 条, 缓存=${cache}, 空态=${!!emptyStateShown} → ${ok ? 'PASS ✓' : 'FAIL ✗'}`);
    if (!ok) failures++;
    await ctx.close();
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\n验证失败：${failures} 个场景未通过`);
    process.exit(1);
  }
  console.log('\n全部场景通过 ✓ 前台不再显示未添加的商品');
}

run().catch((e) => {
  console.error('验证脚本异常：', e);
  process.exit(1);
});
