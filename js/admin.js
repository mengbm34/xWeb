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
  showLoading();
  try {
    var products = await SupabaseClient.restQuery('products', 'order=id.asc');
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
  } catch (e) {
    var cached = localStorage.getItem('products_cache');
    if (cached) {
      adminState.products = JSON.parse(cached);
      showToast('使用本地缓存数据');
    } else {
      adminState.products = [];
      showToast('加载失败：' + e.message);
    }
  }
  applyFilter();
  hideLoading();
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
  html += '<th>商品编码</th><th>商品名称</th><th>分类</th><th>价格</th><th>状态</th><th>操作</th>';
  html += '</tr></thead><tbody>';

  products.forEach(function (p) {
    html += '<tr>';
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

  var product = { id: id, name: name, category: category, price: price };

  try {
    if (adminState.editingId) {
      await SupabaseClient.restUpdate('products', adminState.editingId, product);
      showToast('商品更新成功');
    } else {
      await SupabaseClient.restInsert('products', [product]);
      showToast('商品添加成功');
    }
    closeAddEditModal();
    await loadProducts();
  } catch (e) {
    showToast('保存失败：' + e.message);
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
    showToast('商品已删除');
    await loadProducts();
  } catch (e) {
    showToast('删除失败：' + e.message);
  }
}

async function handleToggle(id) {
  var product = adminState.products.find(function (p) { return p.id === id; });
  if (!product) return;
  try {
    await SupabaseClient.restUpdate('products', id, { is_active: !product.is_active });
    showToast(product.is_active ? '商品已停用' : '商品已启用');
    await loadProducts();
  } catch (e) {
    showToast('操作失败：' + e.message);
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
  if (!query) {
    adminState.filteredProducts = adminState.products.slice();
  } else {
    adminState.filteredProducts = adminState.products.filter(function (p) {
      return p.name.toLowerCase().indexOf(query) !== -1 ||
             p.id.toLowerCase().indexOf(query) !== -1 ||
             p.category.toLowerCase().indexOf(query) !== -1;
    });
  }
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

  dom.btnAddEditCancel.addEventListener('click', closeAddEditModal);
  dom.btnAddEditSubmit.addEventListener('click', handleSave);
  dom.addEditOverlay.addEventListener('click', function (e) {
    if (e.target === dom.addEditOverlay) closeAddEditModal();
  });

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
}

document.addEventListener('DOMContentLoaded', init);
