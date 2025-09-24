// Data model and storage
const STORAGE_KEY = 'stock-tracker:v1';

/**
 * Stock schema
 * {
 *   id: string,
 *   name: string,
 *   fundCategory: string, // e.g., 10 year stock, Growth, Short term
 *   techCategory: string, // e.g., Rounding Bottom, Range Bound, Cup & Handle
 *   sector?: string,
 *   marketCap?: 'Large'|'Mid'|'Small'|'',
 *   stockGroup?: string,
 *   buyZones?: Array<{ min: number, max: number }>, // supports exact and ranges
 *   sellZones?: Array<{ min: number, max: number }>,
 *   avgZones?: Array<{ min: number, max: number }>,
 *   currentPrice?: number|null,
 *   status: 'watching'|'buy_zone'|'sell_zone'|'hold_zone'|'average_zone',
 *   notes?: string,
 *   updatedAt: number
 * }
 */

// No initial seed data; first load starts empty

function createId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load storage', e);
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initializeState() {
  const loaded = loadState();
  if (loaded && Array.isArray(loaded.stocks)) return loaded;
  const state = { stocks: [] };
  saveState(state);
  return state;
}

let appState = initializeState();

// DOM refs
const groupsContainer = document.getElementById('groupsContainer');
const searchInput = document.getElementById('searchInput');
const fundFilter = document.getElementById('fundFilter');
const techFilter = document.getElementById('techFilter');
const sectorFilter = document.getElementById('sectorFilter');
const marketCapFilter = document.getElementById('marketCapFilter');
const strategyFilter = document.getElementById('strategyFilter');
const groupFilter = document.getElementById('groupFilter');
const statusFilter = document.getElementById('statusFilter');
const sortSelect = document.getElementById('sortSelect');
const addStockBtn = document.getElementById('addStockBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const importJsonBtn = document.getElementById('importJsonBtn');

const groupTemplate = document.getElementById('groupTemplate');
const subgroupTemplate = document.getElementById('subgroupTemplate');
const cardTemplate = document.getElementById('cardTemplate');

// Dialog refs
const stockDialog = document.getElementById('stockDialog');
const stockForm = document.getElementById('stockForm');
const dialogTitle = document.getElementById('dialogTitle');
const fundList = document.getElementById('fundList');
const techList = document.getElementById('techList');
const sectorList = document.getElementById('sectorList');
const strategyList = document.getElementById('strategyList');
const cancelDialogBtn = document.getElementById('cancelDialogBtn');
// removed table templates as we keep cards view only

let editingId = null;

function getFundamentals() {
  const set = new Set(appState.stocks.map(s => s.fundCategory).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function getTechnicals() {
  const set = new Set(appState.stocks.map(s => s.techCategory).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function getSectors() {
  const set = new Set(appState.stocks.map(s => s.sector).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function getStrategies() { return []; }

function getGroups() {
  const set = new Set(appState.stocks.map(s => s.stockGroup).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function refreshCategoryControls() {
  const currentFund = fundFilter.value;
  const currentTech = techFilter.value;
  const currentSector = sectorFilter.value;
  const currentCap = marketCapFilter.value;
  const currentStrategy = strategyFilter ? strategyFilter.value : '';
  const currentGroup = groupFilter.value;
  fundFilter.innerHTML = '<option value="">All Fundamentals</option>' +
    getFundamentals().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  techFilter.innerHTML = '<option value="">All Technicals</option>' +
    getTechnicals().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  sectorFilter.innerHTML = '<option value="">All Sectors</option>' +
    getSectors().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (strategyFilter) {
    strategyFilter.innerHTML = '<option value="">All Strategies</option>';
  }
  groupFilter.innerHTML = '<option value="">All Groups</option>' +
    getGroups().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  fundFilter.value = currentFund;
  techFilter.value = currentTech;
  sectorFilter.value = currentSector;
  marketCapFilter.value = currentCap;
  if (strategyFilter) strategyFilter.value = currentStrategy;
  groupFilter.value = currentGroup;
  // Datalists
  fundList.innerHTML = getFundamentals().map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
  techList.innerHTML = getTechnicals().map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
  sectorList.innerHTML = getSectors().map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
  if (strategyList) strategyList.innerHTML = '';
  const groupList = document.getElementById('groupList');
  if (groupList) groupList.innerHTML = getGroups().map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUpdated(ts) {
  const d = new Date(ts);
  return `Updated ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}


function applyFiltersAndSort(stocks) {
  const q = searchInput.value.trim().toLowerCase();
  const fund = fundFilter.value;
  const tech = techFilter.value;
  const sector = sectorFilter.value;
  const cap = marketCapFilter.value;
  const strategy = strategyFilter ? strategyFilter.value : '';
  const group = groupFilter.value;
  const st = statusFilter.value;
  const sort = sortSelect.value;

  let result = stocks.filter(s => {
    if (fund && s.fundCategory !== fund) return false;
    if (tech && s.techCategory !== tech) return false;
    if (sector && s.sector !== sector) return false;
    if (cap && (s.marketCap || '') !== cap) return false;
    if (strategy && (s.strategyType || '') !== strategy) return false;
    if (group && (s.stockGroup || '') !== group) return false;
    if (st && s.status !== st) return false;
    if (q) {
      const buyText = (s.buyZones || []).map(z => `${z.min}-${z.max}`).join(' ');
      const sellText = (s.sellZones || []).map(z => `${z.min}-${z.max}`).join(' ');
      const hay = `${s.name} ${s.fundCategory} ${s.techCategory} ${s.sector} ${s.marketCap} ${s.strategyType} ${buyText} ${sellText} ${s.status} ${s.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  switch (sort) {
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'updated-asc':
      result.sort((a, b) => a.updatedAt - b.updatedAt);
      break;
    case 'updated-desc':
    default:
      result.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return result;
}

function groupByGroupThenTech(stocks) {
  const groupMap = new Map();
  for (const s of stocks) {
    const gKey = s.stockGroup || 'Ungrouped';
    const tKey = s.techCategory || '—';
    if (!groupMap.has(gKey)) groupMap.set(gKey, new Map());
    const techMap = groupMap.get(gKey);
    if (!techMap.has(tKey)) techMap.set(tKey, []);
    techMap.get(tKey).push(s);
  }
  const ordered = Array.from(groupMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, techMap]) => [group, Array.from(techMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))]);
  return ordered;
}

function render() {
  refreshCategoryControls();
  const filtered = applyFiltersAndSort(appState.stocks);
  const grouped = groupByGroupThenTech(filtered);
  groupsContainer.innerHTML = '';

  if (grouped.length === 0) {
    groupsContainer.innerHTML = '<div style="color:#9ca3af">No results</div>';
    return;
  }

  for (const [group, techGroups] of grouped) {
    const groupNode = groupTemplate.content.firstElementChild.cloneNode(true);
    const allCount = techGroups.reduce((acc, [, arr]) => acc + arr.length, 0);
    groupNode.querySelector('.group-title').textContent = group;
    groupNode.querySelector('.group-count').textContent = `${allCount}`;
    const groupBody = groupNode.querySelector('.group-body');

    const toggleBtn = groupNode.querySelector('.toggle-group');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = groupBody.style.display === 'none';
        groupBody.style.display = isHidden ? '' : 'none';
        toggleBtn.textContent = isHidden ? '▾' : '▸';
      });
    }

    const cards = document.createElement('div');
    cards.className = 'cards';
    const flattened = techGroups.flatMap(([, arr]) => arr);
    for (const s of flattened) {
      const card = cardTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.id = s.id;
      card.querySelector('.card-title').textContent = s.name;
      const statusBadge = card.querySelector('.badge.status');
      statusBadge.textContent = s.status;
      statusBadge.dataset.status = s.status;
      const techBadge = card.querySelector('.badge.tech');
      techBadge.textContent = s.techCategory || '';
      techBadge.style.display = s.techCategory ? 'inline-flex' : 'none';
      const capBadge = card.querySelector('.badge.cap');
      capBadge.textContent = s.marketCap ? `${s.marketCap} Cap` : '';
      capBadge.style.display = s.marketCap ? 'inline-flex' : 'none';
      const sectorBadge = card.querySelector('.badge.sector');
      sectorBadge.textContent = s.sector || '';
      sectorBadge.style.display = s.sector ? 'inline-flex' : 'none';
      const buyBadge = card.querySelector('.badge.buy');
      const buyText = (s.buyZones && s.buyZones.length)
        ? `Buy: ${s.buyZones.map(z => z.min === z.max ? `${z.min}` : `${z.min}-${z.max}`).join(', ')}`
        : '';
      buyBadge.textContent = buyText;
      buyBadge.style.display = buyText ? 'inline-flex' : 'none';
      const sellBadge = card.querySelector('.badge.sell');
      const sellText = (s.sellZones && s.sellZones.length)
        ? `Sell: ${s.sellZones.map(z => z.min === z.max ? `${z.min}` : `${z.min}-${z.max}`).join(', ')}`
        : '';
      sellBadge.textContent = sellText;
      sellBadge.style.display = sellText ? 'inline-flex' : 'none';
      const avgBadge = card.querySelector('.badge.avg');
      if (avgBadge) {
        const avgText = (s.status === 'average_zone' || (s.avgZones && s.avgZones.length))
          ? `Avg: ${(s.avgZones||[]).map(z => z.min === z.max ? `${z.min}` : `${z.min}-${z.max}`).join(', ')}`
          : '';
        avgBadge.textContent = avgText;
        avgBadge.style.display = avgText ? 'inline-flex' : 'none';
      }
      const priceBadge = card.querySelector('.badge.price');
      if (priceBadge) {
        priceBadge.textContent = (s.currentPrice != null) ? `₹${s.currentPrice}` : '';
        priceBadge.style.display = (s.currentPrice != null) ? 'inline-flex' : 'none';
      }
      card.querySelector('.updated').textContent = formatUpdated(s.updatedAt);
      
      // Edit and delete handlers
      const editBtn = card.querySelector('.icon-btn.edit');
      const deleteBtn = card.querySelector('.icon-btn.delete');
      
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Edit button clicked for stock:', s.id, s.name);
          openEditDialog(s.id);
        });
      } else {
        console.error('Edit button not found in card template');
      }
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          deleteStock(s.id);
        });
      }
      cards.appendChild(card);
    }
    groupBody.appendChild(cards);
    groupsContainer.appendChild(groupNode);
  }
}

function openAddDialog() {
  editingId = null;
  dialogTitle.textContent = 'Add Stock';
  stockForm.reset();
  stockForm.status.value = 'watching';
  stockDialog.showModal();
}

function openEditDialog(id) {
  console.log('Opening edit dialog for ID:', id);
  const s = appState.stocks.find(x => x.id === id);
  if (!s) {
    console.error('Stock not found for ID:', id);
    return;
  }
  editingId = id;
  dialogTitle.textContent = 'Edit Stock';

  const setField = (fieldName, value) => {
    const el = stockForm.elements.namedItem(fieldName);
    if (el) {
      el.value = value ?? '';
    }
  };

  setField('name', s.name);
  setField('fundCategory', s.fundCategory || '');
  setField('techCategory', s.techCategory || '');
  setField('stockGroup', s.stockGroup || '');
  setField('sector', s.sector || '');
  setField('marketCap', s.marketCap || '');
  setField('currentPrice', s.currentPrice ?? '');

  const zoneToString = (z) => z ? (z.min === z.max ? `${z.min}` : `${z.min}-${z.max}`) : '';
  setField('buyZone', zoneToString((s.buyZones && s.buyZones[0]) || null));
  setField('sellZone', zoneToString((s.sellZones && s.sellZones[0]) || null));
  setField('avgZone', zoneToString((s.avgZones && s.avgZones[0]) || null));
  setField('status', s.status);
  // Notes may not exist in the form anymore
  setField('notes', s.notes || '');

  stockDialog.showModal();
}

function upsertStock(payload) {
  const now = Date.now();
  if (editingId) {
    const idx = appState.stocks.findIndex(s => s.id === editingId);
    if (idx >= 0) {
      appState.stocks[idx] = { ...appState.stocks[idx], ...payload, updatedAt: now };
    }
    editingId = null;
  } else {
    appState.stocks.push({ id: createId(), updatedAt: now, ...payload });
  }
  saveState(appState);
  render();
}

function updateStock(id, partial) {
  const idx = appState.stocks.findIndex(s => s.id === id);
  if (idx === -1) return;
  appState.stocks[idx] = { ...appState.stocks[idx], ...partial, updatedAt: Date.now() };
  saveState(appState);
  render();
}

function deleteStock(id) {
  if (!confirm('Delete this stock?')) return;
  appState.stocks = appState.stocks.filter(s => s.id !== id);
  saveState(appState);
  render();
}

// Form submit
stockForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = new FormData(stockForm);
  function parseZone(raw) {
    const text = String(raw || '').trim();
    if (!text) return [];
    const part = text;
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(x => Number(x.trim()));
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      return Number.isFinite(min) && Number.isFinite(max) ? [{ min, max }] : [];
    }
    const v = Number(part);
    return Number.isFinite(v) ? [{ min: v, max: v }] : [];
  }
  const payload = {
    name: String(form.get('name') || '').trim(),
    fundCategory: String(form.get('fundCategory') || '').trim(),
    techCategory: String(form.get('techCategory') || '').trim(),
    stockGroup: String(form.get('stockGroup') || '').trim(),
    sector: String(form.get('sector') || '').trim(),
    marketCap: String(form.get('marketCap') || ''),
    strategyType: '',
    currentPrice: form.get('currentPrice') ? Number(form.get('currentPrice')) : null,
    priceUpdatedAt: null,
    buyZones: parseZone(form.get('buyZone')),
    sellZones: parseZone(form.get('sellZone')),
    avgZones: parseZone(form.get('avgZone')),
    status: String(form.get('status') || 'watching'),
    notes: String(form.get('notes') || '').trim(),
  };
  if (!payload.name) return;
  upsertStock(payload);
  stockDialog.close();
});

// Toolbar handlers
addStockBtn.addEventListener('click', openAddDialog);

// Clear filters button
clearFiltersBtn.addEventListener('click', () => {
  searchInput.value = '';
  fundFilter.value = '';
  techFilter.value = '';
  sectorFilter.value = '';
  marketCapFilter.value = '';
  groupFilter.value = '';
  statusFilter.value = '';
  sortSelect.value = 'updated-desc';
  render();
});

[searchInput, fundFilter, techFilter, sectorFilter, marketCapFilter, groupFilter, statusFilter, sortSelect].concat(strategyFilter? [strategyFilter] : []).forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});

// Ensure Cancel closes dialog
if (cancelDialogBtn) {
  cancelDialogBtn.addEventListener('click', () => {
    stockDialog.close();
  });
}

// (CSV export removed)

// JSON Export
if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-tracker.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// JSON Import
if (importJsonInput) {
  if (importJsonBtn) {
    importJsonBtn.addEventListener('click', () => importJsonInput.click());
  }
  importJsonInput.addEventListener('change', async (e) => {
    try {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      // Basic validation: expect an object with array stocks
      if (!data || typeof data !== 'object' || !Array.isArray(data.stocks)) {
        alert('Invalid JSON format. Expected { "stocks": [...] }');
        return;
      }
      // Normalize minimal fields and set missing timestamps/ids
      const now = Date.now();
      const normalized = data.stocks.map((s) => ({
        id: s.id || (typeof s.name === 'string' ? (s.id ?? (Math.random().toString(36).slice(2) + now.toString(36))) : (Math.random().toString(36).slice(2) + now.toString(36))),
        name: String(s.name || '').trim(),
        fundCategory: String(s.fundCategory || ''),
        techCategory: String(s.techCategory || ''),
        sector: String(s.sector || ''),
        marketCap: String(s.marketCap || ''),
        strategyType: String(s.strategyType || ''),
        stockGroup: String(s.stockGroup || ''),
        buyZones: Array.isArray(s.buyZones) ? s.buyZones : [],
        sellZones: Array.isArray(s.sellZones) ? s.sellZones : [],
        avgZones: Array.isArray(s.avgZones) ? s.avgZones : [],
        currentPrice: (s.currentPrice == null || Number.isNaN(Number(s.currentPrice))) ? null : Number(s.currentPrice),
        status: s.status || 'watching',
        notes: String(s.notes || ''),
        updatedAt: Number.isFinite(Number(s.updatedAt)) ? Number(s.updatedAt) : now,
        priceUpdatedAt: Number.isFinite(Number(s.priceUpdatedAt)) ? Number(s.priceUpdatedAt) : null,
        symbolNSE: String(s.symbolNSE || ''),
        symbolBSE: String(s.symbolBSE || ''),
        stopLoss: s.stopLoss || '',
        positionSize: s.positionSize || ''
      })).filter(s => s.name);
      appState = { stocks: normalized };
      saveState(appState);
      render();
      // reset input so same file can be re-imported if needed
      importJsonInput.value = '';
      alert('Import successful.');
    } catch (err) {
      console.error('Import failed', err);
      alert('Failed to import JSON. See console for details.');
    }
  });
}

// Initial render
render();

// No periodic price updates since removed live fetch feature

