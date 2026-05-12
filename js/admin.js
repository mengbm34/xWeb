/**
 * 商品管理后台业务逻辑
 * 包含：鉴权、商品CRUD、Excel导入、搜索、实时同步
 */

// ==================== 配置 ====================

var ADMIN_CONFIG = {
  password: 'admin123',
  categories: ['彩妆', '护肤口服', '洗护', '周边', '院线'],
};

// ==================== 状态 ====================

var adminState = {
  products: [],
  filteredProducts: [],
  editingId: null,
  excelData: [],
  excelErrors: [],
  searchQuery: '',
  activeCategory: '',
  selectedIds: [],
  orders: [],
  filteredOrders: [],
  ordersSearchQuery: '',
  selectedOrderIds: [],
  activeTab: 'products',
};

// ==================== DOM 缓存 ====================

var dom = {};

function cacheDom() {
  dom.authOverlay = document.getElementById('authOverlay');
  dom.authPassword = document.getElementById('authPassword');
  dom.btnAuth = document.getElementById('btnAuth');
  dom.adminContent = document.getElementById('adminContent');
  dom.btnAdminLogout = document.getElementById('btnAdminLogout');
  dom.adminStats = document.getElementById('adminStats');
  dom.adminSearch = document.getElementById('adminSearch');
  dom.btnExcelImport = document.getElementById('btnExcelImport');
  dom.btnManualAdd = document.getElementById('btnManualAdd');
  dom.productTableWrapper = document.getElementById('productTableWrapper');
  dom.addEditOverlay = document.getElementById('addEditOverlay');
  dom.addEditTitle = document.getElementById('addEditTitle');
  dom.editOriginalId = document.getElementById('editOriginalId');
  dom.formId = document.getElementById('formId');
  dom.formName = document.getElementById('formName');
  dom.formCategory = document.getElementById('formCategory');
  dom.formPrice = document.getElementById('formPrice');
  dom.btnAddEditCancel = document.getElementById('btnAddEditCancel');
  dom.btnAddEditSubmit = document.getElementById('btnAddEditSubmit');
  dom.excelOverlay = document.getElementById('excelOverlay');
  dom.fileUploadArea = document.getElementById('fileUploadArea');
  dom.excelFileInput = document.getElementById('excelFileInput');
  dom.excelPreviewContainer = document.getElementById('excelPreviewContainer');
  dom.excelStats = document.getElementById('excelStats');
  dom.excelPreview = document.getElementById('excelPreview');
  dom.btnExcelCancel = document.getElementById('btnExcelCancel');
  dom.btnExcelConfirm = document.getElementById('btnExcelConfirm');
  dom.toast = document.getElementById('adminToast');
  dom.btnRefreshOrders = document.getElementById('btnRefreshOrders');
  dom.ordersSearch = document.getElementById('ordersSearch');
  dom.orderTableWrapper = document.getElementById('orderTableWrapper');
  dom.bulkBar = document.getElementById('bulkBar');
  dom.bulkCount = document.getElementById('bulkCount');
  dom.btnBulkDelete = document.getElementById('btnBulkDelete');
  dom.ordersBulkBar = document.getElementById('ordersBulkBar');
  dom.ordersBulkCount = document.getElementById('ordersBulkCount');
  dom.btnOrdersBulkDelete = document.getElementById('btnOrdersBulkDelete');
  dom.btnOrdersBulkCancel = document.getElementById('btnOrdersBulkCancel');
  dom.categoryFilter = document.getElementById('categoryFilter');
}

// ==================== 工具函数 ====================

function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(function () { dom.toast.classList.remove('show'); }, 2500);
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ==================== 鉴权 ====================

function checkAuth() {
  var saved = localStorage.getItem('admin_auth');
  if (saved === ADMIN_CONFIG.password) {
    showAdminContent();
    loadProducts();
    subscribeToProducts();
  }
}

function showAdminContent() {
  dom.authOverlay.classList.add('hidden');
  dom.adminContent.classList.remove('hidden');
}

function logout() {
  localStorage.removeItem('admin_auth');
  dom.authOverlay.classList.remove('hidden');
  dom.adminContent.classList.add('hidden');
  dom.authPassword.value = '';
}

function tryAuth() {
  var pwd = dom.authPassword.value.trim();
  if (!pwd) {
    showToast('请输入密码');
    return;
  }
  if (pwd === ADMIN_CONFIG.password) {
    localStorage.setItem('admin_auth', pwd);
    showAdminContent();
    loadProducts();
    subscribeToProducts();
  } else {
    showToast('密码错误');
    dom.authPassword.value = '';
    dom.authPassword.focus();
  }
}

// ==================== 商品加载 ====================

async function loadProducts() {
  // 先读缓存，秒开页面
  var cached = localStorage.getItem('products_cache');
  if (cached) {
    try {
      adminState.products = JSON.parse(cached);
      applyFilter();
    } catch (e) {
      // 缓存损坏，继续
    }
  }

  // 异步刷新远程数据
  try {
    var products = await SupabaseClient.restQuery('products', 'order=id.asc');
    if (products && products.length > 0) {
      adminState.products = products.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          price: parseFloat(p.price) || 0,
          is_active: p.is_active !== false,
        };
      });
      localStorage.setItem('products_cache', JSON.stringify(adminState.products));
    }
  } catch (e) {
    // 保持缓存数据不动
    if (adminState.products.length === 0) {
      showToast('加载失败，请检查网络');
    }
  }
  applyFilter();
}

function showLoading() {
  dom.productTableWrapper.innerHTML = '<div class="admin-loading">加载中...</div>';
}

function hideLoading() {}

// ==================== 渲染 ====================

function renderStats() {
  var total = adminState.products.length;
  var categoryCounts = {};
  adminState.products.forEach(function (p) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });

  var html = '<div class="stat-card"><div class="stat-value">' + total + '</div><div class="stat-label">商品总数</div></div>';
  Object.keys(categoryCounts).forEach(function (cat) {
    html += '<div class="stat-card"><div class="stat-value">' + categoryCounts[cat] + '</div><div class="stat-label">' + cat + '</div></div>';
  });
  dom.adminStats.innerHTML = html;
}

function renderProductTable() {
  var products = adminState.filteredProducts;

  if (products.length === 0) {
    dom.productTableWrapper.innerHTML =
      '<div class="admin-empty"><div class="icon">📦</div><p>暂无商品</p></div>';
    return;
  }

  var html = '<table class="admin-table">';
  html += '<thead><tr>';
  html += '<th style="width:40px"><input type="checkbox" id="selectAllCheckbox" title="全选"></th>';
  html += '<th>商品编码</th><th>商品名称</th><th>分类</th><th>价格</th><th>状态</th><th>操作</th>';
  html += '</tr></thead><tbody>';

  products.forEach(function (p) {
    var checked = adminState.selectedIds.indexOf(p.id) !== -1 ? ' checked' : '';
    html += '<tr>';
    html += '<td style="width:40px"><input type="checkbox" class="row-checkbox" data-id="' + escapeHtml(p.id) + '"' + checked + '></td>';
    html += '<td class="col-id" data-label="编码">' + escapeHtml(p.id) + '</td>';
    html += '<td class="col-name" data-label="名称" title="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</td>';
    html += '<td data-label="分类">' + escapeHtml(p.category) + '</td>';
    html += '<td class="col-price" data-label="价格">¥' + p.price.toFixed(2) + '</td>';
    html += '<td data-label="状态"><span class="badge ' + (p.is_active ? 'badge-active' : 'badge-inactive') + '">' + (p.is_active ? '启用' : '停用') + '</span></td>';
    html += '<td class="col-actions" data-label="">';
    html += '<button class="btn-icon btn-icon-toggle" data-action="toggle" data-id="' + escapeHtml(p.id) + '" title="切换状态">' + (p.is_active ? '停用' : '启用') + '</button>';
    html += '<button class="btn-icon btn-icon-edit" data-action="edit" data-id="' + escapeHtml(p.id) + '" title="编辑">编辑</button>';
    html += '<button class="btn-icon btn-icon-delete" data-action="delete" data-id="' + escapeHtml(p.id) + '" title="删除">删除</button>';
    html += '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  dom.productTableWrapper.innerHTML = html;

  bindProductTableEvents();
  updateSelectionUI();
}

function bindProductTableEvents() {
  var selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) {
    selectAll.checked = adminState.selectedIds.length > 0 && adminState.selectedIds.length === adminState.filteredProducts.length;
    selectAll.addEventListener('change', function () {
      if (selectAll.checked) {
        adminState.selectedIds = adminState.filteredProducts.map(function (p) { return p.id; });
      } else {
        adminState.selectedIds = [];
      }
      renderProductTable();
    });
  }

  dom.productTableWrapper.querySelectorAll('.row-checkbox').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var id = cb.dataset.id;
      if (cb.checked) {
        if (adminState.selectedIds.indexOf(id) === -1) {
          adminState.selectedIds.push(id);
        }
      } else {
        adminState.selectedIds = adminState.selectedIds.filter(function (sid) { return sid !== id; });
      }
      updateSelectionUI();
    });
  });

  dom.productTableWrapper.querySelectorAll('.btn-icon').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (action === 'toggle') handleToggle(id);
      else if (action === 'edit') handleEdit(id);
      else if (action === 'delete') handleDelete(id);
    });
  });
}

// ==================== CRUD ====================

function openAddModal() {
  adminState.editingId = null;
  dom.addEditTitle.textContent = '添加商品';
  dom.editOriginalId.value = '';
  dom.formId.value = '';
  dom.formName.value = '';
  dom.formCategory.value = '';
  dom.formPrice.value = '0';
  dom.formId.disabled = false;
  dom.addEditOverlay.classList.add('show');
  dom.formId.focus();
}

function openEditModal(product) {
  adminState.editingId = product.id;
  dom.addEditTitle.textContent = '编辑商品';
  dom.editOriginalId.value = product.id;
  dom.formId.value = product.id;
  dom.formName.value = product.name;
  dom.formCategory.value = product.category;
  dom.formPrice.value = product.price;
  dom.formId.disabled = true;
  dom.addEditOverlay.classList.add('show');
  dom.formName.focus();
}

function closeAddEditModal() {
  dom.addEditOverlay.classList.remove('show');
  adminState.editingId = null;
}

async function handleSave() {
  var id = dom.formId.value.trim();
  var name = dom.formName.value.trim();
  var category = dom.formCategory.value;
  var price = parseFloat(dom.formPrice.value) || 0;

  if (!id) { showToast('请输入商品编码'); dom.formId.focus(); return; }
  if (!name) { showToast('请输入商品名称'); dom.formName.focus(); return; }
  if (!category) { showToast('请选择分类'); dom.formCategory.focus(); return; }
  if (price < 0) { showToast('价格不能为负数'); dom.formPrice.focus(); return; }

  var product = { id: id, name: name, category: category, price: price, is_active: true };

  try {
    if (adminState.editingId) {
      var editingId = adminState.editingId;
      var idx = adminState.products.findIndex(function (p) { return p.id === editingId; });
      if (idx !== -1) {
        adminState.products[idx] = Object.assign({}, adminState.products[idx], product, { is_active: adminState.products[idx].is_active });
      }
      applyFilter();
      closeAddEditModal();
      await SupabaseClient.restUpdate('products', editingId, product);
      showToast('商品更新成功');
    } else {
      // 立即添加到本地状态
      adminState.products = adminState.products.concat(product);
      closeAddEditModal();
      applyFilter();
      await SupabaseClient.restInsert('products', [product]);
      showToast('商品添加成功');
    }
    // 异步刷新远程数据以对齐
    refreshRemoteProducts();
  } catch (e) {
    showToast('操作失败：' + e.message);
  }
}

function handleEdit(id) {
  var product = adminState.products.find(function (p) { return p.id === id; });
  if (product) openEditModal(product);
}

async function handleDelete(id) {
  if (!confirm('确认删除商品 ' + id + '？')) return;
  try {
    await SupabaseClient.restDelete('products', id);
    // 立即从本地状态移除，避免等待远程刷新导致用户感觉没删除成功
    adminState.products = adminState.products.filter(function (p) { return p.id !== id; });
    adminState.selectedIds = adminState.selectedIds.filter(function (sid) { return sid !== id; });
    applyFilter();
    showToast('商品已删除');
    // 异步刷新远程数据（静默）
    refreshRemoteProducts();
  } catch (e) {
    showToast('删除失败：' + e.message);
  }
}

async function handleToggle(id) {
  var product = adminState.products.find(function (p) { return p.id === id; });
  if (!product) return;
  try {
    // 先更新本地状态，立即反馈
    product.is_active = !product.is_active;
    applyFilter();
    await SupabaseClient.restUpdate('products', id, { is_active: product.is_active });
    showToast(product.is_active ? '商品已启用' : '商品已停用');
  } catch (e) {
    // 回滚
    product.is_active = !product.is_active;
    applyFilter();
    showToast('操作失败：' + e.message);
  }
}

// ==================== 批量选择 & 删除 ====================

function refreshRemoteProducts() {
  SupabaseClient.restQuery('products', 'order=id.asc').then(function (products) {
    if (products && products.length > 0) {
      adminState.products = products.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          price: parseFloat(p.price) || 0,
          is_active: p.is_active !== false,
        };
      });
      localStorage.setItem('products_cache', JSON.stringify(adminState.products));
      applyFilter();
    }
  }).catch(function () {
    // 静默失败，保持当前本地状态
  });
}

function updateSelectionUI() {
  var count = adminState.selectedIds.length;
  if (count > 0) {
    dom.bulkBar.classList.add('show');
    dom.bulkCount.textContent = '已选择 ' + count + ' 项';
  } else {
    dom.bulkBar.classList.remove('show');
  }
}

async function handleBulkDelete() {
  var count = adminState.selectedIds.length;
  if (count === 0) return;
  if (!confirm('确认删除选中的 ' + count + ' 个商品？')) return;

  try {
    // 先删除本地状态，立即刷新表格
    var idsToDelete = adminState.selectedIds.slice();
    adminState.products = adminState.products.filter(function (p) {
      return idsToDelete.indexOf(p.id) === -1;
    });
    adminState.selectedIds = [];
    applyFilter();
    showToast('已删除 ' + count + ' 个商品');
    // 异步删除远程数据（静默）
    for (var i = 0; i < idsToDelete.length; i++) {
      await SupabaseClient.restDelete('products', idsToDelete[i]);
    }
    refreshRemoteProducts();
  } catch (e) {
    showToast('批量删除失败：' + e.message);
  }
}

// ==================== Excel 导入 ====================

var HEADER_MAP = {
  '商品编码': 'id', '编码': 'id', 'id': 'id', 'ID': 'id', '产品编码': 'id',
  '商品名称': 'name', '名称': 'name', 'name': 'name', 'Name': 'name', '产品名称': 'name',
  '分类': 'category', 'category': 'category', 'Category': 'category', '类别': 'category',
  '价格': 'price', 'price': 'price', 'Price': 'price', '单价': 'price',
};

function openExcelModal() {
  adminState.excelData = [];
  adminState.excelErrors = [];
  dom.excelFileInput.value = '';
  dom.excelPreviewContainer.style.display = 'none';
  dom.fileUploadArea.classList.remove('has-file');
  dom.btnExcelConfirm.disabled = true;
  dom.excelOverlay.classList.add('show');
}

function closeExcelModal() {
  dom.excelOverlay.classList.remove('show');
}

function handleFileSelect(event) {
  var file = event.target.files[0];
  if (!file) return;

  dom.fileUploadArea.classList.add('has-file');

  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      parseAndValidate(rows);
    } catch (err) {
      showToast('文件解析失败：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseAndValidate(rows) {
  var results = [];
  var errors = [];

  rows.forEach(function (row, index) {
    var mapped = {};
    Object.keys(row).forEach(function (key) {
      var standardKey = HEADER_MAP[key] || key;
      mapped[standardKey] = row[key];
    });

    var item = {
      id: String(mapped.id || '').trim(),
      name: String(mapped.name || '').trim(),
      category: String(mapped.category || '').trim(),
      price: parseFloat(mapped.price) || 0,
    };

    var rowErrors = [];
    if (!item.id) rowErrors.push('编码不能为空');
    if (!item.name) rowErrors.push('名称不能为空');
    if (!item.category) rowErrors.push('分类不能为空');
    else if (ADMIN_CONFIG.categories.indexOf(item.category) === -1) rowErrors.push('分类无效');
    if (item.price < 0) rowErrors.push('价格不能为负');

    if (rowErrors.length > 0) {
      errors.push({ rowIndex: index, item: item, messages: rowErrors });
    } else {
      results.push(item);
    }
  });

  adminState.excelData = results;
  adminState.excelErrors = errors;
  renderExcelPreview();
}

function renderExcelPreview() {
  var total = adminState.excelData.length + adminState.excelErrors.length;
  if (total === 0) {
    dom.excelPreviewContainer.style.display = 'none';
    dom.btnExcelConfirm.disabled = true;
    return;
  }

  dom.excelPreviewContainer.style.display = 'block';
  dom.excelStats.innerHTML =
    '<span class="valid-count">有效 ' + adminState.excelData.length + ' 条</span>' +
    (adminState.excelErrors.length > 0 ? '<span class="error-count">错误 ' + adminState.excelErrors.length + ' 条</span>' : '');

  var html = '<table><thead><tr><th>编码</th><th>名称</th><th>分类</th><th>价格</th><th>状态</th></tr></thead><tbody>';

  adminState.excelData.forEach(function (item) {
    html += '<tr>';
    html += '<td>' + escapeHtml(item.id) + '</td>';
    html += '<td>' + escapeHtml(item.name) + '</td>';
    html += '<td>' + escapeHtml(item.category) + '</td>';
    html += '<td>¥' + item.price.toFixed(2) + '</td>';
    html += '<td style="color:var(--success)">有效</td>';
    html += '</tr>';
  });

  adminState.excelErrors.forEach(function (err) {
    html += '<tr class="excel-error-row">';
    html += '<td>' + escapeHtml(err.item.id || '-') + '</td>';
    html += '<td>' + escapeHtml(err.item.name || '-') + '</td>';
    html += '<td>' + escapeHtml(err.item.category || '-') + '</td>';
    html += '<td>' + err.item.price.toFixed(2) + '</td>';
    html += '<td class="excel-error-msg">' + escapeHtml(err.messages.join('; ')) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  dom.excelPreview.innerHTML = html;

  dom.btnExcelConfirm.disabled = adminState.excelData.length === 0;
}

async function confirmExcelImport() {
  if (adminState.excelData.length === 0) return;

  dom.btnExcelConfirm.disabled = true;
  dom.btnExcelConfirm.textContent = '导入中...';

  try {
    var rows = adminState.excelData;
    var chunkSize = 100;
    for (var i = 0; i < rows.length; i += chunkSize) {
      var chunk = rows.slice(i, i + chunkSize);
      await SupabaseClient.restUpsert('products', chunk);
    }
    showToast('成功导入 ' + rows.length + ' 个商品');
    closeExcelModal();
    await loadProducts();
  } catch (e) {
    showToast('导入失败：' + e.message);
  } finally {
    dom.btnExcelConfirm.disabled = false;
    dom.btnExcelConfirm.textContent = '确认导入';
  }
}

// ==================== 搜索 ====================

function applyFilter() {
  var query = adminState.searchQuery.toLowerCase();
  var category = adminState.activeCategory;
  adminState.filteredProducts = adminState.products.filter(function (p) {
    var matchCategory = !category || p.category === category;
    var matchSearch = !query ||
      p.name.toLowerCase().indexOf(query) !== -1 ||
      p.id.toLowerCase().indexOf(query) !== -1 ||
      p.category.toLowerCase().indexOf(query) !== -1;
    return matchCategory && matchSearch;
  });
  renderStats();
  renderProductTable();
}

function initSearch() {
  var timer = null;
  dom.adminSearch.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      adminState.searchQuery = dom.adminSearch.value.trim();
      applyFilter();
    }, 200);
  });
}

// ==================== 实时同步 ====================

function subscribeToProducts() {
  SupabaseClient.wsSubscribe('products', function () {
    loadProducts();
  });
}

// ==================== Tab 切换 ====================

function switchTab(tabName) {
  adminState.activeTab = tabName;
  document.querySelectorAll('.admin-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.admin-tab-panel').forEach(function (panel) {
    panel.classList.toggle('active', panel.id === tabName + 'Tab');
  });
  if (tabName === 'orders') {
    loadOrders();
  }
}

// ==================== 出库记录 ====================

async function loadOrders() {
  dom.orderTableWrapper.innerHTML = '<div class="admin-loading">加载出库记录中...</div>';
  try {
    var orders = await SupabaseClient.restQuery('outbound_orders', 'order=created_at.desc&limit=200');
    if (!orders || orders.length === 0) {
      // 降级：读 localStorage
      orders = JSON.parse(localStorage.getItem('outbound_orders') || '[]');
    }
    adminState.orders = orders;
  } catch (e) {
    adminState.orders = JSON.parse(localStorage.getItem('outbound_orders') || '[]');
  }
  applyOrderFilter();
}

function applyOrderFilter() {
  var query = adminState.ordersSearchQuery.toLowerCase();
  if (!query) {
    adminState.filteredOrders = adminState.orders.slice();
  } else {
    adminState.filteredOrders = adminState.orders.filter(function (o) {
      return (o.applicant && o.applicant.toLowerCase().indexOf(query) !== -1) ||
             (o.remark && o.remark.toLowerCase().indexOf(query) !== -1);
    });
  }
  renderOrders();
}

function renderOrders() {
  var orders = adminState.filteredOrders;

  if (orders.length === 0) {
    dom.orderTableWrapper.innerHTML =
      '<div class="admin-empty"><div class="icon">📋</div><p>暂无出库记录</p></div>';
    updateOrdersSelectionUI();
    return;
  }

  var html = '<table class="admin-table">';
  html += '<thead><tr>';
  html += '<th style="width:40px"><input type="checkbox" id="selectAllOrderCheckbox" title="全选"></th>';
  html += '<th>申请人</th><th>出库原因</th><th>商品明细</th><th>总金额</th><th>数量</th><th>状态</th><th>申请时间</th><th>操作</th>';
  html += '</tr></thead><tbody>';

  orders.forEach(function (o, index) {
    var checked = adminState.selectedOrderIds.indexOf(o.id) !== -1 ? ' checked' : '';
    var itemsPreview = o.items ? o.items.slice(0, 2).map(function (item) {
      return item.productName + ' x' + item.qty;
    }).join('、') : '';
    if (o.items && o.items.length > 2) itemsPreview += ' 等' + o.items.length + '项';

    var statusLabel = o.status === 'approved' ? '已批准' : o.status === 'rejected' ? '已驳回' : '待审批';
    var statusClass = o.status === 'approved' ? 'badge-active' : o.status === 'rejected' ? 'badge-inactive' : '';

    html += '<tr>';
    html += '<td style="width:40px"><input type="checkbox" class="order-row-checkbox" data-id="' + o.id + '"' + checked + '></td>';
    html += '<td class="col-applicant" data-label="申请人">' + escapeHtml(o.applicant || '-') + '</td>';
    html += '<td class="col-reason" data-label="原因" title="' + escapeHtml(o.remark || '') + '">' + escapeHtml(o.remark || '-') + '</td>';
    html += '<td class="col-items-detail" data-label="商品">' + escapeHtml(itemsPreview) + '</td>';
    html += '<td data-label="总金额" class="col-price">¥' + (o.totalAmount || 0).toFixed(2) + '</td>';
    html += '<td data-label="数量">' + (o.totalQty || 0) + '</td>';
    html += '<td data-label="状态"><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>';
    html += '<td class="col-time" data-label="时间">' + formatDateTime(o.createdAt) + '</td>';
    html += '<td data-label="">';
    html += '<button class="btn-icon order-detail-toggle" data-index="' + index + '" title="查看详情">详情</button>';
    html += '</td>';
    html += '</tr>';

    // 展开的详情行
    if (o.items) {
      html += '<tr class="order-detail-row" data-index="' + index + '">';
      html += '<td colspan="9">';
      html += '<strong>完整明细：</strong>';
      o.items.forEach(function (item) {
        html += '<span class="order-detail-item">' + escapeHtml(item.productName) + ' x' + item.qty + ' ¥' + (item.subtotal || item.price * item.qty).toFixed(2) + '</span>';
      });
      html += '</td></tr>';
    }
  });

  html += '</tbody></table>';
  dom.orderTableWrapper.innerHTML = html;

  // 绑定详情展开
  dom.orderTableWrapper.querySelectorAll('.order-detail-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = btn.dataset.index;
      var detailRow = dom.orderTableWrapper.querySelector('.order-detail-row[data-index="' + idx + '"]');
      if (detailRow) {
        detailRow.classList.toggle('expanded');
        btn.textContent = detailRow.classList.contains('expanded') ? '收起' : '详情';
      }
    });
  });

  // 绑定订单复选框
  bindOrderSelectionEvents();
  updateOrdersSelectionUI();
}

function formatDateTime(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ==================== 出库记录批量选择 & 删除 ====================

function bindOrderSelectionEvents() {
  var selectAll = document.getElementById('selectAllOrderCheckbox');
  if (selectAll) {
    selectAll.checked = adminState.selectedOrderIds.length > 0 && adminState.selectedOrderIds.length === adminState.filteredOrders.length;
    selectAll.addEventListener('change', function () {
      if (selectAll.checked) {
        adminState.selectedOrderIds = adminState.filteredOrders.map(function (o) { return o.id; });
      } else {
        adminState.selectedOrderIds = [];
      }
      renderOrders();
    });
  }

  dom.orderTableWrapper.querySelectorAll('.order-row-checkbox').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var id = cb.dataset.id;
      if (cb.checked) {
        if (adminState.selectedOrderIds.indexOf(id) === -1) {
          adminState.selectedOrderIds.push(id);
        }
      } else {
        adminState.selectedOrderIds = adminState.selectedOrderIds.filter(function (sid) { return sid !== id; });
      }
      updateOrdersSelectionUI();
    });
  });
}

function updateOrdersSelectionUI() {
  var count = adminState.selectedOrderIds.length;
  if (dom.ordersBulkBar) {
    if (count > 0) {
      dom.ordersBulkBar.classList.add('show');
      dom.ordersBulkCount.textContent = '已选择 ' + count + ' 条记录';
    } else {
      dom.ordersBulkBar.classList.remove('show');
    }
  }
}

async function handleOrdersBulkDelete() {
  var count = adminState.selectedOrderIds.length;
  if (count === 0) return;
  if (!confirm('确认删除选中的 ' + count + ' 条出库记录？')) return;

  try {
    // 立即从本地状态移除
    var idsToDelete = adminState.selectedOrderIds.slice();
    adminState.orders = adminState.orders.filter(function (o) {
      return idsToDelete.indexOf(o.id) === -1;
    });
    adminState.selectedOrderIds = [];
    applyOrderFilter();
    showToast('已删除 ' + count + ' 条出库记录');
    // 异步删除远程数据
    for (var i = 0; i < idsToDelete.length; i++) {
      await SupabaseClient.restDelete('outbound_orders', idsToDelete[i]);
    }
  } catch (e) {
    showToast('批量删除失败：' + e.message);
  }
}

// ==================== 初始化 ====================

function init() {
  cacheDom();

  dom.btnAuth.addEventListener('click', tryAuth);
  dom.authPassword.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryAuth();
  });
  dom.btnAdminLogout.addEventListener('click', logout);
  checkAuth();

  dom.btnExcelImport.addEventListener('click', openExcelModal);
  dom.btnManualAdd.addEventListener('click', openAddModal);

  initSearch();

  if (dom.categoryFilter) {
    dom.categoryFilter.addEventListener('change', function () {
      adminState.activeCategory = dom.categoryFilter.value;
      applyFilter();
    });
  }

  dom.btnAddEditCancel.addEventListener('click', closeAddEditModal);
  dom.btnAddEditSubmit.addEventListener('click', handleSave);
  dom.addEditOverlay.addEventListener('click', function (e) {
    if (e.target === dom.addEditOverlay) closeAddEditModal();
  });
  if (document.getElementById('btnAddEditClose')) {
    document.getElementById('btnAddEditClose').addEventListener('click', closeAddEditModal);
  }

  dom.btnExcelCancel.addEventListener('click', closeExcelModal);
  dom.btnExcelConfirm.addEventListener('click', confirmExcelImport);
  dom.excelOverlay.addEventListener('click', function (e) {
    if (e.target === dom.excelOverlay) closeExcelModal();
  });

  dom.fileUploadArea.addEventListener('click', function () {
    dom.excelFileInput.click();
  });
  dom.excelFileInput.addEventListener('change', handleFileSelect);

  dom.fileUploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    dom.fileUploadArea.style.borderColor = 'var(--primary)';
  });
  dom.fileUploadArea.addEventListener('dragleave', function () {
    dom.fileUploadArea.style.borderColor = '';
  });
  dom.fileUploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    dom.fileUploadArea.style.borderColor = '';
    var files = e.dataTransfer.files;
    if (files.length > 0) {
      dom.excelFileInput.files = files;
      handleFileSelect({ target: { files: files } });
    }
  });

  // Tab 切换
  document.querySelectorAll('.admin-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.tab);
    });
  });

  // 出库记录搜索
  if (dom.ordersSearch) {
    var orderTimer = null;
    dom.ordersSearch.addEventListener('input', function () {
      clearTimeout(orderTimer);
      orderTimer = setTimeout(function () {
        adminState.ordersSearchQuery = dom.ordersSearch.value.trim();
        applyOrderFilter();
      }, 200);
    });
  }

  // 刷新出库记录
  if (dom.btnRefreshOrders) {
    dom.btnRefreshOrders.addEventListener('click', function () {
      loadOrders();
    });
  }

  // 批量删除
  if (dom.btnBulkDelete) {
    dom.btnBulkDelete.addEventListener('click', handleBulkDelete);
  }

  // 取消选择
  if (dom.bulkBar) {
    dom.btnBulkCancel.addEventListener('click', function () {
      adminState.selectedIds = [];
      renderProductTable();
    });
  }

  // 出库记录批量删除
  if (dom.btnOrdersBulkDelete) {
    dom.btnOrdersBulkDelete.addEventListener('click', handleOrdersBulkDelete);
  }

  // 出库记录取消选择
  if (dom.btnOrdersBulkCancel) {
    dom.btnOrdersBulkCancel.addEventListener('click', function () {
      adminState.selectedOrderIds = [];
      renderOrders();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
