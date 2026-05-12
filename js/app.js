/**
 * 出库商品 v2 — 业务逻辑
 * 包含：商品数据、分类切换、搜索、数量控制、结算、Supabase 数据层
 */

// ==================== 配置 ====================
const CONFIG = {
  supabaseUrl: window.__SUPABASE_URL__ || 'YOUR_SUPABASE_URL',
  supabaseKey: window.__SUPABASE_ANON_KEY__ || 'YOUR_SUPABASE_ANON_KEY',
};

// ==================== 商品数据（硬编码兜底） ====================
var HARDCODED_PRODUCTS = [
  // 彩妆
  { id: 'CZ0001', name: '焕彩修颜隔离霜', category: '彩妆', price: 128 },
  { id: 'CZ0002', name: '植萃润手霜', category: '彩妆', price: 68 },
  { id: 'CZ0003', name: '轻妆靓颜气垫粉底液I (柔肤色)', category: '彩妆', price: 158 },
  { id: 'CZ0004', name: '轻妆靓颜气垫粉底液Ⅱ (自然色)', category: '彩妆', price: 158 },
  { id: 'CZ0007', name: '丝绒柔雾口红(#63微豆沙)', category: '彩妆', price: 98 },
  { id: 'CZ0008', name: '丝绒柔雾口红(#999赤焰正红)', category: '彩妆', price: 98 },
  { id: 'CZ001', name: '焕彩修颜隔离霜(5g体验装)', category: '彩妆', price: 0 },
  { id: 'CZ0010', name: '自在八色全脸盘(#蔷薇大地)', category: '彩妆', price: 128 },
  { id: 'CZ0011', name: '丝绒柔雾口红(#196摩登暖橘)', category: '彩妆', price: 128 },
  { id: 'CZ0012', name: '水镜光润口红(#415瑰夏)', category: '彩妆', price: 128 },
  { id: 'CZ0013', name: '牛油果沁润卸妆膏', category: '彩妆', price: 168 },
  { id: 'CZ0014', name: '柔焦定妆蜜粉', category: '彩妆', price: 168 },
  { id: 'CZ0015', name: '光感修容高光盘', category: '彩妆', price: 168 },
  { id: 'CZ0016', name: '水漾唇部精华', category: '彩妆', price: 168 },
  { id: 'CZ0017', name: '丝绒柔雾唇釉(#26奶茶色)', category: '彩妆', price: 78 },
  { id: 'CZ0018', name: '丝绒柔雾唇釉(#56复古红)', category: '彩妆', price: 78 },
  { id: 'CZ0019', name: '臻致眼部精华护理液', category: '彩妆', price: 98 },
  { id: 'CZ0020', name: '雾感立体眉粉笔(茶褐色)', category: '彩妆', price: 78 },
  { id: 'CZ0021', name: '雾感立体眉粉笔(烟灰色)', category: '彩妆', price: 78 },
  { id: 'CZ0022', name: '胡萝卜素柔润护唇膏(#倾城)', category: '彩妆', price: 39 },
  { id: 'CZ0023', name: '胡萝卜素柔润护唇膏(#映玉)', category: '彩妆', price: 39 },
  { id: 'CZ0024', name: '牛油果保湿护唇膏', category: '彩妆', price: 39 },

  // 护肤口服
  { id: 'JM0001', name: '奢润臻颜御纹精华', category: '护肤口服', price: 59 },
  { id: 'KF0007', name: 'AKG+抗糖抗氧抗初老精华饮', category: '护肤口服', price: 199 },
  { id: 'KF0008', name: '胶原蛋白肽饮', category: '护肤口服', price: 169 },
  { id: 'KF0009', name: '葡萄籽花青素精华胶囊', category: '护肤口服', price: 199 },
  { id: 'MM0001', name: '奢润水光精华面膜', category: '护肤口服', price: 59 },
  { id: 'MM0002', name: '积雪草修护面膜', category: '护肤口服', price: 129 },
  { id: 'MM0003', name: '玻尿酸补水保湿面膜', category: '护肤口服', price: 59 },
  { id: 'MM0004', name: '紧致提拉面膜', category: '护肤口服', price: 59 },
  { id: 'MM0010', name: '烟酰胺亮肤面膜', category: '护肤口服', price: 98 },
  { id: 'MS0002', name: '神经酰胺修护精华', category: '护肤口服', price: 129 },
  { id: 'PW0001', name: '小分子肽修护套装', category: '护肤口服', price: 98 },
  { id: 'PW0005', name: '富勒烯抗氧套装', category: '护肤口服', price: 129 },
  { id: 'PW0006', name: '依克多因修护精华', category: '护肤口服', price: 98 },
  { id: 'PW0007', name: '蓝铜胜肽抗老精华(PLUS版)', category: '护肤口服', price: 129 },
  { id: 'PW0008', name: '依克多因水光精华(PLUS版)', category: '护肤口服', price: 69 },

  // 洗护
  { id: 'XH010', name: '氨基酸温和洁面乳(50ml体验装)', category: '洗护', price: 0 },
  { id: 'XH011', name: '玻尿酸洁面乳(50ml体验装)', category: '洗护', price: 0 },
  { id: 'XH012', name: '氨基酸洁面慕斯(50ml体验装)', category: '洗护', price: 0 },
  { id: 'XH013', name: '山茶花氨基酸洁面慕斯', category: '洗护', price: 0 },
  { id: 'XH014', name: '山茶花沐浴露', category: '洗护', price: 0 },
  { id: 'XH015', name: '山茶花护发素', category: '洗护', price: 0 },
  { id: 'XH016', name: '山茶花洗发水', category: '洗护', price: 98 },
  { id: 'XH017', name: '山茶花沐浴露(正装)', category: '洗护', price: 78 },
  { id: 'XH018', name: '山茶花护发素(正装)', category: '洗护', price: 78 },
  { id: 'XH019', name: '角鲨烷融融身体冷霜', category: '洗护', price: 0 },
  { id: 'XH020', name: '奢宠肌肤氨基酸沐浴露(无界香型)', category: '洗护', price: 0 },
  { id: 'XH021', name: '白池花琥珀香氛沐浴油(白檀香型)', category: '洗护', price: 0 },
  { id: 'YX0001', name: '奢护洗发露', category: '洗护', price: 260 },
  { id: 'YX0002', name: '奢护发膜(50ml)', category: '洗护', price: 0 },
  { id: 'YX0003', name: '氨基酸洁面乳(正装)', category: '洗护', price: 139 },
  { id: 'YX0004', name: '玻尿酸补水面膜', category: '洗护', price: 100 },
  { id: 'YX0005', name: '神经酰胺修护乳', category: '洗护', price: 100 },
  { id: 'YX0006', name: '依克多因修护霜', category: '洗护', price: 100 },
  { id: 'YX0007', name: '烟酰胺亮肤精华液', category: '洗护', price: 40 },
  { id: 'YX0008', name: '富勒烯抗氧面膜', category: '洗护', price: 139 },
  { id: 'YX0009', name: '烟酰胺亮肤精华水', category: '洗护', price: 80 },
  { id: 'YX0010', name: '玻尿酸补水面膜(院线版)', category: '洗护', price: 80 },
  { id: 'YX0011', name: '蓝铜胜肽抗老面膜', category: '洗护', price: 100 },
  { id: 'YX0012', name: '依克多因修护面膜', category: '洗护', price: 100 },
  { id: 'YX0013', name: '角鲨烷修护精华', category: '洗护', price: 120 },
  { id: 'YX0014', name: '玻尿酸补水面膜(院线体验)', category: '洗护', price: 120 },
  { id: 'YX0015', name: '神经酰胺修护精华(50ml)', category: '洗护', price: 120 },
  { id: 'YX0016', name: '氨基酸洁面慕斯(院线)', category: '洗护', price: 120 },
  { id: 'YX0017', name: '烟酰胺亮肤面膜', category: '洗护', price: 166 },
  { id: 'YX0018', name: '氨基酸洁面慕斯(院线体验)', category: '洗护', price: 120 },
  { id: 'YX0019', name: '玻尿酸补水面膜(院线版)', category: '洗护', price: 80 },
  { id: 'YX0020', name: '富勒烯抗氧面膜(院线)', category: '洗护', price: 100 },
  { id: 'YX0021', name: '神经酰胺修护面膜', category: '洗护', price: 80 },
  { id: 'YX0022', name: '蓝铜胜肽抗老面膜(院线)', category: '洗护', price: 299 },
  { id: 'YX0023', name: '依克多因修护套装(院线)', category: '洗护', price: 840 },
  { id: 'YX0024', name: 'DNA修护洗发露(院线)', category: '洗护', price: 498 },
  { id: 'YX0025', name: '奢润面膜(院线版)', category: '洗护', price: 399 },
  { id: 'YX0026', name: '氨基酸洗护套装(院线)', category: '洗护', price: 158 },
  { id: 'YX0027', name: '玻尿酸补水面膜+洗护套装', category: '洗护', price: 120 },

  // 周边
  { id: 'QT0007', name: '化妆包A2 296', category: '周边', price: 429 },
  { id: 'QT0010', name: '礼盒', category: '周边', price: 2 },
  { id: 'QT0015', name: '美妆蛋', category: '周边', price: 1.16 },
  { id: 'QT0018', name: '化妆刷2号 桑妮专属礼盒刷套组', category: '周边', price: 0.66 },
  { id: 'QT0019', name: '化妆刷套装', category: '周边', price: 9.66 },
  { id: 'QT0021', name: '化妆棉', category: '周边', price: 9.8 },
  { id: 'QT0023', name: '桑妮定制发圈', category: '周边', price: 1680 },
  { id: 'QT0024', name: '桑妮定制粉扑', category: '周边', price: 980 },
  { id: 'QT0025', name: '桑妮定制化妆袋', category: '周边', price: 1280 },
  { id: 'QT0031', name: '桑妮专属礼盒', category: '周边', price: 98 },
  { id: 'QT0033', name: '定制礼盒(大)', category: '周边', price: 10 },
  { id: 'QT0036', name: '定制礼盒(中)', category: '周边', price: 10 },
  { id: 'QT0037', name: '定制礼盒(小)', category: '周边', price: 10 },
  { id: 'QT0038', name: '定制礼盒(特大)', category: '周边', price: 10 },
  { id: 'QT0039', name: '定制礼盒(超大)', category: '周边', price: 10 },
  { id: 'QT0041', name: '试用装随机发', category: '周边', price: 10 },
  { id: 'QT0042', name: '试用装随机发(PLUS)', category: '周边', price: 10 },
  { id: 'QT0044', name: '积分兑换专区', category: '周边', price: 10 },
  { id: 'QT0045', name: '新品体验礼盒', category: '周边', price: 499 },
  { id: 'QT0046', name: '会员专属礼盒套装', category: '周边', price: 599 },
  { id: 'QT0047', name: '桑妮限定节日礼盒', category: '周边', price: 1980 },
  { id: 'QT0048', name: '桑妮限定礼盒(M)', category: '周边', price: 1080 },
  { id: 'QT0049', name: '桑妮限定礼盒(S)', category: '周边', price: 1380 },
  { id: 'QT0050', name: '桑妮限定礼盒(XS)', category: '周边', price: 1380 },
  { id: 'QT0051', name: '会员专属礼袋', category: '周边', price: 1280 },
  { id: 'QT0052', name: '桑妮专属礼品袋', category: '周边', price: 1580 },
  { id: 'QT0053', name: '桑妮专属礼袋(大)', category: '周边', price: 2180 },
  { id: 'QT0054', name: '桑妮专属礼袋(特大)', category: '周边', price: 499 },
  { id: 'QT0055', name: '随机礼品', category: '周边', price: 10 },
  { id: 'QT0056', name: '随机礼品(大)', category: '周边', price: 10 },
  { id: 'QT0057', name: '随机礼品(小)', category: '周边', price: 10 },
  { id: 'QT0059', name: '积分兑换礼品', category: '周边', price: 199 },
  { id: 'QT0060', name: '积分兑换礼品(大)', category: '周边', price: 199 },
  { id: 'QT0061', name: '积分兑换礼品(特大)', category: '周边', price: 199 },
  { id: 'QT0062', name: '20000积分兑换礼品', category: '周边', price: 89 },
  { id: 'QT0063', name: '10000mL礼品卡', category: '周边', price: 129 },
  { id: 'QT0064', name: '礼品卡', category: '周边', price: 68 },
  { id: 'QT0065', name: '礼品券', category: '周边', price: 38 },
  { id: 'QT0072', name: '积分兑换礼品卡', category: '周边', price: 3.96 },
  { id: 'QT0073', name: '免费试用装', category: '周边', price: 10 },
  { id: 'QT0074', name: '免费礼品', category: '周边', price: 10 },
  { id: 'QT0075', name: '积分礼品', category: '周边', price: 2.98 },
  { id: 'QT0076', name: '会员专属积分礼品', category: '周边', price: 59.8 },
  { id: 'QT0078', name: '积分兑换', category: '周边', price: 10 },
  { id: 'QT0079', name: '积分兑换 桑妮专属', category: '周边', price: 98 },
  { id: 'QT0080', name: '积分兑换 桑妮专属(L)', category: '周边', price: 98 },
  { id: 'QT0081', name: '积分兑换 桑妮专属(XL)', category: '周边', price: 98 },
  { id: 'QT0082', name: '积分兑换 桑妮专属(XXL)', category: '周边', price: 98 },
  { id: 'QT0083', name: '积分兑换 桑妮专属(XXXL)', category: '周边', price: 98 },

  // 院线
  { id: 'BC5082', name: '桑妮专属院线礼盒', category: '院线', price: 10 },
  { id: 'BC5085', name: '桑妮专属院线礼盒(大)', category: '院线', price: 10 },
  { id: 'BC5086', name: '桑妮专属院线礼盒(特大)', category: '院线', price: 10 },
  { id: 'BC5118', name: '院线专用面膜 (150ml)', category: '院线', price: 10 },
  { id: 'BC5119', name: '院线专用精华 (180ml)', category: '院线', price: 10 },
  { id: 'BC5122', name: '院线专用洁面', category: '院线', price: 10 },
  { id: 'MM0016', name: '桑妮水光弹润面膜', category: '院线', price: 198 },
];

// ==================== 动态商品数据（前台显示来源） ====================
var PRODUCTS = [];

/**
 * 从 Supabase 加载商品数据
 * 降级策略：Supabase → localStorage 缓存 → 硬编码兜底
 */
async function loadProductsFromSupabase() {
  try {
    var data = await SupabaseClient.restQuery('products', 'is_active=eq.true&order=id.asc');
    if (data && data.length > 0) {
      PRODUCTS = data.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          price: parseFloat(p.price) || 0,
        };
      });
      // 缓存到 localStorage
      localStorage.setItem('products_cache', JSON.stringify(PRODUCTS));
      return;
    }
  } catch (e) {
    // 继续尝试缓存
  }

  // 降级：读 localStorage 缓存
  var cached = localStorage.getItem('products_cache');
  if (cached) {
    try {
      PRODUCTS = JSON.parse(cached);
      return;
    } catch (e) {
      // 缓存损坏，继续兜底
    }
  }

  // 最终兜底：硬编码数据
  PRODUCTS = HARDCODED_PRODUCTS;
}

/**
 * 获取分类列表（动态从商品数据中提取）
 */
function getCategories() {
  var cats = ['全部'];
  var seen = {};
  PRODUCTS.forEach(function (p) {
    if (!seen[p.category]) {
      seen[p.category] = true;
      cats.push(p.category);
    }
  });
  return cats;
}
let state = {
  activeCategory: '全部',
  searchQuery: '',
  cart: {},
  submitting: false,
};

// ==================== DOM 缓存 ====================
const dom = {};

function cacheDom() {
  dom.tabBar = document.getElementById('tabBar');
  dom.sidebarTabs = document.getElementById('sidebarTabs');
  dom.productList = document.getElementById('productList');
  dom.searchInput = document.getElementById('searchInput');
  dom.searchInline = document.getElementById('searchInline');
  dom.checkoutTotal = document.getElementById('checkoutTotal');
  dom.checkoutCount = document.getElementById('checkoutCount');
  dom.btnCheckout = document.getElementById('btnCheckout');
  dom.btnCheckoutDesktop = document.getElementById('btnCheckoutDesktop');
  dom.cartSummary = document.getElementById('cartSummary');
  dom.cartItems = document.getElementById('cartItems');
  dom.cartTotal = document.getElementById('cartTotal');
  dom.cartCount = document.getElementById('cartCount');
  dom.inputNameDesktop = document.getElementById('inputNameDesktop');
  dom.inputRemarkDesktop = document.getElementById('inputRemarkDesktop');
  dom.modalOverlay = document.getElementById('modalOverlay');
  dom.orderItems = document.getElementById('orderItems');
  dom.inputName = document.getElementById('inputName');
  dom.inputRemark = document.getElementById('inputRemark');
  dom.btnCancel = document.getElementById('btnCancel');
  dom.btnSubmitOrder = document.getElementById('btnSubmitOrder');
  dom.toast = document.getElementById('toast');
  dom.btnCancel = document.getElementById('btnCancel');
}

// ==================== 不可变状态工具函数 ====================

function updateCartQty(cart, id, delta) {
  const current = cart[id] || 0;
  const next = current + delta;
  const newCart = { ...cart };
  if (next <= 0) {
    delete newCart[id];
  } else {
    newCart[id] = next;
  }
  return newCart;
}

function setCartQty(cart, id, qty) {
  const newCart = { ...cart };
  if (qty <= 0) {
    delete newCart[id];
  } else {
    newCart[id] = qty;
  }
  return newCart;
}

// ==================== 渲染 ====================

function renderTabs() {
  var categories = getCategories();

  // 移动端水平 Tab
  if (dom.tabBar) {
    dom.tabBar.innerHTML = categories.map(cat => `
      <button class="tab-item ${cat === state.activeCategory ? 'active' : ''}"
              data-category="${cat}">${cat}</button>
    `).join('');
    dom.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeCategory = btn.dataset.category;
        renderTabs();
        renderProducts();
      });
    });
  }

  // 桌面端垂直侧栏 Tab
  if (dom.sidebarTabs) {
    dom.sidebarTabs.innerHTML = categories.map(cat => `
      <button class="tab-item ${cat === state.activeCategory ? 'active' : ''}"
              data-category="${cat}">${cat}</button>
    `).join('');
    dom.sidebarTabs.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeCategory = btn.dataset.category;
        renderTabs();
        renderProducts();
      });
    });
  }
}

function getFilteredProducts() {
  return PRODUCTS.filter(p => {
    const matchCategory = state.activeCategory === '全部' || p.category === state.activeCategory;
    const matchSearch = !state.searchQuery || p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || p.id.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });
}

function renderProducts() {
  const products = getFilteredProducts();

  if (products.length === 0) {
    dom.productList.innerHTML = `
      <div class="empty-state">
        <div class="icon">📦</div>
        <p>没有找到商品</p>
      </div>
    `;
    return;
  }

  dom.productList.innerHTML = products.map(p => {
    const qty = state.cart[p.id] || 0;
    return `
      <div class="product-card" data-id="${p.id}">
        <div class="product-info">
          <div class="product-name" title="${p.name}">${p.name}</div>
          <div class="product-meta">
            <span class="product-price">¥${p.price.toFixed(2)}</span>
            <span>编码: ${p.id}</span>
          </div>
        </div>
        <div class="qty-control">
          <button class="qty-btn ${qty === 0 ? 'disabled' : ''}" data-action="decrease" data-id="${p.id}">−</button>
          <input type="number" class="qty-input" value="${qty}" min="0" max="999" data-id="${p.id}">
          <button class="qty-btn" data-action="increase" data-id="${p.id}">+</button>
        </div>
      </div>
    `;
  }).join('');

  bindProductEvents();
}

function bindProductEvents() {
  dom.productList.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      updateQty(id, action === 'increase' ? 1 : -1);
    });
  });

  dom.productList.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.id;
      let val = parseInt(input.value) || 0;
      if (val < 0) val = 0;
      if (val > 999) val = 999;
      state.cart = setCartQty(state.cart, id, val);
      updateCheckout();
      renderProducts();
    });
  });
}

/**
 * 局部更新单个商品卡片的数量显示
 */
function updateQtyCard(id) {
  const card = dom.productList.querySelector(`.product-card[data-id="${id}"]`);
  if (!card) return;

  const qty = state.cart[id] || 0;
  const input = card.querySelector('.qty-input');
  const decreaseBtn = card.querySelector('.qty-btn[data-action="decrease"]');

  if (input) input.value = qty;
  if (decreaseBtn) {
    decreaseBtn.classList.toggle('disabled', qty === 0);
  }
}

function updateQty(id, delta) {
  state.cart = updateCartQty(state.cart, id, delta);
  updateCheckout();
  updateQtyCard(id);
}

function updateCheckout() {
  let total = 0;
  let count = 0;

  Object.entries(state.cart).forEach(([id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    if (product) {
      total += product.price * qty;
      count += qty;
    }
  });

  const totalText = `¥${total.toFixed(2)}`;
  const countText = `已选 ${Object.keys(state.cart).length} 种，共 ${count} 件`;
  const hasItems = Object.keys(state.cart).length > 0;

  // 移动端底部栏
  if (dom.checkoutTotal) dom.checkoutTotal.textContent = totalText;
  if (dom.checkoutCount) dom.checkoutCount.textContent = countText;
  if (dom.btnCheckout) dom.btnCheckout.disabled = !hasItems;

  // 桌面端侧栏
  if (dom.cartTotal) dom.cartTotal.textContent = totalText;
  if (dom.cartCount) dom.cartCount.textContent = countText;
  if (dom.btnCheckoutDesktop) dom.btnCheckoutDesktop.disabled = !hasItems;

  // 更新桌面端购物车明细
  updateCartSummary();
}

function updateCartSummary() {
  if (!dom.cartItems) return;

  const entries = Object.entries(state.cart);
  if (entries.length === 0) {
    dom.cartItems.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0;">暂无已选商品</div>';
    return;
  }

  dom.cartItems.innerHTML = entries.map(([id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product) return '';
    return `
      <div class="cart-item">
        <span class="cart-item-name" title="${product.name}">${product.name}</span>
        <span class="cart-item-qty">x${qty}</span>
      </div>
    `;
  }).join('');
}

// ==================== 搜索 ====================

function initSearch() {
  let mobileTimer, desktopTimer;

  // 移动端搜索
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', () => {
      clearTimeout(mobileTimer);
      mobileTimer = setTimeout(() => {
        state.searchQuery = dom.searchInput.value.trim();
        renderProducts();
      }, 200);
    });
  }

  // 桌面端内联搜索
  if (dom.searchInline) {
    dom.searchInline.addEventListener('input', () => {
      clearTimeout(desktopTimer);
      desktopTimer = setTimeout(() => {
        state.searchQuery = dom.searchInline.value.trim();
        renderProducts();
      }, 200);
    });
  }
}

// ==================== 结算弹窗 ====================

function openCheckoutModal() {
  // 从常驻表单同步值到弹窗
  const activeName = dom.inputNameDesktop ? dom.inputNameDesktop.value : dom.inputName.value;
  const activeRemark = dom.inputRemarkDesktop ? dom.inputRemarkDesktop.value : dom.inputRemark.value;
  dom.inputName.value = activeName || '';
  dom.inputRemark.value = activeRemark || '';

  const items = Object.entries(state.cart).map(([id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product) return '';
    const subtotal = product.price * qty;
    return `
      <div class="order-item">
        <span class="order-item-name" title="${product.name}">${product.name}</span>
        <span class="order-item-qty">x${qty}</span>
        <span class="order-item-subtotal">¥${subtotal.toFixed(2)}</span>
      </div>
    `;
  }).join('');

  dom.orderItems.innerHTML = items;
  dom.modalOverlay.classList.add('show');
  dom.inputName.focus();
}

function closeCheckoutModal() {
  // 从弹窗同步值回常驻表单
  if (dom.inputNameDesktop) dom.inputNameDesktop.value = dom.inputName.value;
  if (dom.inputRemarkDesktop) dom.inputRemarkDesktop.value = dom.inputRemark.value;
  dom.modalOverlay.classList.remove('show');
}

function initModal() {
  dom.btnCancel.addEventListener('click', closeCheckoutModal);

  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeCheckoutModal();
  });
}

// ==================== 数据提交 ====================

async function submitOrder() {
  if (state.submitting) return;

  const name = dom.inputName.value.trim();
  const remark = dom.inputRemark.value.trim();

  if (!name) {
    showToast('请填写申请人');
    dom.inputName.focus();
    return;
  }

  if (name.length > 50) {
    showToast('申请人姓名不能超过50个字符');
    dom.inputName.focus();
    return;
  }

  if (!remark) {
    showToast('请填写出库原因');
    dom.inputRemark.focus();
    return;
  }

  if (remark.length > 500) {
    showToast('出库原因不能超过500个字符');
    dom.inputRemark.focus();
    return;
  }

  // 构建订单明细
  const items = Object.entries(state.cart).map(([id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    return {
      productId: id,
      productName: product.name,
      price: product.price,
      qty: qty,
      subtotal: product.price * qty,
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  const order = {
    applicant: name,
    remark: remark,
    items: items,
    totalAmount: totalAmount,
    totalQty: totalQty,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  state.submitting = true;
  dom.btnSubmitOrder.disabled = true;

  try {
    await saveToSupabase(order);
    showToast('出货单提交成功！');
    closeCheckoutModal();
    state.cart = {};
    updateCheckout();
    renderProducts();
  } catch (error) {
    showToast('提交失败：' + error.message);
  } finally {
    state.submitting = false;
    dom.btnSubmitOrder.disabled = false;
  }
}

function initSubmit() {
  if (dom.btnCheckout) {
    dom.btnCheckout.addEventListener('click', openCheckoutModal);
  }
  if (dom.btnCheckoutDesktop) {
    dom.btnCheckoutDesktop.addEventListener('click', openCheckoutModal);
  }
  dom.btnSubmitOrder.addEventListener('click', submitOrder);
}

// ==================== Supabase 数据层 ====================

async function saveToSupabase(order) {
  if (CONFIG.supabaseUrl === 'YOUR_SUPABASE_URL') {
    saveToLocalStorage(order);
    return;
  }

  const response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/outbound_orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.supabaseKey,
      'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

function saveToLocalStorage(order) {
  const orders = JSON.parse(localStorage.getItem('outbound_orders') || '[]');
  order.id = generateId();
  orders.push(order);
  localStorage.setItem('outbound_orders', JSON.stringify(orders));
}

async function fetchOrders() {
  if (CONFIG.supabaseUrl === 'YOUR_SUPABASE_URL') {
    return JSON.parse(localStorage.getItem('outbound_orders') || '[]');
  }

  const response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/outbound_orders?order=created_at.desc&limit=50`, {
    headers: {
      'apikey': CONFIG.supabaseKey,
      'Authorization': `Bearer ${CONFIG.supabaseKey}`,
    },
  });

  if (!response.ok) throw new Error('获取出货记录失败');
  return response.json();
}

// ==================== Supabase Realtime 重连 ====================

function subscribeToOrders(callback) {
  if (CONFIG.supabaseUrl === 'YOUR_SUPABASE_URL') return;

  let reconnectAttempts = 0;
  const maxDelay = 30000;

  function connect() {
    const wsUrl = CONFIG.supabaseUrl.replace('https://', 'wss://')
      .replace('http://', 'ws://') + '/realtime/v1/websocket';

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttempts = 0;
      ws.send(JSON.stringify({
        event: 'phx_join',
        topic: 'realtime:outbound_orders',
        payload: {
          config: {
            postgres_changes: [{
              event: 'INSERT',
              schema: 'public',
              table: 'outbound_orders',
            }],
          },
        },
        ref: '1',
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.payload && data.payload.record) {
        callback(data.payload.record);
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxDelay);
      reconnectAttempts++;
      setTimeout(connect, delay);
    };
  }

  connect();
}

// ==================== 工具函数 ====================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

// ==================== 初始化 ====================

async function init() {
  cacheDom();

  // 显示加载态
  if (dom.productList) {
    dom.productList.innerHTML = '<div class="admin-loading">商品加载中...</div>';
  }

  // 动态加载商品
  await loadProductsFromSupabase();

  renderTabs();
  renderProducts();
  updateCheckout();
  initSearch();
  initModal();
  initSubmit();
  syncFormFields();

  // 实时同步：后台商品变更自动更新前台
  SupabaseClient.wsSubscribe('products', function (record) {
    // 收到变更，重新加载
    loadProductsFromSupabase().then(function () {
      renderTabs();
      renderProducts();
      updateCheckout();
    });
  });
}

// 同步移动端和桌面端表单字段
function syncFormFields() {
  if (dom.inputNameDesktop && dom.inputName) {
    dom.inputNameDesktop.addEventListener('input', () => {
      dom.inputName.value = dom.inputNameDesktop.value;
    });
    dom.inputName.addEventListener('input', () => {
      dom.inputNameDesktop.value = dom.inputName.value;
    });
  }
  if (dom.inputRemarkDesktop && dom.inputRemark) {
    dom.inputRemarkDesktop.addEventListener('input', () => {
      dom.inputRemark.value = dom.inputRemarkDesktop.value;
    });
    dom.inputRemark.addEventListener('input', () => {
      dom.inputRemarkDesktop.value = dom.inputRemark.value;
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
