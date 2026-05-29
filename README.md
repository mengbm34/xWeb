# 出库商品 v2 — 使用说明

## 项目结构

```
前端/
├── index.html          # 主页面入口
├── css/
│   └── style.css       # 样式（响应式：移动端 + PC端）
└── js/
    └── app.js          # 业务逻辑（商品、搜索、结算、数据同步）
```

## 响应式布局

| 区域 | 移动端（< 768px） | PC端（≥ 768px） |
|------|-------------------|-----------------|
| 布局 | 单列全宽 | 三栏 grid：侧栏分类 + 商品 + 购物车 |
| 顶部栏 | 标题 + 退出按钮 | 标题 + 内联搜索 + 退出按钮 |
| 搜索栏 | 独立 sticky 栏 | 隐藏（使用顶部内联搜索） |
| 分类 Tab | 底部水平滚动 | 左侧垂直侧栏 |
| 商品列表 | 单列卡片 | 单列（保证名称完整显示） |
| 结算栏 | 固定底部 | 隐藏（用购物车侧栏） |
| 弹窗 | 底部滑出 | 居中对话框 |

## 快速使用

### 方式一：直接打开

双击 `index.html` 即可在浏览器中使用（本地存储模式，无需服务器）。

### 方式二：本地服务器

```bash
cd 前端
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`

## 功能说明

| 功能 | 说明 |
|------|------|
| 分类切换 | 顶部 6 个 Tab（全部/彩妆/护肤口服/洗护/周边/院线） |
| 实时搜索 | 搜索框输入商品名称或编码，200ms 延迟过滤 |
| 数量控制 | 每个商品卡片有 +/− 按钮，也支持手动输入 |
| 实时结算 | 底部固定栏显示已选商品数 + 总金额 |
| 提交出货单 | 弹窗显示商品明细 + 申请人/出库原因 |
| 本地存储 | 未配置 Supabase 时自动降级到 localStorage |

## 开发改进（v2）

相比 v1，本版本做了以下改进：

| 改进项 | 说明 |
|--------|------|
| PC 响应式适配 | 新增桌面端三栏布局（侧栏分类 + 商品网格 + 购物车侧栏） |
| 局部渲染 | 数量变更只更新对应卡片 DOM，不再全量重绘 |
| 不可变状态 | 购物车状态通过 `{ ...cart }` 创建新对象，避免引用污染 |
| WebSocket 断线重连 | 指数退避策略（1s → 2s → 4s → ... → 30s 上限） |
| 提交加载态 | 提交按钮显示旋转 loading，防止重复提交 |
| 输入校验 | 申请人 maxlength=50，出库原因 maxlength=500，数量 max=999 |
| 退出按钮 | 点击弹出 confirm 确认，清空购物车后刷新页面 |
| 代码清理 | 删除全部 console.log / console.warn / console.error |

## 配置 Supabase 云数据库（多设备同步）

### 第一步：创建 Supabase 项目

1. 访问 https://supabase.com 注册账号
2. 创建新项目（免费额度：500MB 存储，2 并发连接）
3. 记录项目 URL 和 anon key

### 第二步：创建数据库表

在 Supabase SQL Editor 中执行下面这段 SQL。两张表都要建：`outbound_orders`（出库申请）和 `products`（商品）。

```sql
-- ========== 出库申请表 ==========
CREATE TABLE IF NOT EXISTS outbound_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant text NOT NULL,
  remark text,
  items jsonb NOT NULL,
  total_amount numeric NOT NULL,
  total_qty integer NOT NULL,
  status text DEFAULT 'pending',          -- 审批状态: pending / approved / rejected
  outbound_status text DEFAULT 'pending', -- 出库状态: pending / shipped
  created_at timestamptz DEFAULT now()
);

-- 开启 Realtime 实时同步（前后台 WebSocket 推送）
ALTER PUBLICATION supabase_realtime ADD TABLE outbound_orders;

-- 行级安全策略：匿名可读/写/改/删
--   后台「标记已出库」需要 UPDATE，批量删除需要 DELETE
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON outbound_orders;
DROP POLICY IF EXISTS "anon_insert" ON outbound_orders;
DROP POLICY IF EXISTS "anon_update" ON outbound_orders;
DROP POLICY IF EXISTS "anon_delete" ON outbound_orders;

CREATE POLICY "anon_select" ON outbound_orders FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON outbound_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON outbound_orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON outbound_orders FOR DELETE USING (true);


-- ========== 商品表 ==========
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,                    -- 商品编码（如 CZ0001）
  name text NOT NULL,
  category text NOT NULL,                 -- 彩妆 / 护肤口服 / 洗护 / 周边 / 院线
  price numeric DEFAULT 0,
  is_active boolean DEFAULT true,         -- 是否上架
  created_at timestamptz DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE products;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON products;
DROP POLICY IF EXISTS "anon_insert" ON products;
DROP POLICY IF EXISTS "anon_update" ON products;
DROP POLICY IF EXISTS "anon_delete" ON products;

CREATE POLICY "anon_select" ON products FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON products FOR DELETE USING (true);
```

> **注意字段命名**：表结构使用 snake_case（`total_amount` / `total_qty` / `created_at` / `outbound_status`）。前端代码已对齐，自定义改动时请保持一致，否则 PostgREST 会以"列不存在"或 NOT NULL 约束失败为由拒绝写入，订单会被静默丢失。

### 第三步：配置前端

通过上述任一方式（运行时注入或直接编辑）配置好 URL 和 key 后：
- 任一设备提交出货单，其他设备会收到实时通知
- 所有数据存储在 Supabase 云端，设备无关

## 推荐部署方式（免费）

| 服务 | 说明 |
|------|------|
| GitHub Pages | 推送到 GitHub 仓库即可 |
| Vercel | 拖拽文件夹即可部署 |
| Netlify | 拖拽文件夹即可部署 |
| Cloudflare Pages | 连接 Git 仓库自动部署 |
