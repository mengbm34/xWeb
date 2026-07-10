/**
 * 出库商品 v2 — 业务逻辑
 * 包含：商品数据、分类切换、搜索、数量控制、结算、Supabase 数据层
 */

// Supabase 配置与后台共享 supabase-client.js，无需重复定义

// ==================== 动态商品数据（前台显示来源） ====================
var PRODUCTS = [];

/**
 * 重绘商品相关视图（分类 Tab、商品列表、结算栏）
 * 抽出统一入口，避免多处重复调用三连渲染
 */
function renderProductViews() {
  renderTabs();
  renderProducts();
  updateCheckout();
}

/**
 * 从 Supabase 加载商品数据
 *
 * 数据源策略：Supabase 是商品的唯一真实来源（single source of truth）。
 * 1. 先读 localStorage 缓存秒开页面；
 * 2. 再查 Supabase —— 无论返回是否为空，都以远程结果为准覆盖并同步缓存，
 *    从而清除后台已删除商品的旧缓存，避免前台显示后台不存在的商品；
 * 3. 查询失败时保留已有缓存显示；连缓存都没有则提示网络错误。
 *
 * 注意：这里**绝不**注入任何硬编码兜底商品。前台若显示了后台从未添加过的
 * 商品，正是历史上硬编码兜底在"读到空/读失败"时冒出来所致，已彻底移除。
 */
async function loadProductsFromSupabase() {
  // 1. 缓存秒开
  var cached = localStorage.getItem('products_cache');
  if (cached) {
    try {
      PRODUCTS = JSON.parse(cached);
      renderProductViews();
    } catch (e) {
      // 缓存损坏则忽略，等待远程数据覆盖
    }
  }

  // 未配置 Supabase：无远程数据源，直接呈现当前（可能为空）状态，不伪造商品
  if (!SupabaseClient.isConfigured) {
    renderProductViews();
    return;
  }

  // 2. 以 Supabase 结果为准
  try {
    var data = await SupabaseClient.restQuery('products', 'is_active=eq.true&order=id.asc');
    PRODUCTS = (data || []).map(function (p) {
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: parseFloat(p.price) || 0,
      };
    });
    // 空结果也要写回缓存，主动清除已删除商品的旧缓存
    localStorage.setItem('products_cache', JSON.stringify(PRODUCTS));
    renderProductViews();
  } catch (e) {
    // 3. 查询失败：保留缓存显示；无任何数据时提示，绝不回退硬编码
    if (PRODUCTS.length === 0) {
      renderProductViews();
      showToast('商品加载失败，请检查网络后重试');
    }
  }
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
  dom.inputName = document.getElementById('modalInputName');
  dom.inputRemark = document.getElementById('modalInputRemark');
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
  dom.inputName.value = '';
  dom.inputRemark.value = '';

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

  // 字段名与 Supabase 表结构对齐（snake_case），避免 POST 因列名不匹配 / NOT NULL 约束失败
  const order = {
    applicant: name,
    remark: remark,
    items: items,
    total_amount: totalAmount,
    total_qty: totalQty,
    status: 'pending',
    // created_at 由数据库默认值 now() 生成，不在前端传，避免时区/格式不一致
  };

  state.submitting = true;
  dom.btnSubmitOrder.disabled = true;

  try {
    await saveToSupabase(order);
    showToast('出库申请提交成功！');
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
  // 未配置 Supabase 时仅本地存储（单机模式）
  if (!SupabaseClient.isConfigured) {
    saveToLocalStorage(order);
    return;
  }

  var config = SupabaseClient.getConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/outbound_orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.supabaseKey,
      'Authorization': `Bearer ${config.supabaseKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(order),
  });

  // Supabase 配置存在但写入失败：必须抛错让用户知晓，避免"看似成功实则只在本机"
  if (!response.ok) {
    const err = await response.json().catch(function () { return {}; });
    throw new Error(err.message || ('云端保存失败 HTTP ' + response.status));
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
  if (!SupabaseClient.isConfigured) {
    return JSON.parse(localStorage.getItem('outbound_orders') || '[]');
  }

  var config = SupabaseClient.getConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/outbound_orders?order=created_at.desc&limit=50`, {
    headers: {
      'apikey': config.supabaseKey,
      'Authorization': `Bearer ${config.supabaseKey}`,
    },
  });

  if (!response.ok) throw new Error('获取出货记录失败');
  return response.json();
}

// ==================== Supabase Realtime 重连 ====================

function subscribeToOrders(callback) {
  if (!SupabaseClient.isConfigured) return;

  var config = SupabaseClient.getConfig();
  let reconnectAttempts = 0;
  const maxDelay = 30000;

  function connect() {
    const wsUrl = config.supabaseUrl.replace('https://', 'wss://')
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
  initSearch();
  initModal();
  initSubmit();

  // 先渲染缓存，异步刷新远程数据
  loadProductsFromSupabase();

  // 实时同步：后台商品变更自动更新前台
  SupabaseClient.wsSubscribe('products', function (record) {
    loadProductsFromSupabase();
  });
}

document.addEventListener('DOMContentLoaded', init);
