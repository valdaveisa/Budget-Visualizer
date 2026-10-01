/* =============================================
   Expense & Budget Visualizer — app.js
   Vanilla JS | No frameworks
   ============================================= */

'use strict';

/* ── Storage keys ──────────────────────────── */
const STORAGE_KEYS = {
  TRANSACTIONS: 'ebv_transactions',
  THEME:        'ebv_theme',
  LIMIT:        'ebv_limit',
  CATEGORIES:   'ebv_custom_categories',
};

/* ── Category colour palette ───────────────── */
const CATEGORY_COLORS = {
  Food:      '#10b981',
  Transport: '#3b82f6',
  Fun:       '#f97316',
  Shopping:  '#8b5cf6',
  Health:    '#ec4899',
};
// fallback colours for custom categories
const FALLBACK_COLORS = [
  '#06b6d4','#84cc16','#eab308','#f43f5e',
  '#6366f1','#14b8a6','#a78bfa','#fb7185',
];

/* ── State ─────────────────────────────────── */
let transactions     = [];
let spendingLimit    = null;   // null = not set
let customCategories = [];     // user-added category names
let currentMonth;              // { year, month } for monthly summary nav
let chartInstance    = null;

/* ── DOM refs ──────────────────────────────── */
const dom = {
  // theme
  themeToggle:         document.getElementById('themeToggle'),
  themeIcon:           document.getElementById('themeIcon'),
  // balance
  totalBalance:        document.getElementById('totalBalance'),
  // limit banner
  limitBanner:         document.getElementById('limitBanner'),
  limitDisplay:        document.getElementById('limitDisplay'),
  // form
  transactionForm:     document.getElementById('transactionForm'),
  itemName:            document.getElementById('itemName'),
  amount:              document.getElementById('amount'),
  category:            document.getElementById('category'),
  customCategoryGroup: document.getElementById('customCategoryGroup'),
  customCategory:      document.getElementById('customCategory'),
  nameError:           document.getElementById('nameError'),
  amountError:         document.getElementById('amountError'),
  categoryError:       document.getElementById('categoryError'),
  customCategoryError: document.getElementById('customCategoryError'),
  // limit setter
  limitInput:          document.getElementById('limitInput'),
  setLimitBtn:         document.getElementById('setLimitBtn'),
  clearLimitBtn:       document.getElementById('clearLimitBtn'),
  limitStatus:         document.getElementById('limitStatus'),
  // transactions
  transactionList:     document.getElementById('transactionList'),
  emptyState:          document.getElementById('emptyState'),
  sortSelect:          document.getElementById('sortSelect'),
  // chart
  spendingChart:       document.getElementById('spendingChart'),
  chartEmpty:          document.getElementById('chartEmpty'),
  // monthly
  prevMonth:           document.getElementById('prevMonth'),
  nextMonth:           document.getElementById('nextMonth'),
  monthLabel:          document.getElementById('monthLabel'),
  monthlySummary:      document.getElementById('monthlySummary'),
};

/* =============================================
   INIT
   ============================================= */
function init() {
  loadFromStorage();
  applyTheme(getSavedTheme());

  // Set current month to today
  const now = new Date();
  currentMonth = { year: now.getFullYear(), month: now.getMonth() };

  renderAll();
  bindEvents();
}

/* =============================================
   LOCAL STORAGE
   ============================================= */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    transactions = raw ? JSON.parse(raw) : [];
  } catch { transactions = []; }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIMIT);
    spendingLimit = raw !== null ? parseFloat(raw) : null;
  } catch { spendingLimit = null; }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    customCategories = raw ? JSON.parse(raw) : [];
  } catch { customCategories = []; }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

function saveLimit() {
  if (spendingLimit === null) {
    localStorage.removeItem(STORAGE_KEYS.LIMIT);
  } else {
    localStorage.setItem(STORAGE_KEYS.LIMIT, String(spendingLimit));
  }
}

function saveCustomCategories() {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(customCategories));
}

/* =============================================
   THEME
   ============================================= */
function getSavedTheme() {
  return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
  // Rebuild chart so its colours match the new theme
  renderChart();
}

/* =============================================
   RENDER ALL
   ============================================= */
function renderAll() {
  populateCategorySelect();
  renderBalance();
  renderLimitBanner();
  renderTransactions();
  renderChart();
  renderMonthlySummary();
  syncLimitUI();
}

/* =============================================
   CATEGORY SELECT — including custom ones
   ============================================= */
function populateCategorySelect() {
  const sel = dom.category;
  // Keep the first placeholder option
  const placeholder = sel.options[0];
  sel.innerHTML = '';
  sel.appendChild(placeholder);

  const builtIn = ['Food', 'Transport', 'Fun', 'Shopping', 'Health'];
  const all = [...builtIn, ...customCategories];

  all.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });

  // Always add the "+ Add Custom…" option at the end
  const customOpt = document.createElement('option');
  customOpt.value = 'Custom';
  customOpt.textContent = '+ Add Custom…';
  sel.appendChild(customOpt);
}

/* =============================================
   BALANCE
   ============================================= */
function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  dom.totalBalance.textContent = formatCurrency(total);
}

/* =============================================
   LIMIT BANNER & UI
   ============================================= */
function renderLimitBanner() {
  if (spendingLimit === null) {
    dom.limitBanner.classList.add('hidden');
    return;
  }
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  dom.limitDisplay.textContent = formatCurrency(spendingLimit);
  if (total > spendingLimit) {
    dom.limitBanner.classList.remove('hidden');
  } else {
    dom.limitBanner.classList.add('hidden');
  }
}

function syncLimitUI() {
  if (spendingLimit !== null) {
    dom.limitInput.value = spendingLimit;
    dom.limitStatus.textContent = `Limit set to ${formatCurrency(spendingLimit)}`;
  } else {
    dom.limitInput.value = '';
    dom.limitStatus.textContent = '';
  }
}

/* =============================================
   TRANSACTIONS
   ============================================= */
function getSortedTransactions() {
  const sort = dom.sortSelect.value;
  const list = [...transactions];

  switch (sort) {
    case 'date-asc':
      return list.sort((a, b) => a.id - b.id);
    case 'date-desc':
      return list.sort((a, b) => b.id - a.id);
    case 'amount-asc':
      return list.sort((a, b) => a.amount - b.amount);
    case 'amount-desc':
      return list.sort((a, b) => b.amount - a.amount);
    case 'category-az':
      return list.sort((a, b) => a.category.localeCompare(b.category));
    default:
      return list.sort((a, b) => b.id - a.id);
  }
}

function renderTransactions() {
  const list = dom.transactionList;

  // Remove all items (keep the empty-state li)
  Array.from(list.querySelectorAll('.transaction-item')).forEach(el => el.remove());

  const sorted = getSortedTransactions();

  if (sorted.length === 0) {
    dom.emptyState.style.display = '';
    return;
  }

  dom.emptyState.style.display = 'none';

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const isOverLimit = spendingLimit !== null && total > spendingLimit;

  sorted.forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    if (isOverLimit) li.classList.add('over-limit');
    li.dataset.id = t.id;

    li.innerHTML = `
      <div class="transaction-info">
        <span class="transaction-name">${escapeHtml(t.name)}</span>
        <span class="transaction-amount">${formatCurrency(t.amount)}</span>
        <span class="transaction-category">${escapeHtml(t.category)}</span>
      </div>
      <button class="btn-delete" aria-label="Delete ${escapeHtml(t.name)}">Delete</button>
    `;

    li.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(t.id));
    list.appendChild(li);
  });
}

function addTransaction(name, amount, category) {
  const newTransaction = {
    id:       Date.now(),
    name:     name.trim(),
    amount:   parseFloat(parseFloat(amount).toFixed(2)),
    category: category.trim(),
    date:     new Date().toISOString(),
  };
  transactions.push(newTransaction);
  saveTransactions();
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

/* =============================================
   PIE CHART
   ============================================= */
function getCategoryTotals() {
  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  return totals;
}

function getCategoryColor(category, index) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function renderChart() {
  const totals = getCategoryTotals();
  const categories = Object.keys(totals);
  const values = categories.map(c => totals[c]);

  if (categories.length === 0) {
    dom.chartEmpty.style.display = '';
    dom.spendingChart.style.display = 'none';
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  dom.chartEmpty.style.display = 'none';
  dom.spendingChart.style.display = '';

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const legendColor = isDark ? '#94a3b8' : '#6b7280';
  const colors = categories.map((cat, i) => getCategoryColor(cat, i));

  const data = {
    labels: categories,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: legendColor,
          font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" },
          padding: 14,
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
        },
      },
    },
  };

  if (chartInstance) {
    chartInstance.data = data;
    chartInstance.options = options;
    chartInstance.update();
  } else {
    chartInstance = new Chart(dom.spendingChart, {
      type: 'pie',
      data,
      options,
    });
  }
}

/* =============================================
   MONTHLY SUMMARY
   ============================================= */
function formatMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getMonthlyTransactions(year, month) {
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function renderMonthlySummary() {
  const { year, month } = currentMonth;
  dom.monthLabel.textContent = formatMonthLabel(year, month);

  const monthly = getMonthlyTransactions(year, month);
  const container = dom.monthlySummary;
  container.innerHTML = '';

  if (monthly.length === 0) {
    container.innerHTML = '<p class="monthly-empty">No transactions for this month.</p>';
    return;
  }

  const total = monthly.reduce((sum, t) => sum + t.amount, 0);
  const count = monthly.length;
  const avg   = total / count;
  const max   = Math.max(...monthly.map(t => t.amount));

  // Category breakdown
  const catTotals = {};
  monthly.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  const stats = [
    { label: 'Total Spent',    value: formatCurrency(total),   accent: true },
    { label: 'Transactions',   value: count,                    accent: false },
    { label: 'Average',        value: formatCurrency(avg),      accent: false },
    { label: 'Largest',        value: formatCurrency(max),      accent: false },
  ];

  stats.forEach(s => {
    const div = document.createElement('div');
    div.className = 'monthly-stat';
    div.innerHTML = `
      <div class="monthly-stat-label">${s.label}</div>
      <div class="monthly-stat-value${s.accent ? ' accent' : ''}">${s.value}</div>
    `;
    container.appendChild(div);
  });

  // Category rows
  const catDiv = document.createElement('div');
  catDiv.className = 'monthly-stat monthly-cat-breakdown';
  const catRows = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `
      <div class="cat-row">
        <span class="cat-name">${escapeHtml(cat)}</span>
        <span class="cat-amount">${formatCurrency(amt)}</span>
      </div>
    `).join('');

  catDiv.innerHTML = `
    <div class="monthly-stat-label">By Category</div>
    ${catRows}
  `;
  container.appendChild(catDiv);
}

/* =============================================
   FORM VALIDATION & SUBMIT
   ============================================= */
function clearErrors() {
  [dom.itemName, dom.amount, dom.category, dom.customCategory].forEach(el => {
    el.classList.remove('invalid');
  });
  [dom.nameError, dom.amountError, dom.categoryError, dom.customCategoryError].forEach(el => {
    el.classList.remove('visible');
  });
}

function validateForm() {
  let valid = true;
  clearErrors();

  const name   = dom.itemName.value.trim();
  const amount = dom.amount.value.trim();
  const cat    = dom.category.value;
  const custom = dom.customCategory.value.trim();

  if (!name) {
    dom.itemName.classList.add('invalid');
    dom.nameError.classList.add('visible');
    valid = false;
  }

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    dom.amount.classList.add('invalid');
    dom.amountError.classList.add('visible');
    valid = false;
  }

  if (!cat) {
    dom.category.classList.add('invalid');
    dom.categoryError.classList.add('visible');
    valid = false;
  }

  if (cat === 'Custom' && !custom) {
    dom.customCategory.classList.add('invalid');
    dom.customCategoryError.classList.add('visible');
    valid = false;
  }

  return valid;
}

function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  let category = dom.category.value;

  // Handle custom category
  if (category === 'Custom') {
    const customName = dom.customCategory.value.trim();
    // Add to custom list if not already present
    if (!customCategories.includes(customName)) {
      customCategories.push(customName);
      saveCustomCategories();
    }
    category = customName;
  }

  addTransaction(dom.itemName.value, dom.amount.value, category);

  // Reset form
  dom.transactionForm.reset();
  dom.customCategoryGroup.classList.add('hidden');
  clearErrors();

  // Snap monthly summary back to current month so user sees the new entry
  const now = new Date();
  currentMonth = { year: now.getFullYear(), month: now.getMonth() };
  renderMonthlySummary();
}

/* =============================================
   EVENT BINDING
   ============================================= */
function bindEvents() {
  // Theme toggle
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Form submit
  dom.transactionForm.addEventListener('submit', handleFormSubmit);

  // Clear validation styling on input
  dom.itemName.addEventListener('input', () => {
    dom.itemName.classList.remove('invalid');
    dom.nameError.classList.remove('visible');
  });
  dom.amount.addEventListener('input', () => {
    dom.amount.classList.remove('invalid');
    dom.amountError.classList.remove('visible');
  });

  // Show/hide custom category field
  dom.category.addEventListener('change', () => {
    dom.category.classList.remove('invalid');
    dom.categoryError.classList.remove('visible');

    if (dom.category.value === 'Custom') {
      dom.customCategoryGroup.classList.remove('hidden');
      dom.customCategory.focus();
    } else {
      dom.customCategoryGroup.classList.add('hidden');
      dom.customCategory.value = '';
      dom.customCategory.classList.remove('invalid');
      dom.customCategoryError.classList.remove('visible');
    }
  });

  dom.customCategory.addEventListener('input', () => {
    dom.customCategory.classList.remove('invalid');
    dom.customCategoryError.classList.remove('visible');
  });

  // Sort change
  dom.sortSelect.addEventListener('change', renderTransactions);

  // Spending limit
  dom.setLimitBtn.addEventListener('click', () => {
    const val = parseFloat(dom.limitInput.value);
    if (isNaN(val) || val <= 0) {
      dom.limitStatus.textContent = 'Please enter a valid positive number.';
      dom.limitStatus.style.color = 'var(--danger)';
      return;
    }
    spendingLimit = val;
    saveLimit();
    dom.limitStatus.textContent = `Limit set to ${formatCurrency(val)}`;
    dom.limitStatus.style.color = 'var(--success)';
    renderLimitBanner();
    renderTransactions(); // re-render to apply over-limit highlight
  });

  dom.clearLimitBtn.addEventListener('click', () => {
    spendingLimit = null;
    saveLimit();
    dom.limitInput.value = '';
    dom.limitStatus.textContent = 'Spending limit cleared.';
    dom.limitStatus.style.color = 'var(--text-secondary)';
    renderLimitBanner();
    renderTransactions();
  });

  // Monthly navigation
  dom.prevMonth.addEventListener('click', () => {
    currentMonth.month--;
    if (currentMonth.month < 0) {
      currentMonth.month = 11;
      currentMonth.year--;
    }
    renderMonthlySummary();
  });

  dom.nextMonth.addEventListener('click', () => {
    currentMonth.month++;
    if (currentMonth.month > 11) {
      currentMonth.month = 0;
      currentMonth.year++;
    }
    renderMonthlySummary();
  });
}

/* =============================================
   UTILITIES
   ============================================= */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =============================================
   BOOT
   ============================================= */
document.addEventListener('DOMContentLoaded', init);
