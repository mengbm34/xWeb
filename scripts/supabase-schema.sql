-- ============================================================
-- 出库商品 Supabase 数据库 schema（一站式建表 + 策略）
-- 可多次执行（idempotent）：CREATE TABLE IF NOT EXISTS + DROP/CREATE POLICY
-- ============================================================

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

-- 已存在但缺列时补齐
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS outbound_status text DEFAULT 'pending';

-- Realtime 实时订阅（重复添加会报错，所以包成 DO 块）
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE outbound_orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  price numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON products;
DROP POLICY IF EXISTS "anon_insert" ON products;
DROP POLICY IF EXISTS "anon_update" ON products;
DROP POLICY IF EXISTS "anon_delete" ON products;

CREATE POLICY "anon_select" ON products FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON products FOR DELETE USING (true);
