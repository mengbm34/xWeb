/**
 * 用 Playwright 自动在 Supabase SQL Editor 里执行 schema 脚本
 *
 * 用法：
 *   node scripts/run-supabase-sql.mjs
 *
 * 首次执行会打开有头浏览器，需要你在弹出的窗口完成一次 Supabase 登录；
 * 登录态会持久化到 scripts/.playwright-user-data，下次直接复用、无需再登录。
 */

import { chromium } from 'playwright';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_FILE = path.join(__dirname, 'supabase-schema.sql');
const USER_DATA_DIR = path.join(__dirname, '.playwright-user-data');

// Supabase 项目标识 — 从 supabase-client.js 里的 URL 提取
const PROJECT_REF = 'qlkmuluomqxdqoubcois';
const SQL_EDITOR_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 给用户 5 分钟登录

const isMac = process.platform === 'darwin';
const MOD = isMac ? 'Meta' : 'Control';

function log(msg) {
  console.log(`[supabase-sql] ${msg}`);
}

async function main() {
  const sql = await readFile(SQL_FILE, 'utf-8');
  log(`SQL 已加载（${sql.split('\n').length} 行）`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  // 允许剪贴板读写，便于粘贴 SQL
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'https://supabase.com',
  });

  const page = context.pages()[0] || await context.newPage();

  log('打开 Supabase SQL Editor...');
  await page.goto(SQL_EDITOR_URL, { waitUntil: 'domcontentloaded' });

  log('==============================================================');
  log('如未登录，请在弹出的浏览器窗口完成 Supabase 登录');
  log('⚠️ 不要走 Google OAuth（Google 会拒绝自动化浏览器）');
  log('   推荐：Supabase 邮箱 magic link，或 GitHub 账号密码直接登录');
  log('登录成功后会自动跳回 SQL Editor，本脚本随后接管');
  log('==============================================================');

  // 轮询等待：直到 URL 进入 SQL Editor 且 Monaco editor 出现
  // 容错处理：用户跳转、登录失败、误关 tab 都不会让脚本立刻挂掉
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let editorReady = false;
  while (Date.now() < deadline) {
    try {
      // 整个 context 都被用户关了，没法继续
      if (context.pages().length === 0) {
        throw new Error('浏览器窗口已被关闭');
      }
      const activePage = context.pages()[0];
      const url = activePage.url();
      if (url.includes('/sql/')) {
        const has = await activePage.$('.monaco-editor');
        if (has) {
          editorReady = true;
          break;
        }
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      if (String(e.message).includes('窗口已被关闭')) throw e;
      // 其他临时异常忽略，继续轮询
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!editorReady) {
    throw new Error('5 分钟内未检测到 SQL Editor 就绪，可能登录未完成');
  }
  log('SQL Editor 已就绪');

  // 等 monaco 完全初始化
  await page.waitForTimeout(1500);

  // 优先尝试用 Monaco API 设值（最可靠）
  const setViaMonaco = await page.evaluate((text) => {
    try {
      // monaco 可能挂在 window 或者通过模块系统加载
      const mon = window.monaco;
      if (mon && mon.editor) {
        const editors = mon.editor.getEditors ? mon.editor.getEditors() : [];
        if (editors.length > 0) {
          editors[0].setValue(text);
          editors[0].focus();
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }, sql);

  if (setViaMonaco) {
    log('已通过 Monaco API 写入 SQL');
  } else {
    log('Monaco API 不可用，回退用剪贴板 + 键盘粘贴');

    // 聚焦 editor
    await page.click('.monaco-editor');
    await page.waitForTimeout(300);

    // 全选清空已有内容
    await page.keyboard.press(`${MOD}+A`);
    await page.keyboard.press('Delete');

    // 把 SQL 写剪贴板
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, sql);

    // 粘贴
    await page.keyboard.press(`${MOD}+V`);
    log('已粘贴 SQL');
  }

  await page.waitForTimeout(800);

  // 触发 Run：Cmd/Ctrl + Enter 是 Supabase SQL Editor 的快捷键
  log('触发 Run（Cmd/Ctrl + Enter）...');
  await page.keyboard.press(`${MOD}+Enter`);

  // 等执行结果
  log('等待执行结果（最多 30 秒）...');
  let resultSummary = '未捕获到结果文本';
  try {
    // 等待结果区域出现 — Supabase Dashboard 会在底部显示成功提示或错误
    await page.waitForTimeout(8000);

    // 把页面上看起来像"结果/错误"的文本提取出来
    resultSummary = await page.evaluate(() => {
      const candidates = [
        ...document.querySelectorAll('[role="status"]'),
        ...document.querySelectorAll('[class*="toast" i]'),
        ...document.querySelectorAll('[class*="result" i]'),
        ...document.querySelectorAll('[class*="error" i]'),
        ...document.querySelectorAll('[class*="success" i]'),
      ];
      const texts = candidates
        .map(el => (el.innerText || '').trim())
        .filter(Boolean);
      return [...new Set(texts)].slice(0, 20).join('\n---\n');
    });
  } catch (e) {
    log(`抓取结果时出错：${e.message}`);
  }

  log('=== 执行结果（页面上抓取到的文本片段）===');
  console.log(resultSummary || '(空)');
  log('============================================');

  // 截图存档
  const shotPath = path.join(__dirname, 'supabase-sql-result.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  log(`已截图：${shotPath}`);

  log('浏览器窗口保持打开 30 秒供你目视确认（绿色 Success 即成功）...');
  await page.waitForTimeout(30000);

  await context.close();
  log('完成');
}

main().catch(err => {
  console.error('[supabase-sql] 失败：', err);
  process.exit(1);
});
