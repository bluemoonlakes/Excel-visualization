// ── 后台管理 JS ───────────────────────────────────────────────────────────────

let currentImportId = null;
let colConfigs = [];
let adminPage = 1;
const adminPageSize = 30;
let adminTotal = 0;
let dragSrcIdx = null;

// ── Tab 切换 ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tab-cols' && currentImportId) loadColConfig(currentImportId);
    if (btn.dataset.tab === 'tab-data' && currentImportId) loadAdminCards(currentImportId, 1);
    if (btn.dataset.tab === 'tab-media') { loadMediaTags(); loadMediaAssets(1); }
  });
});

// ── 初始化：加载导入列表 ───────────────────────────────────────────────────────
(async () => {
  await loadImports();
})();

async function loadImports() {
  const list = await API.get('/api/admin/imports').catch(() => []);
  const ul = document.getElementById('import-list');
  if (!list.length) {
    ul.innerHTML = '<li class="text-muted text-sm" style="padding:12px">暂无导入记录</li>';
    return;
  }
  ul.innerHTML = list.map(item => `
    <li class="import-item" data-id="${item.id}">
      <div class="import-info">
        <div class="import-name">${escHtml(item.filename)}</div>
        <div class="import-meta">${item.imported_at?.slice(0,16) || ''} · ${item.row_count || 0} 条数据
          <span class="badge ${item.status === 'active' ? 'badge-active' : 'badge-archived'}">
            ${item.status === 'active' ? '当前' : '已归档'}
          </span>
        </div>
      </div>
      <div class="import-actions">
        <button class="btn btn-outline btn-sm" onclick="selectImport(${item.id})">使用</button>
        <button class="btn btn-danger btn-sm" onclick="deleteImport(${item.id})">删除</button>
      </div>
    </li>
  `).join('');

  const active = list.find(i => i.status === 'active');
  if (active && !currentImportId) selectImport(active.id, false);
}

function selectImport(id, notify = true) {
  currentImportId = id;
  document.querySelectorAll('#import-list .import-item').forEach(li => {
    li.style.outline = li.dataset.id == id ? '2px solid var(--primary)' : '';
  });
  if (notify) showToast('已切换数据集', 'success');
}

async function deleteImport(id) {
  if (!confirm('确定删除此导入批次及其所有数据？')) return;
  await API.del(`/api/admin/imports/${id}`).catch(e => showToast(e.message, 'error'));
  if (currentImportId === id) currentImportId = null;
  await loadImports();
  showToast('已删除', 'success');
}

// ── 上传 Excel ────────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('upload-zone');
const uploadInput = document.getElementById('upload-input');
const uploadStatus = document.getElementById('upload-status');

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) doUpload(file);
});
uploadInput.addEventListener('change', () => {
  if (uploadInput.files[0]) doUpload(uploadInput.files[0]);
});

async function doUpload(file) {
  uploadStatus.textContent = '解析中...';
  uploadStatus.style.color = 'var(--gray-500)';
  const fd = new FormData();
  fd.append('file', file);
  try {
    const result = await API.post('/api/admin/import', fd, true);
    uploadStatus.innerHTML = `<span style="color:var(--success)">✓ 导入成功：${result.row_count} 条数据，${result.columns.length} 列</span>`;
    currentImportId = result.import_id;
    await loadImports();
    selectImport(result.import_id, false);
    showToast(`导入成功，共 ${result.row_count} 条`, 'success');
  } catch (e) {
    uploadStatus.innerHTML = `<span style="color:var(--danger)">✗ ${e.message}</span>`;
    showToast(e.message, 'error');
  }
  uploadInput.value = '';
}

// ── 字段配置 ──────────────────────────────────────────────────────────────────
async function loadColConfig(importId) {
  colConfigs = await API.get(`/api/admin/columns/${importId}`).catch(() => []);
  renderColTable();
}

function renderColTable() {
  const tbody = document.getElementById('col-tbody');
  if (!colConfigs.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-sm" style="padding:20px;text-align:center">请先导入 Excel</td></tr>';
    return;
  }
  tbody.innerHTML = colConfigs.map((col, idx) => `
    <tr draggable="true" data-idx="${idx}"
        ondragstart="onDragStart(event,${idx})"
        ondragover="onDragOver(event,${idx})"
        ondrop="onDrop(event,${idx})"
        ondragend="onDragEnd()">
      <td><span class="drag-handle" title="拖拽排序">⠿</span></td>
      <td><code style="font-size:.82rem;background:var(--gray-100);padding:2px 6px;border-radius:4px">${escHtml(col.column_name)}</code></td>
      <td><input class="input" style="max-width:160px" value="${escHtml(col.display_name || col.column_name)}"
           oninput="colConfigs[${idx}].display_name=this.value"></td>
      <td><label class="toggle"><input type="checkbox" ${col.is_visible ? 'checked' : ''} onchange="colConfigs[${idx}].is_visible=this.checked?1:0"><span class="toggle-slider"></span></label></td>
      <td><label class="toggle"><input type="checkbox" ${col.is_filterable ? 'checked' : ''} onchange="colConfigs[${idx}].is_filterable=this.checked?1:0"><span class="toggle-slider"></span></label></td>
      <td><label class="toggle"><input type="checkbox" ${col.is_primary ? 'checked' : ''}
           onchange="colConfigs.forEach((c,i)=>c.is_primary=i===${idx}&&this.checked?1:0);renderColTable()">
           <span class="toggle-slider"></span></label></td>
      <td>
        <select onchange="colConfigs[${idx}].field_type=this.value" style="padding:5px 8px;border-radius:5px;border:1.5px solid var(--gray-300);font-size:.82rem;outline:none">
          <option value="text" ${col.field_type==='text'?'selected':''}>文本</option>
          <option value="tag" ${col.field_type==='tag'?'selected':''}>标签</option>
        </select>
      </td>
    </tr>
  `).join('');
}

function onDragStart(e, idx) { dragSrcIdx = idx; e.currentTarget.classList.add('dragging'); }
function onDragOver(e, idx) { e.preventDefault(); }
function onDrop(e, idx) {
  e.preventDefault();
  if (dragSrcIdx === null || dragSrcIdx === idx) return;
  const moved = colConfigs.splice(dragSrcIdx, 1)[0];
  colConfigs.splice(idx, 0, moved);
  colConfigs.forEach((c, i) => c.display_order = i);
  renderColTable();
}
function onDragEnd() {
  dragSrcIdx = null;
  document.querySelectorAll('#col-tbody tr').forEach(tr => tr.classList.remove('dragging'));
}

document.getElementById('save-cols-btn')?.addEventListener('click', async () => {
  if (!currentImportId) return showToast('请先选择数据集', 'error');
  colConfigs.forEach((c, i) => c.display_order = i);
  await API.put(`/api/admin/columns/${currentImportId}`, colConfigs)
    .then(() => showToast('字段配置已保存', 'success'))
    .catch(e => showToast(e.message, 'error'));
});

// ── 数据管理 ──────────────────────────────────────────────────────────────────
let colHeaders = [];

async function loadAdminCards(importId, page) {
  adminPage = page;
  const data = await API.get(`/api/admin/cards?import_id=${importId}&page=${page}&page_size=${adminPageSize}`).catch(() => null);
  if (!data) return;
  adminTotal = data.total;

  if (!colHeaders.length) {
    const cfg = await API.get(`/api/admin/columns/${importId}`).catch(() => []);
    colHeaders = cfg.filter(c => c.is_visible).slice(0, 6);
  }

  renderDataTable(data.cards);
  renderPagination('data-pagination', page, Math.ceil(adminTotal / adminPageSize), p => loadAdminCards(currentImportId, p));
}

function renderDataTable(cards) {
  const thead = document.getElementById('data-thead');
  const tbody = document.getElementById('data-tbody');

  thead.innerHTML = `<tr>
    <th>#</th>
    ${colHeaders.map(c => `<th>${escHtml(c.display_name || c.column_name)}</th>`).join('')}
  </tr>`;

  if (!cards.length) {
    tbody.innerHTML = `<tr><td colspan="${colHeaders.length + 1}" style="text-align:center;padding:40px;color:var(--gray-400)">暂无数据</td></tr>`;
    return;
  }

  tbody.innerHTML = cards.map(card => `
    <tr>
      <td class="text-muted text-xs">${card.row_index}</td>
      ${colHeaders.map(c => `<td><div class="cell-text">${escHtml(card.data[c.column_name] || '')}</div></td>`).join('')}
    </tr>
  `).join('');
}

// 图片放大预览
function showImgModal(url) {
  let m = document.getElementById('img-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'img-modal';
    m.className = 'modal-backdrop';
    m.innerHTML = `<div class="modal" style="max-width:720px;padding:0;overflow:hidden">
      <button class="modal-close" onclick="document.getElementById('img-modal').remove()">✕</button>
      <img id="img-modal-img" src="" style="width:100%;display:block;border-radius:var(--radius-lg)">
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  }
  document.getElementById('img-modal-img').src = url;
  document.getElementById('img-modal').style.display = 'flex';
}

// ── 素材库 Tab ────────────────────────────────────────────────────────────────
let mediaPage = 1;
const mediaPageSize = 30;
let mediaTotal = 0;
let mediaPendingFiles = [];  // 待上传文件列表
let mediaSearchTimer = null;

// ── 素材上传 ──────────────────────────────────────────────────────────────────
const mediaUploadZone = document.getElementById('media-upload-zone');
const mediaUploadInput = document.getElementById('media-upload-input');

mediaUploadZone.addEventListener('dragover', e => { e.preventDefault(); mediaUploadZone.classList.add('dragover'); });
mediaUploadZone.addEventListener('dragleave', () => mediaUploadZone.classList.remove('dragover'));
mediaUploadZone.addEventListener('drop', e => {
  e.preventDefault();
  mediaUploadZone.classList.remove('dragover');
  addMediaFiles(e.dataTransfer.files);
});
mediaUploadInput.addEventListener('change', () => {
  addMediaFiles(mediaUploadInput.files);
  mediaUploadInput.value = '';
});

function addMediaFiles(fileList) {
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  for (const f of fileList) {
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (allowed.has(ext)) mediaPendingFiles.push(f);
  }
  renderMediaPreview();
}

function renderMediaPreview() {
  const previewList = document.getElementById('media-preview-list');
  const previewItems = document.getElementById('media-preview-items');
  const countEl = document.getElementById('media-preview-count');
  if (!mediaPendingFiles.length) {
    previewList.style.display = 'none';
    return;
  }
  previewList.style.display = 'block';
  countEl.textContent = `已选 ${mediaPendingFiles.length} 张，请确认解析结果后上传`;

  previewItems.innerHTML = mediaPendingFiles.map((f, idx) => {
    const parsed = parseFilenameClient(f.name);
    const hasWarn = parsed.warnings.length > 0;
    return `
      <div class="media-preview-item ${hasWarn ? 'media-preview-warn' : ''}">
        <div class="media-preview-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
        <div class="media-preview-tags">
          <span class="media-tag media-tag-l1" title="客户问题类型">${escHtml(parsed.level1 || '—')}</span>
          <span class="media-tag media-tag-l2" title="素材类型">${escHtml(parsed.level2 || '—')}</span>
          <span class="media-tag media-tag-l3" title="团队">${escHtml(parsed.level3 || '—')}</span>
          ${parsed.description ? `<span class="media-tag media-tag-desc" title="描述">${escHtml(parsed.description)}</span>` : ''}
        </div>
        ${hasWarn ? `<div class="media-preview-warning">${parsed.warnings.join(' ')}</div>` : ''}
        <button class="media-preview-remove" onclick="removeMediaFile(${idx})" title="移除">✕</button>
      </div>
    `;
  }).join('');
}

function parseFilenameClient(filename) {
  // Mirror of server-side parse_media_filename
  const warnings = [];
  const dotIdx = filename.lastIndexOf('.');
  let name = dotIdx > -1 ? filename.slice(0, dotIdx) : filename;

  // Extract level3 from trailing brackets
  let level3 = '';
  const bracketRe = /[（(]([^）)]+)[）)]$/;
  const bm = name.match(bracketRe);
  if (bm) {
    level3 = bm[1].trim();
    name = name.slice(0, bm.index).trim();
  } else {
    warnings.push('未找到括号，团队标签为空');
  }

  const parts = name.split('_');
  const level1 = parts[0]?.trim() || '';
  const level2 = parts[1]?.trim() || '';
  const description = parts.slice(2).join('_').trim();

  if (!level1) warnings.push('客户问题类型为空');
  if (!level2) warnings.push('素材类型为空');

  return { level1, level2, level3, description, warnings };
}

function removeMediaFile(idx) {
  mediaPendingFiles.splice(idx, 1);
  renderMediaPreview();
}

function clearMediaPreview() {
  mediaPendingFiles = [];
  renderMediaPreview();
}

async function confirmMediaUpload() {
  if (!mediaPendingFiles.length) return;
  const btn = document.getElementById('media-confirm-upload-btn');
  const statusEl = document.getElementById('media-upload-status');
  btn.disabled = true;
  btn.textContent = '上传中...';
  statusEl.textContent = '';

  const fd = new FormData();
  mediaPendingFiles.forEach(f => fd.append('files[]', f));

  try {
    const results = await API.post('/api/admin/media/upload', fd, true);
    const created = results.filter(r => r.status === 'created').length;
    const replaced = results.filter(r => r.status === 'replaced').length;
    const errors = results.filter(r => r.error).length;
    let msg = `上传完成：新增 ${created} 张`;
    if (replaced) msg += `，替换 ${replaced} 张`;
    if (errors) msg += `，失败 ${errors} 张`;
    statusEl.innerHTML = `<span style="color:var(--success)">✓ ${msg}</span>`;
    showToast(msg, 'success');
    mediaPendingFiles = [];
    renderMediaPreview();
    loadMediaTags();
    loadMediaAssets(1);
  } catch (e) {
    statusEl.innerHTML = `<span style="color:var(--danger)">✗ ${e.message}</span>`;
    showToast(e.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = '确认上传';
}

// ── 素材浏览 ──────────────────────────────────────────────────────────────────
async function loadMediaTags() {
  const tags = await API.get('/api/admin/media/tags').catch(() => ({ level1_options: [], level2_options: [], level3_options: [] }));

  const fillSelect = (id, options, allLabel) => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = `<option value="">${allLabel}</option>` +
      options.map(v => `<option value="${escHtml(v)}" ${cur===v?'selected':''}>${escHtml(v)}</option>`).join('');
  };
  fillSelect('media-filter-l1', tags.level1_options, '全部问题类型');
  fillSelect('media-filter-l2', tags.level2_options, '全部素材类型');
  fillSelect('media-filter-l3', tags.level3_options, '全部团队');
}

async function loadMediaAssets(page) {
  mediaPage = page;
  const l1 = document.getElementById('media-filter-l1')?.value || '';
  const l2 = document.getElementById('media-filter-l2')?.value || '';
  const l3 = document.getElementById('media-filter-l3')?.value || '';
  const kw = document.getElementById('media-filter-keyword')?.value || '';

  const params = new URLSearchParams({ page, page_size: mediaPageSize });
  if (l1) params.set('level1', l1);
  if (l2) params.set('level2', l2);
  if (l3) params.set('level3', l3);
  if (kw) params.set('keyword', kw);

  const data = await API.get(`/api/admin/media?${params}`).catch(() => null);
  if (!data) return;
  mediaTotal = data.total;

  renderMediaGrid(data.items);
  renderPagination('media-pagination', page, Math.ceil(mediaTotal / mediaPageSize), p => loadMediaAssets(p));
}

function renderMediaGrid(items) {
  const grid = document.getElementById('media-grid');
  if (!items.length) {
    grid.innerHTML = '<div style="padding:60px;text-align:center;color:var(--gray-400);grid-column:1/-1">暂无匹配素材</div>';
    return;
  }
  grid.innerHTML = items.map(item => `
    <div class="media-item">
      <div class="media-item-img" onclick="showImgModal('${escHtml(item.url)}')">
        <img src="${escHtml(item.url)}" alt="${escHtml(item.original_filename)}" loading="lazy">
      </div>
      <div class="media-item-info">
        <div class="media-item-name" title="${escHtml(item.original_filename)}">${escHtml(item.original_filename)}</div>
        <div class="media-item-tags">
          <span class="media-tag media-tag-l1">${escHtml(item.level1)}</span>
          <span class="media-tag media-tag-l2">${escHtml(item.level2)}</span>
          <span class="media-tag media-tag-l3">${escHtml(item.level3)}</span>
        </div>
      </div>
      <button class="media-item-delete" onclick="deleteMedia(${item.id})" title="删除">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  `).join('');
}

async function deleteMedia(id) {
  if (!confirm('确定删除此素材图片？')) return;
  await API.del(`/api/admin/media/${id}`)
    .then(() => { showToast('已删除', 'success'); loadMediaAssets(mediaPage); })
    .catch(e => showToast(e.message, 'error'));
}

function debounceMediaSearch() {
  clearTimeout(mediaSearchTimer);
  mediaSearchTimer = setTimeout(() => loadMediaAssets(1), 400);
}

// ── 分页渲染工具 ──────────────────────────────────────────────────────────────
function renderPagination(containerId, current, total, onClick) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${current<=1?'disabled':''} onclick="(${onClick.toString()})(${current-1})">‹</button>`;
  for (let i = 1; i <= total; i++) {
    if (total > 7 && i > 2 && i < total - 1 && Math.abs(i - current) > 2) {
      if (i === 3 || i === total - 2) html += `<span class="page-info">…</span>`;
      continue;
    }
    html += `<button class="page-btn ${i===current?'active':''}" onclick="(${onClick.toString()})(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${current>=total?'disabled':''} onclick="(${onClick.toString()})(${current+1})">›</button>`;
  html += `<span class="page-info">${current}/${total} 页 · 共${mediaTotal||adminTotal}条</span>`;
  el.innerHTML = html;
}

// ── 工具 ──────────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
