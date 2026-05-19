// == cards.js ==

let displayConfig = [];
let filterDimensions = [];
let activeFilters = {};
let currentPage = 1;
const pageSize = 24;
let totalCards = 0;
let allLoaded = false;
let isLoading = false;
let keyword = '';
let searchTimer = null;
let globalSwitchersVisible = true;

const TAG_COLORS = 8;
function tagColorClass(colName) {
  let hash = 0;
  for (let i = 0; i < colName.length; i++) hash = (hash * 31 + colName.charCodeAt(i)) & 0xff;
  return 'tag-color-' + (hash % TAG_COLORS);
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function l3Label(key) {
  return key === '' ? '通用' : key;
}

const L3_NONE = '__none__';

// == Init ==
async function init() {
  const params = new URLSearchParams(location.search);
  const savedFilters = params.get('filters');
  if (savedFilters) {
    try {
      const obj = JSON.parse(savedFilters);
      for (const [k, v] of Object.entries(obj)) activeFilters[k] = new Set(v);
    } catch(_) {}
  }
  keyword = params.get('q') || '';
  if (keyword) document.getElementById('search-input').value = keyword;

  try {
    const [cfg, dims] = await Promise.all([
      API.get('/api/config/display'),
      API.get('/api/filters'),
    ]);
    displayConfig = cfg.filter(c => c.is_visible);
    filterDimensions = dims;
  } catch(e) {
    console.error('init failed', e);
  }
  renderFilterBar();
  await loadCards(true);
}

// == Search ==
document.getElementById('search-input')?.addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { keyword = e.target.value.trim(); refresh(); }, 350);
});

// == Filter bar ==
function renderFilterBar() {
  const bar = document.getElementById('filter-bar-inner');
  if (!filterDimensions.length) {
    bar.innerHTML = '<p class="text-muted text-sm">暂无筛选维度，请先在后台配置字段</p>';
    return;
  }
  bar.innerHTML = filterDimensions.map(dim => {
    const selected = activeFilters[dim.column] || new Set();
    const colorCls = tagColorClass(dim.column);
    return `<div class="filter-group">
      <span class="filter-group-label">${escHtml(dim.display_name)}</span>
      <div class="filter-tags">
        <span class="filter-tag all-tag ${selected.size === 0 ? 'active' : ''}"
              onclick="clearDimFilter('${escHtml(dim.column)}')">全部</span>
        ${dim.options.map(opt => `
          <span class="filter-tag ${colorCls} ${selected.has(opt.value) ? 'active' : ''}"
                onclick="toggleFilter('${escHtml(dim.column)}','${escHtml(opt.value)}')"
                title="${escHtml(opt.value)} (${opt.count})">
            ${escHtml(opt.value)}
          </span>`).join('')}
      </div>
    </div>`;
  }).join('');
  updateClearBtn();
}

function toggleFilter(col, val) {
  if (!activeFilters[col]) activeFilters[col] = new Set();
  if (activeFilters[col].has(val)) activeFilters[col].delete(val);
  else activeFilters[col].add(val);
  if (activeFilters[col].size === 0) delete activeFilters[col];
  refresh();
}
function clearDimFilter(col) { delete activeFilters[col]; refresh(); }
document.getElementById('clear-all-filters')?.addEventListener('click', () => { activeFilters = {}; refresh(); });

function updateClearBtn() {
  const hasFilter = Object.keys(activeFilters).some(k => activeFilters[k]?.size > 0);
  const btn = document.getElementById('clear-all-filters');
  if (btn) btn.style.display = hasFilter ? 'inline' : 'none';
}

function buildFiltersParam() {
  const obj = {};
  for (const [k, v] of Object.entries(activeFilters)) { if (v.size > 0) obj[k] = [...v]; }
  return Object.keys(obj).length ? JSON.stringify(obj) : '';
}

function refresh() {
  currentPage = 1; allLoaded = false;
  document.getElementById('cards-grid').innerHTML = '';
  renderFilterBar(); syncURL(); loadCards(true);
}

function syncURL() {
  const params = new URLSearchParams();
  const f = buildFiltersParam();
  if (f) params.set('filters', f);
  if (keyword) params.set('q', keyword);
  history.replaceState({}, '', location.pathname + (params.size ? '?' + params : ''));
}

// == Load cards ==
async function loadCards(replace = false) {
  if (isLoading || allLoaded) return;
  isLoading = true;
  showLoadingState(true);
  const filters = buildFiltersParam();
  let url = `/api/cards?page=${currentPage}&page_size=${pageSize}`;
  if (filters) url += `&filters=${encodeURIComponent(filters)}`;
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
  try {
    const data = await API.get(url);
    totalCards = data.total;
    if (replace) document.getElementById('cards-grid').innerHTML = '';
    renderCards(data.cards);
    updateCount();
    if (data.cards.length < pageSize || currentPage * pageSize >= totalCards) {
      allLoaded = true;
      document.getElementById('load-more-wrap').style.display = 'none';
    } else {
      document.getElementById('load-more-wrap').style.display = 'flex';
    }
    currentPage++;
  } catch(e) { console.error('load failed', e); }
  finally { isLoading = false; showLoadingState(false); }
}

function showLoadingState(show) {
  const el = document.getElementById('loading-indicator');
  if (el) el.style.display = show ? 'flex' : 'none';
}
function updateCount() {
  const el = document.getElementById('result-count');
  if (el) el.innerHTML = `共 <strong>${totalCards}</strong> 条`;
}

// == Switcher toggle ==
function toggleCardSwitcher(el) {
  el._switcherVisible = !el._switcherVisible;
  const area = el.querySelector('.card-switcher-area');
  const btn = el.querySelector('.card-switcher-toggle-btn');
  if (area) area.classList.toggle('collapsed', !el._switcherVisible);
  if (btn) {
    btn.classList.toggle('collapsed', !el._switcherVisible);
    btn.title = el._switcherVisible ? '收起选择器' : '展开选择器';
  }
}

function toggleAllSwitchers() {
  globalSwitchersVisible = !globalSwitchersVisible;
  const label = document.getElementById('switcher-toggle-label');
  const btn = document.getElementById('switcher-toggle-all');
  if (label) label.textContent = globalSwitchersVisible ? '收起全部' : '展开全部';
  if (btn) btn.classList.toggle('collapsed', !globalSwitchersVisible);

  document.querySelectorAll('.item-card').forEach(el => {
    el._switcherVisible = globalSwitchersVisible;
    const area = el.querySelector('.card-switcher-area');
    const tbtn = el.querySelector('.card-switcher-toggle-btn');
    if (area) area.classList.toggle('collapsed', !globalSwitchersVisible);
    if (tbtn) {
      tbtn.classList.toggle('collapsed', !globalSwitchersVisible);
      tbtn.title = globalSwitchersVisible ? '收起选择器' : '展开选择器';
    }
  });
}

// == Render cards ==
function renderCards(cards) {
  const grid = document.getElementById('cards-grid');

  if (!cards.length && currentPage === 1) {
    grid.innerHTML = `<div class="no-results">
      <svg width="60" height="60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p>没有找到符合条件的内容</p>
    </div>`;
    return;
  }

  cards.forEach(card => {
    const imageMap = card.image_map || {};
    const level2Keys = Object.keys(imageMap);
    const defaultL2 = level2Keys.length > 0 ? level2Keys[0] : null;
    const level3Keys = defaultL2 ? Object.keys(imageMap[defaultL2]) : [];
    const defaultL3 = level3Keys.length > 0 ? level3Keys[0] : null;

    const primaryField = card.fields.find(f => f.is_primary) || card.fields[0];
    const bodyFields = card.fields.filter(f => !f.is_primary && f.field_type !== 'tag' && f.value);

    const el = document.createElement('article');
    el.className = 'item-card';
    el.dataset.cardId = card.id;
    el._imageMap = imageMap;
    el._activeL2 = defaultL2;
    el._activeL3 = defaultL3;
    el._switcherVisible = globalSwitchersVisible;

    // per-card toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'card-switcher-toggle-btn' + (globalSwitchersVisible ? '' : ' collapsed');
    toggleBtn.title = globalSwitchersVisible ? '收起选择器' : '展开选择器';
    toggleBtn.innerHTML = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    toggleBtn.addEventListener('click', e => { e.stopPropagation(); toggleCardSwitcher(el); });

    renderCardContent(el, card, primaryField, bodyFields);
    el.appendChild(toggleBtn);

    el.addEventListener('click', e => {
      if (e.target.closest('.card-switcher-toggle-btn')) return;
      const l2btn = e.target.closest('.card-level2-btn');
      const l3btn = e.target.closest('.card-level3-btn');
      if (l2btn) { e.stopPropagation(); setCardL2(el, l2btn.dataset.l2); return; }
      if (l3btn) { e.stopPropagation(); setCardL3(el, l3btn.dataset.l3); return; }
      openDetail(card, el._activeL2, el._activeL3);
    });

    grid.appendChild(el);
  });

  if ('IntersectionObserver' in window) {
    const imgs = grid.querySelectorAll('img[loading=lazy]');
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.removeAttribute('loading'); o.unobserve(entry.target); }
      });
    }, { rootMargin: '200px' });
    imgs.forEach(img => obs.observe(img));
  }
}

function getCurrentImageUrl(imageMap, activeL2, activeL3) {
  if (!activeL2 || activeL3 === L3_NONE) return null;
  return (imageMap[activeL2] || {})[activeL3] || null;
}

function buildImgHTML(url) {
  if (!url) return '';
  return `<div class="card-img-wrap"><img src="${escHtml(url)}" alt="" loading="lazy"></div>`;
}

function buildSwitcherInner(imageMap, activeL2, activeL3) {
  const level2Keys = Object.keys(imageMap);
  if (!level2Keys.length) return '';

  const l2html = level2Keys.length > 1
    ? `<div class="card-level2-switcher">
         ${level2Keys.map(k => `<button class="card-level2-btn${k === activeL2 ? ' active' : ''}" data-l2="${escAttr(k)}">${escHtml(k)}</button>`).join('')}
       </div>`
    : `<div class="card-level2-single">${escHtml(level2Keys[0])}</div>`;

  const level3Keys = activeL2 ? Object.keys(imageMap[activeL2] || {}) : [];
  const l3btns = level3Keys.map(k =>
    `<button class="card-level3-btn${k === activeL3 ? ' active' : ''}" data-l3="${escAttr(k)}">${escHtml(l3Label(k))}</button>`
  ).join('');
  const noneBtn = `<button class="card-level3-btn card-level3-none${activeL3 === L3_NONE ? ' active' : ''}" data-l3="${L3_NONE}">不显示</button>`;

  const l3html = level3Keys.length > 0
    ? `<div class="card-level3-switcher">${l3btns}${noneBtn}</div>`
    : '';

  return l2html + l3html;
}

function renderCardContent(el, card, primaryField, bodyFields) {
  const url = getCurrentImageUrl(el._imageMap, el._activeL2, el._activeL3);
  const imgHTML = buildImgHTML(url);
  const switcherInner = buildSwitcherInner(el._imageMap, el._activeL2, el._activeL3);
  const collapseCls = globalSwitchersVisible ? '' : ' collapsed';
  const switcherArea = switcherInner ? `<div class="card-switcher-area${collapseCls}">${switcherInner}</div>` : '';

  const tagsHTML = card.tags.length
    ? `<div class="card-tags">${card.tags.map(t => `<span class="tag ${tagColorClass(t.column)}">${escHtml(t.value)}</span>`).join('')}</div>`
    : '';
  const bodyHTML = bodyFields.slice(0, 3).map(f =>
    `<div class="card-field"><span class="card-field-label">${escHtml(f.display_name)}</span><span class="card-field-value">${escHtml(f.value)}</span></div>`
  ).join('');

  el.innerHTML = imgHTML + switcherArea
    + `<div class="card-body">
         ${primaryField ? `<h3 class="card-primary">${escHtml(primaryField.value)}</h3>` : ''}
         ${bodyHTML}${tagsHTML}
       </div>`;
}

function setCardL2(el, l2) {
  el._activeL2 = l2;
  const l3Keys = Object.keys(el._imageMap[l2] || {});
  el._activeL3 = l3Keys.length > 0 ? l3Keys[0] : L3_NONE;
  refreshCardDisplay(el);
}

function setCardL3(el, l3) {
  el._activeL3 = l3;
  refreshCardDisplay(el);
}

function refreshCardDisplay(el) {
  // rebuild full switcher area
  const area = el.querySelector('.card-switcher-area');
  if (!area) return;

  const inner = buildSwitcherInner(el._imageMap, el._activeL2, el._activeL3);
  area.innerHTML = inner;

  // update image
  const url = getCurrentImageUrl(el._imageMap, el._activeL2, el._activeL3);
  const existing = el.querySelector('.card-img-wrap');
  if (url) {
    if (existing) existing.querySelector('img').src = url;
    else {
      const div = document.createElement('div');
      div.className = 'card-img-wrap';
      div.innerHTML = `<img src="${escHtml(url)}" alt="">`;
      el.insertBefore(div, el.firstChild);
    }
  } else {
    if (existing) existing.remove();
  }
}

// == Detail modal ==
function openDetail(card, initL2, initL3) {
  const imageMap = card.image_map || {};
  const level2Keys = Object.keys(imageMap);

  let curL2 = initL2 || (level2Keys[0] || null);
  let curL3 = initL3;
  if (curL2 && curL3 !== L3_NONE && !curL3) {
    const l3k = Object.keys(imageMap[curL2] || {});
    curL3 = l3k[0] || null;
  }

  function getUrl(l2, l3) {
    if (!l2 || l3 === L3_NONE) return null;
    return (imageMap[l2] || {})[l3] || null;
  }

  function buildDetailSwitcherHTML(l2, l3) {
    const level3Keys = l2 ? Object.keys(imageMap[l2] || {}) : [];
    const l2html = level2Keys.length > 1
      ? `<div class="detail-level2-switcher">${level2Keys.map(k => `<button class="detail-level2-btn${k === l2 ? ' active' : ''}" data-l2="${escAttr(k)}">${escHtml(k)}</button>`).join('')}</div>`
      : (level2Keys.length === 1 ? `<div class="detail-level2-single">${escHtml(level2Keys[0])}</div>` : '');
    const l3btns = level3Keys.map(k =>
      `<button class="detail-level3-btn${k === l3 ? ' active' : ''}" data-l3="${escAttr(k)}">${escHtml(l3Label(k))}</button>`
    ).join('');
    const noneBtn = `<button class="detail-level3-btn detail-level3-none${l3 === L3_NONE ? ' active' : ''}" data-l3="${L3_NONE}">不显示</button>`;
    const l3html = level3Keys.length > 0
      ? `<div class="detail-level3-switcher">${l3btns}${noneBtn}</div>`
      : '';
    return l2html + l3html;
  }

  const initUrl = getUrl(curL2, curL3);
  const primaryField = card.fields.find(f => f.is_primary) || card.fields[0];
  const otherFields = card.fields.filter(f => !f.is_primary && f.value);

  const backdrop = document.createElement('div');
  backdrop.className = 'detail-modal-backdrop';
  backdrop.innerHTML = `
    <div class="detail-modal">
      <button class="detail-modal-close" onclick="this.closest('.detail-modal-backdrop').remove()">&#x2715;</button>
      ${initUrl ? `<img class="detail-modal-img" src="${escHtml(initUrl)}" alt="" id="dm-img">` : ''}
      <div id="dm-switcher">${buildDetailSwitcherHTML(curL2, curL3)}</div>
      <div class="detail-modal-body">
        ${primaryField ? `<h2 class="detail-modal-title">${escHtml(primaryField.value)}</h2>` : ''}
        <hr class="detail-divider">
        ${otherFields.map(f => `
          <div class="detail-field">
            <span class="detail-field-label">${escHtml(f.display_name)}</span>
            <div class="detail-field-value">${escHtml(f.value)}</div>
          </div>`).join('')}
        ${card.tags.length ? `
          <hr class="detail-divider">
          <div class="detail-tags">
            ${card.tags.map(t => `<span class="tag ${tagColorClass(t.column)}">${escHtml(t.display_name)}：${escHtml(t.value)}</span>`).join('')}
          </div>` : ''}
      </div>
    </div>`;

  function updateDetailImg(newUrl) {
    const imgEl = backdrop.querySelector('#dm-img');
    const modal = backdrop.querySelector('.detail-modal');
    if (newUrl) {
      if (imgEl) imgEl.src = newUrl;
      else modal.insertAdjacentHTML('afterbegin', `<img class="detail-modal-img" src="${escHtml(newUrl)}" alt="" id="dm-img">`);
    } else {
      if (imgEl) imgEl.remove();
    }
  }

  backdrop.addEventListener('click', e => {
    const l2btn = e.target.closest('.detail-level2-btn');
    const l3btn = e.target.closest('.detail-level3-btn');
    if (l2btn) {
      curL2 = l2btn.dataset.l2;
      const l3k = Object.keys(imageMap[curL2] || {});
      curL3 = l3k[0] || null;
      backdrop.querySelector('#dm-switcher').innerHTML = buildDetailSwitcherHTML(curL2, curL3);
      updateDetailImg(getUrl(curL2, curL3));
      return;
    }
    if (l3btn) {
      curL3 = l3btn.dataset.l3;
      backdrop.querySelector('#dm-switcher').innerHTML = buildDetailSwitcherHTML(curL2, curL3);
      updateDetailImg(getUrl(curL2, curL3));
      return;
    }
    if (e.target === backdrop) backdrop.remove();
  });

  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); }
  }, { once: true });
  document.body.appendChild(backdrop);
}

// == Load more ==
document.getElementById('load-more-btn')?.addEventListener('click', () => loadCards(false));

// == Start ==
init();
