/* global supabase */

const config = window.MBFINANCE_CONFIG || {};
const isConfigured = config.supabaseUrl && !config.supabaseUrl.includes('YOUR_') && config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_');
const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
const state = {
  client: null,
  people: [],
  accounts: [],
  balances: [],
  overview: {},
  cashflow: {},
  usages: [],
  bills: [],
  billMonth: '',
  recurringBills: [],
  goals: [],
  entries: [],
  demoEntries: [],
  me: null,
  billPersonFilter: 'all',
  homeBillPersonFilter: 'all',
  historyFilter: { mode: 'all', singleDate: '', fromDate: '', toDate: '' }
};

const categoryLabels = {
  salary: 'Gaji', daily: 'Harian', personal: 'Pribadi', shopee: 'Shopee', application: 'Aplikasi', savings: 'Tabungan', savings_withdrawal: 'Tarik tabungan', transfer: 'Transfer', other: 'Lainnya'
};
const typeLabels = {
  income: 'Pemasukan', expense: 'Pengeluaran', bill: 'Tagihan', transfer: 'Transfer', saving: 'Setor tabungan', saving_withdrawal: 'Tarik tabungan', adjustment: 'Penyesuaian'
};
const $ = (selector) => document.querySelector(selector);
const currentMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const formatMoney = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
// Saldo belum boleh tampak sebagai utang saat dana awal belum dicatat.
const formatBalance = (value) => formatMoney(Math.max(Number(value) || 0, 0));
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const formatMonth = (value) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const formatCalendarMonth = (date) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
const calendarWeekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

document.addEventListener('DOMContentLoaded', init);

async function init() {
  registerServiceWorker();
  if (demoMode) {
    bindStaticEvents();
    openDemo();
    return;
  }
  if (!isConfigured || !window.supabase) {
    $('#setup-screen').hidden = false;
    return;
  }

  state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  bindStaticEvents();
  await openApp();
}

function bindStaticEvents() {
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  $('#history-mode').addEventListener('change', syncHistoryDateFields);
  $('#activity-filter').addEventListener('submit', applyHistoryFilter);
  $('#history-reset').addEventListener('click', resetHistoryFilter);
  $('#bill-person-filter').addEventListener('click', applyBillPersonFilter);
  $('#home-bill-filter').addEventListener('click', applyHomeBillPersonFilter);
  syncHistoryDateFields();
  document.addEventListener('click', handleActionClick);
}

function openDemo() {
  state.people = [
    { id: 1, name: 'Bryan', is_custodian: false, auth_user_id: 'demo-bryan' },
    { id: 2, name: 'Maddy', is_custodian: true, auth_user_id: 'demo-maddy' }
  ];
  state.accounts = [
    { id: 1, name: 'Saldo Utama Maddy', account_type: 'bank', holder_id: 2, is_shared: true, is_active: true },
    { id: 2, name: 'Uang Bryan', account_type: 'cash', holder_id: 1, is_shared: true, is_active: true },
    { id: 3, name: 'Tabungan Bersama', account_type: 'savings', holder_id: 2, is_shared: true, is_active: true }
  ];
  state.balances = [
    { ...state.accounts[0], holder_name: 'Maddy', holder_is_custodian: true, balance: 4000000 },
    { ...state.accounts[1], holder_name: 'Bryan', holder_is_custodian: false, balance: 150000 },
    { ...state.accounts[2], holder_name: 'Maddy', holder_is_custodian: true, balance: 1250000 }
  ];
  state.overview = { total_combined_money: 5400000, total_held_by_maddy: 5250000, total_held_by_bryan: 150000, total_savings: 1250000 };
  state.cashflow = { salary_income: 5000000, total_usage: 486000, daily_usage: 236000, bills_paid: 180000, saving_added: 250000 };
  state.bills = [
    { id: 1, amount_due: 180000, status: 'paid', recurring_bills: { name: 'Netflix & Spotify', bill_category: 'application', due_day: 12, responsible_person_id: 2, default_source_account_id: 1 } },
    { id: 2, amount_due: 325000, status: 'pending', recurring_bills: { name: 'Shopee PayLater', bill_category: 'shopee', due_day: 25, responsible_person_id: 1, default_source_account_id: 1 } },
    { id: 3, amount_due: 95000, status: 'pending', recurring_bills: { name: 'Pulsa Maddy', bill_category: 'personal', due_day: 28, responsible_person_id: 2, default_source_account_id: 1 } }
  ];
  state.goals = [
    { id: 1, name: 'Liburan berdua', target_amount: 5000000, target_date: '2026-12-01', saved_amount: 1250000, progress_percent: 25 },
    { id: 2, name: 'Dana darurat', target_amount: 3000000, target_date: null, saved_amount: 450000, progress_percent: 15 }
  ];
  state.entries = [
    { id: 1, entry_date: today(), entry_type: 'expense', category: 'daily', amount: 35000, from_account_id: 2, to_account_id: null, used_by_person_id: 1, note: 'Makan siang Bryan' },
    { id: 2, entry_date: today(), entry_type: 'transfer', category: 'transfer', amount: 100000, from_account_id: 1, to_account_id: 2, used_by_person_id: null, note: 'Uang kebutuhan Bryan' },
    { id: 3, entry_date: today(), entry_type: 'saving', category: 'savings', amount: 250000, from_account_id: 1, to_account_id: 3, used_by_person_id: null, note: 'Setoran Liburan berdua' },
    { id: 4, entry_date: today(), entry_type: 'bill', category: 'application', amount: 180000, from_account_id: 1, to_account_id: null, used_by_person_id: 2, note: 'Netflix & Spotify' }
  ];
  state.demoEntries = [...state.entries];
  state.me = state.people[1];
  $('#main-app').hidden = false;
  $('#today-label').textContent = 'MODE DEMO';
  $('#month-chip').textContent = formatDate(today());
  renderAll();
}

async function openApp() {
  const authScreen = $('#auth-screen');
  if (authScreen) authScreen.hidden = true;
  $('#setup-screen').hidden = true;
  $('#main-app').hidden = false;
  $('#today-label').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();
  $('#month-chip').textContent = formatDate(today());
  try {
    await loadData();
    renderAll();
  } catch (error) {
    console.error(error);
    const reason = error.message || 'Tidak dapat memuat data.';
    toast(`${reason} Pastikan migration akses tanpa login sudah dijalankan di Supabase.`);
  }
}

async function loadData() {
  const sb = state.client;
  const month = currentMonth();
  const day = today();
  const entriesQuery = buildActivityQuery();
  const [people, accounts, balances, overview, cashflow, usages, recurringBills, goals, entries] = await Promise.all([
    sb.from('people').select('*').order('name'),
    sb.from('accounts').select('*').eq('is_active', true).order('name'),
    sb.from('v_account_balances').select('*').order('name'),
    sb.from('v_shared_overview').select('*').single(),
    sb.from('v_daily_cashflow').select('*').eq('day', day).maybeSingle(),
    sb.from('v_person_monthly_usage').select('*').eq('month', month),
    sb.from('recurring_bills').select('*').eq('is_active', true).order('id'),
    sb.from('v_savings_goal_progress').select('*').eq('is_active', true).order('target_date', { nullsFirst: false }),
    entriesQuery
  ]);
  const all = [people, accounts, balances, overview, cashflow, usages, recurringBills, goals, entries];
  const failed = all.find((result) => result.error);
  if (failed) throw failed.error;

  state.people = people.data || [];
  state.accounts = accounts.data || [];
  state.balances = balances.data || [];
  state.overview = overview.data || {};
  state.cashflow = cashflow.data || {};
  state.usages = usages.data || [];
  state.recurringBills = recurringBills.data || [];
  state.goals = goals.data || [];
  state.entries = entries.data || [];
  if (!state.people.length) throw new Error('Data Bryan & Maddy belum bisa diakses.');
  state.me = state.people.find((person) => person.name === 'Maddy')
    || state.people.find((person) => person.is_custodian)
    || state.people.find((person) => person.name === 'Bryan')
    || state.people[0];

  const { data: bills, error: billsError } = await buildBillsQuery();
  if (billsError) throw billsError;
  state.billMonth = currentMonth();
  state.bills = sortBillsNewestFirst(bills || []);
}

function renderAll() {
  const overview = state.overview;
  $('#greeting').textContent = 'Hallo, Bryan & Maddy!';
  $('#total-combined').textContent = formatBalance(overview.total_combined_money);
  $('#total-held-maddy').textContent = formatBalance(overview.total_held_by_maddy);
  $('#maddy-held').textContent = formatBalance(overview.total_held_by_maddy);
  $('#bryan-held').textContent = formatBalance(overview.total_held_by_bryan || overview.total_held_by_others);
  $('#total-savings').textContent = formatBalance(overview.total_savings);
  $('#total-savings-row').textContent = formatBalance(overview.total_savings);
  $('#monthly-salary').textContent = formatMoney(state.cashflow.salary_income);
  $('#monthly-usage').textContent = formatMoney(state.cashflow.total_usage);
  $('#monthly-daily').textContent = formatMoney(state.cashflow.daily_usage);
  $('#monthly-bills-paid').textContent = formatMoney(state.cashflow.bills_paid);
  $('#monthly-saving-added').textContent = formatMoney(state.cashflow.saving_added);
  renderAccounts(); renderEntries(); renderBillSummaries(); renderBillsView(); renderGoals();
}

function renderAccounts() {
  const balances = new Map(state.balances.map((account) => [String(account.id), account]));
  $('#account-list').innerHTML = state.accounts.length ? state.accounts.map((account) => {
    const balance = balances.get(String(account.id)) || account;
    const holder = balance.holder_name ? `Dipegang ${balance.holder_name}` : 'Pemegang belum diatur';
    return `<article class="account-row"><span class="round-icon account-icon">${accountIcon(account.account_type)}</span><div><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(holder)}</small></div><b>${formatBalance(balance.balance)}</b></article>`;
  }).join('') : emptyState('Belum ada rekening. Tambahkan melalui Supabase terlebih dahulu.');
}

function renderEntries() {
  const personMap = new Map(state.people.map((person) => [String(person.id), person.name]));
  const accountMap = new Map(state.accounts.map((account) => [String(account.id), account.name]));
  $('#activity-list').innerHTML = state.entries.length ? state.entries.map((entry) => {
    const detail = entry.note || entryRoute(entry, accountMap, personMap);
    const sign = entry.entry_type === 'income' ? '+' : entry.entry_type === 'transfer' || entry.entry_type === 'saving' ? '↔' : '−';
    return `<article class="timeline-row"><span class="round-icon entry-icon ${entry.entry_type}">${entryIcon(entry.entry_type)}</span><div><strong>${escapeHtml(typeLabels[entry.entry_type] || entry.entry_type)}</strong><small>${escapeHtml(detail)}</small></div><b>${sign} ${formatMoney(entry.amount)}</b></article>`;
  }).join('') : emptyState('Belum ada transaksi. Catat pemasukan atau pengeluaran pertama kalian.');
  renderActivityDescription();
}

function buildActivityQuery() {
  let query = state.client.from('ledger_entries').select('*');
  const filter = state.historyFilter;
  if (filter.mode === 'single' && filter.singleDate) query = query.eq('entry_date', filter.singleDate);
  if (filter.mode === 'range') {
    if (filter.fromDate) query = query.gte('entry_date', filter.fromDate);
    if (filter.toDate) query = query.lte('entry_date', filter.toDate);
  }
  return query.order('entry_date', { ascending: false }).order('id', { ascending: false }).limit(50);
}

function buildBillsQuery() {
  return state.client
    .from('bill_instances')
    .select('*, recurring_bills(*)')
    .order('bill_month', { ascending: false })
    .order('id', { ascending: false })
    .limit(240);
}

async function ensureUpcomingBillInstances(recurringBills = []) {
  const activeBills = recurringBills.filter((bill) => bill.is_active);
  if (!activeBills.length) return;

  const rows = activeBills.flatMap((bill) => {
    const startMonth = nextBillMonthFor(bill);
    return Array.from({ length: 12 }, (_item, index) => ({
      recurring_bill_id: bill.id,
      bill_month: addMonths(startMonth, index),
      amount_due: Number(bill.default_amount)
    }));
  });

  const { error } = await state.client
    .from('bill_instances')
    .upsert(rows, { onConflict: 'recurring_bill_id,bill_month', ignoreDuplicates: true });
  if (error) throw error;
}

function selectDisplayBills(bills = []) {
  const month = currentMonth();
  const sortedBills = [...bills].sort((a, b) => String(a.bill_month).localeCompare(String(b.bill_month)) || Number(a.id) - Number(b.id));
  const currentBills = sortedBills.filter((bill) => sameMonth(bill.bill_month, month));
  if (currentBills.length) return { billMonth: month, bills: currentBills };

  const firstBill = sortedBills.find((bill) => bill.bill_month >= month);
  const billMonth = firstBill?.bill_month || month;
  return { billMonth, bills: sortedBills.filter((bill) => sameMonth(bill.bill_month, billMonth)) };
}

function sameMonth(value, monthValue) {
  return String(value || '').slice(0, 7) === String(monthValue || '').slice(0, 7);
}

function syncHistoryDateFields() {
  const mode = $('#history-mode').value;
  $('#history-single-field').hidden = mode !== 'single';
  $('#history-range-fields').hidden = mode !== 'range';
  $('#history-filter-message').textContent = '';
  $('#history-filter-message').classList.remove('error');
}

async function applyHistoryFilter(event) {
  event.preventDefault();
  const mode = $('#history-mode').value;
  const singleDate = $('#history-single-date').value;
  const fromDate = $('#history-from-date').value;
  const toDate = $('#history-to-date').value;
  if (mode === 'single' && !singleDate) return historyFilterError('Pilih tanggal yang ingin dilihat.');
  if (mode === 'range' && (!fromDate || !toDate)) return historyFilterError('Pilih tanggal awal dan tanggal akhir.');
  if (mode === 'range' && fromDate > toDate) return historyFilterError('Tanggal awal tidak boleh setelah tanggal akhir.');

  state.historyFilter = { mode, singleDate, fromDate, toDate };
  await reloadActivityEntries();
}

async function resetHistoryFilter() {
  state.historyFilter = { mode: 'all', singleDate: '', fromDate: '', toDate: '' };
  $('#history-mode').value = 'all';
  $('#history-single-date').value = '';
  $('#history-from-date').value = '';
  $('#history-to-date').value = '';
  syncHistoryDateFields();
  await reloadActivityEntries();
}

async function reloadActivityEntries() {
  if (demoMode) {
    state.entries = state.demoEntries.filter((entry) => {
      const filter = state.historyFilter;
      if (filter.mode === 'single') return entry.entry_date === filter.singleDate;
      if (filter.mode === 'range') return entry.entry_date >= filter.fromDate && entry.entry_date <= filter.toDate;
      return true;
    });
    renderEntries();
    return;
  }
  const { data, error } = await buildActivityQuery();
  if (error) return historyFilterError(error.message || 'Riwayat tidak dapat dimuat.');
  state.entries = data || [];
  renderEntries();
}

function renderActivityDescription() {
  const filter = state.historyFilter;
  let description = '50 transaksi terbaru.';
  if (filter.mode === 'single' && filter.singleDate) description = `Catatan pada ${formatDate(filter.singleDate)}.`;
  if (filter.mode === 'range' && filter.fromDate && filter.toDate) description = `Catatan ${formatDate(filter.fromDate)} – ${formatDate(filter.toDate)}.`;
  $('#activity-description').textContent = description;
}

function historyFilterError(message) {
  const target = $('#history-filter-message');
  target.textContent = message;
  target.classList.add('error');
}

function renderBills() {
  const pending = state.bills.filter((bill) => bill.status === 'pending');
  const total = pending.reduce((sum, bill) => sum + Number(bill.amount_due), 0);
  $('#bill-title').textContent = formatMonth(state.billMonth || currentMonth());
  $('#bill-overview').textContent = state.bills.length ? `${pending.length} belum dibayar · Total ${formatMoney(total)}` : 'Belum ada tagihan terdekat.';
  $('#bill-list').innerHTML = state.bills.length ? state.bills.map((bill) => {
    const recurring = bill.recurring_bills || {};
    const tag = recurring.bill_category ? categoryLabels[recurring.bill_category] : 'Tagihan';
    const responsible = personNameById(recurring.responsible_person_id) || 'Bersama';
    const dueDate = billDueDate(bill);
    const action = bill.status === 'pending' ? `<button class="small-button" type="button" data-action="pay-bill" data-id="${bill.id}">Bayar</button>` : '';
    return `<article class="bill-row"><span class="round-icon entry-icon bill">▣</span><div><strong>${escapeHtml(recurring.name || 'Tagihan')}</strong><small>${escapeHtml(tag)} · ${escapeHtml(responsible)} · ${formatDate(dueDate)}</small><span class="status ${bill.status}">${bill.status === 'paid' ? 'Lunas' : bill.status === 'skipped' ? 'Lewati' : 'Belum bayar'}</span></div><b>${formatMoney(bill.amount_due)}</b>${action}</article>`;
  }).join('') : emptyState('Belum ada tagihan terdekat. Tambahkan tagihan baru terlebih dahulu.');
}

function renderBillsView() {
  const bills = billsForSelectedPerson();
  const pending = bills.filter((bill) => bill.status === 'pending');
  const pendingTotal = pending.reduce((sum, bill) => sum + Number(bill.amount_due || 0), 0);
  const person = state.billPersonFilter === 'all' ? null : state.people.find((item) => item.name.toLowerCase() === state.billPersonFilter);
  $('#bill-title').textContent = person ? `Tagihan ${person.name}` : 'Semua tagihan';
  $('#bill-overview').textContent = bills.length
    ? `${bills.length} tagihan · ${pending.length} belum dibayar · Total ${formatMoney(pendingTotal)}`
    : 'Belum ada tagihan.';
  renderBillPersonFilter();
  $('#bill-list').innerHTML = bills.length
    ? billMonthlySummary(bills).map((month) => (
      `<div class="bill-month-heading"><span>${formatMonth(month.month)}</span><b>${formatMoney(month.pendingTotal)}</b></div>${billDueDateSummary(month.bills).map((group) => `<div class="bill-date-heading"><span>${formatDate(group.date)}</span><b>${formatMoney(group.pendingTotal)}</b></div>${group.bills.map(renderBillRow).join('')}`).join('')}`
    )).join('')
    : emptyState('Belum ada tagihan. Tambahkan tagihan baru terlebih dahulu.');
}

function applyBillPersonFilter(event) {
  const button = event.target.closest('[data-bill-person]');
  if (!button) return;
  state.billPersonFilter = button.dataset.billPerson;
  renderBillsView();
}

function renderBillPersonFilter() {
  document.querySelectorAll('[data-bill-person]').forEach((button) => {
    const active = button.dataset.billPerson === state.billPersonFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function billsForSelectedPerson() {
  return billsForPersonFilter(state.billPersonFilter);
}

function applyHomeBillPersonFilter(event) {
  const button = event.target.closest('[data-home-bill-person]');
  if (!button) return;
  const person = button.dataset.homeBillPerson;
  state.homeBillPersonFilter = state.homeBillPersonFilter === person ? 'all' : person;
  renderBillSummaries();
}

function billsForHomeSelectedPerson() {
  return billsForPersonFilter(state.homeBillPersonFilter);
}

function billsForPersonFilter(filter) {
  if (filter === 'all') return state.bills;
  return state.bills.filter((bill) => personNameById(bill.recurring_bills?.responsible_person_id).toLowerCase() === filter);
}

function renderBillRow(bill) {
  const recurring = bill.recurring_bills || {};
  const tag = recurring.bill_category ? categoryLabels[recurring.bill_category] : 'Tagihan';
  const responsible = personNameById(recurring.responsible_person_id) || 'Bersama';
  const dueDate = billDueDate(bill);
  const payAction = bill.status === 'pending' ? `<button class="small-button" type="button" data-action="pay-bill" data-id="${bill.id}">Bayar</button>` : '';
  const amount = bill.status === 'pending'
    ? `<button class="bill-amount-button" type="button" data-action="edit-bill-amount" data-id="${bill.id}" aria-label="Ubah nominal ${escapeHtml(recurring.name || 'tagihan')}">${formatMoney(bill.amount_due)} <span aria-hidden="true">&#9998;</span></button>`
    : `<b>${formatMoney(bill.amount_due)}</b>`;
  return `<article class="bill-row"><span class="round-icon entry-icon bill">▣</span><div><strong>${escapeHtml(recurring.name || 'Tagihan')}</strong><small>${escapeHtml(tag)} · ${escapeHtml(responsible)} · ${formatDate(dueDate)}</small><span class="status ${bill.status}">${bill.status === 'paid' ? 'Lunas' : bill.status === 'skipped' ? 'Lewati' : 'Belum bayar'}</span></div><div class="bill-actions">${amount}<div><button class="danger-button" type="button" data-action="delete-bill" data-id="${bill.id}">Hapus</button>${payAction}</div></div></article>`;
}

function renderBillSummaries() {
  const summary = billSummaryByPerson();
  const bills = billsForHomeSelectedPerson();
  const pendingCount = bills.filter((bill) => bill.status === 'pending').length;
  const person = state.homeBillPersonFilter === 'all' ? null : state.people.find((item) => item.name.toLowerCase() === state.homeBillPersonFilter);
  $('#home-bill-title').textContent = person ? `Tagihan ${person.name}` : 'Tagihan Bryan & Maddy';
  $('#home-bill-period').textContent = `${pendingCount} tagihan belum dibayar`;
  setBillSummary('home-maddy', summary.Maddy);
  setBillSummary('home-bryan', summary.Bryan);
  setBillSummary('page-maddy', summary.Maddy);
  setBillSummary('page-bryan', summary.Bryan);
  renderHomeBillPersonFilter();
  renderMonthlyBillSummary();
}

function renderMonthlyBillSummary() {
  const rows = billMonthlySummary(billsForHomeSelectedPerson()).filter((month) => month.pendingCount > 0);
  $('#home-monthly-bill-list').innerHTML = rows.length ? rows.map((month) => (
    `<article class="monthly-bill-row"><div><strong>${formatMonth(month.month)}</strong><small>${month.pendingCount} tagihan belum dibayar</small></div><b>${formatMoney(month.pendingTotal)}</b></article>`
  )).join('') : emptyState('Belum ada tagihan bulanan.');
}

function renderHomeBillPersonFilter() {
  document.querySelectorAll('[data-home-bill-person]').forEach((button) => {
    const active = button.dataset.homeBillPerson === state.homeBillPersonFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function billMonthlySummary(bills = []) {
  const groups = new Map();
  sortBillsNewestFirst(bills).forEach((bill) => {
    const month = String(bill.bill_month || currentMonth()).slice(0, 10);
    if (!groups.has(month)) groups.set(month, { month, bills: [], count: 0, pendingCount: 0, total: 0, pendingTotal: 0 });
    const group = groups.get(month);
    group.bills.push(bill);
    group.count += 1;
    group.total += Number(bill.amount_due || 0);
    if (bill.status === 'pending') {
      group.pendingCount += 1;
      group.pendingTotal += Number(bill.amount_due || 0);
    }
  });
  return [...groups.values()]
    .map((group) => ({ ...group, bills: sortBillsNewestFirst(group.bills) }))
    .sort((a, b) => sortBillMonthsNearestFirst(a.month, b.month));
}

function sortBillMonthsNearestFirst(a, b) {
  const month = currentMonth();
  const aIsPast = a < month;
  const bIsPast = b < month;
  if (aIsPast !== bIsPast) return Number(aIsPast) - Number(bIsPast);
  return aIsPast ? b.localeCompare(a) : a.localeCompare(b);
}

function billDueDateSummary(bills = []) {
  const groups = new Map();
  sortBillsNewestFirst(bills).forEach((bill) => {
    const date = billDueDate(bill);
    if (!groups.has(date)) groups.set(date, { date, bills: [], count: 0, pendingCount: 0, total: 0, pendingTotal: 0 });
    const group = groups.get(date);
    group.bills.push(bill);
    group.count += 1;
    group.total += Number(bill.amount_due || 0);
    if (bill.status === 'pending') {
      group.pendingCount += 1;
      group.pendingTotal += Number(bill.amount_due || 0);
    }
  });
  return [...groups.values()]
    .map((group) => ({ ...group, bills: sortBillsNewestFirst(group.bills) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sortBillsNewestFirst(bills = []) {
  return [...bills].sort((a, b) => {
    const dateCompare = billDueDate(b).localeCompare(billDueDate(a));
    if (dateCompare) return dateCompare;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function setBillSummary(prefix, summary) {
  $(`#${prefix}-bill-total`).textContent = formatMoney(summary.total);
  $(`#${prefix}-bill-count`).textContent = `${summary.count} tagihan`;
}

function billSummaryByPerson() {
  const summary = {
    Bryan: { total: 0, count: 0 },
    Maddy: { total: 0, count: 0 }
  };

  state.bills
    .filter((bill) => bill.status === 'pending')
    .forEach((bill) => {
      const name = personNameById(bill.recurring_bills?.responsible_person_id);
      if (!summary[name]) return;
      summary[name].total += Number(bill.amount_due || 0);
      summary[name].count += 1;
    });

  return summary;
}

function personNameById(id) {
  return state.people.find((person) => String(person.id) === String(id))?.name || '';
}

function billDueDate(bill) {
  const recurring = bill.recurring_bills || {};
  const [year, month] = String(bill.bill_month || currentMonth()).split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.min(Number(recurring.due_day || 1), daysInMonth);
  return toDateValue(new Date(year, month - 1, day));
}

function renderGoals() {
  $('#goal-list').innerHTML = state.goals.length ? state.goals.map((goal) => {
    const percent = Math.min(Number(goal.progress_percent || 0), 100);
    return `<article class="goal-card"><div class="goal-top"><div><strong>${escapeHtml(goal.name)}</strong><small>${goal.target_date ? `Target ${formatDate(goal.target_date)}` : 'Tanpa batas tanggal'}</small></div><strong>${percent}%</strong></div><div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div><div class="goal-bottom"><span>${formatMoney(goal.saved_amount)} dari ${formatMoney(goal.target_amount)}</span><div class="goal-actions"><button class="outline-button" data-action="withdraw-goal" data-id="${goal.id}" type="button">Tarik</button><button class="small-button" data-action="deposit-goal" data-id="${goal.id}" type="button">Setor</button></div></div></article>`;
  }).join('') : emptyState('Buat target pertama, misalnya Liburan atau Dana Darurat.');
}

function handleActionClick(event) {
  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) return;
  const { action, id } = actionElement.dataset;
  if (action === 'new-income') openEntrySheet('income');
  if (action === 'new-expense') openEntrySheet('expense');
  if (action === 'new-transfer') openEntrySheet('transfer');
  if (action === 'new-saving') openEntrySheet('saving');
  if (action === 'new-bill') openNewBillSheet();
  if (action === 'new-goal') openNewGoalSheet();
  if (action === 'pay-bill') openPayBillSheet(Number(id));
  if (action === 'edit-bill-amount') openEditBillAmountSheet(Number(id));
  if (action === 'delete-bill') deleteBill(Number(id));
  if (action === 'deposit-goal') openGoalDepositSheet(Number(id));
  if (action === 'withdraw-goal') openGoalWithdrawalSheet(Number(id));
}

function setView(view) {
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.dataset.view === view));
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view-target]');
  if (nav) setView(nav.dataset.viewTarget);
});

function moneyField(name, placeholder, value = '') {
  const formattedValue = value === '' || value === null || value === undefined ? '' : formatMoneyInputValue(value);
  return `<input name="${escapeHtml(name)}" type="text" inputmode="numeric" data-money-input required placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(formattedValue)}" />`;
}

function initMoneyInputs(root = document) {
  root.querySelectorAll('[data-money-input]').forEach((input) => {
    if (input.dataset.moneyReady) return;
    input.dataset.moneyReady = '1';
    input.value = formatMoneyInputValue(input.value);
    input.addEventListener('input', handleMoneyInput);
  });
}

function handleMoneyInput(event) {
  const input = event.currentTarget;
  input.value = formatMoneyInputValue(input.value);
  input.setSelectionRange(input.value.length, input.value.length);
}

function formatMoneyInputValue(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('en-US').format(Number(digits)) : '';
}

function parseMoney(value) {
  return Number(String(value || '').replace(/\D/g, ''));
}

function openEntrySheet(type) {
  const labels = { income: 'Catat gaji masuk', expense: 'Catat pengeluaran', transfer: 'Bagi uang gaji', saving: 'Setor tabungan' };
  const sourceAccounts = accountOptions(type === 'income' ? null : defaultSource(type));
  const destinationAccounts = accountOptions(type === 'income' ? defaultDestination(type) : type === 'transfer' || type === 'saving' ? defaultDestination(type) : null);
  const peopleOptions = personOptions(type === 'expense' ? state.me.id : null);
  const categories = type === 'expense' ? ['daily', 'personal', 'shopee', 'application', 'other'] : type === 'transfer' ? ['transfer'] : type === 'saving' ? ['savings'] : ['salary'];
  const accountFields = type === 'income'
    ? `<label>Masuk ke rekening<select name="to_account_id" required>${destinationAccounts}</select></label>`
    : type === 'expense'
      ? `<label>Bayar dari<select name="from_account_id" required>${sourceAccounts}</select></label><label>Dipakai oleh<select name="used_by_person_id" required>${peopleOptions}</select></label>`
      : `<label>Dari rekening<select name="from_account_id" required>${sourceAccounts}</select></label><label>Ke rekening<select name="to_account_id" required>${destinationAccounts}</select></label>`;
  const helper = type === 'income' ? 'Gaji masuk lebih dulu ke rekening utama. Setelah itu gunakan “Bagi gaji” untuk memindahkan bagian Bryan atau tabungan.' : type === 'transfer' ? 'Pilih tujuan: Uang Bryan, Saldo Utama Maddy, atau Tabungan Bersama. Ini tidak mengurangi total uang kalian.' : type === 'saving' ? 'Pilih rekening Tabungan Bersama sebagai tujuan.' : '';
  const categoryField = type === 'income' ? '<input name="category" type="hidden" value="salary" />' : `<label>Kategori<select name="category">${categories.map((category) => `<option value="${category}">${categoryLabels[category]}</option>`).join('')}</select></label>`;
  openSheet(labels[type], 'CATATAN BARU', `<form class="stack-form" id="entry-form" data-entry-type="${type}"><label>Nominal (Rp)${moneyField('amount', 'Contoh: 50,000')}</label><div class="form-row"><label>Tanggal<input name="entry_date" type="date" value="${today()}" required /></label>${categoryField}</div>${accountFields}<label>Catatan (opsional)<textarea name="note" placeholder="${type === 'income' ? 'Contoh: gaji bulan ini' : 'Contoh: makan siang'}"></textarea></label>${helper ? `<p class="helper-text">${helper}</p>` : ''}<button class="primary-button" type="submit">Simpan catatan</button><p class="form-message" role="status"></p></form>`);
  $('#entry-form').addEventListener('submit', saveEntry);
}

async function saveEntry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const amount = parseMoney(values.amount);
  if (!amount) return formError(form, 'Isi nominal terlebih dahulu.');
  const payload = {
    entry_type: form.dataset.entryType,
    category: values.category,
    amount,
    entry_date: values.entry_date,
    from_account_id: values.from_account_id ? Number(values.from_account_id) : null,
    to_account_id: values.to_account_id ? Number(values.to_account_id) : null,
    used_by_person_id: values.used_by_person_id ? Number(values.used_by_person_id) : null,
    note: values.note.trim() || null
  };
  if (payload.from_account_id && payload.from_account_id === payload.to_account_id) return formError(form, 'Rekening asal dan tujuan harus berbeda.');
  await saveWithButton(form, async () => {
    const { error } = await state.client.from('ledger_entries').insert(payload);
    if (error) throw error;
  }, 'Catatan disimpan.');
}

function openNewBillSheet() {
  openSheet('Tambah tagihan berulang', 'TAGIHAN', `<form class="stack-form" id="new-bill-form"><label>Nama tagihan<input name="name" required maxlength="80" placeholder="Contoh: Shopee PayLater" /></label><label>Kategori<select name="bill_category"><option value="personal">Pribadi</option><option value="shopee">Shopee</option><option value="application">Aplikasi</option><option value="other">Lainnya</option></select></label>${calendarField('due_date', 'Jatuh tempo', today())}<div class="form-row"><label>Nominal (Rp)${moneyField('default_amount', 'Contoh: 100,000')}</label><label>Jumlah bulan<input name="repeat_months" type="number" inputmode="numeric" min="1" max="36" value="1" required /></label></div><label>Penanggung<select name="responsible_person_id"><option value="">Bersama</option>${personOptions()}</select></label><label>Bayar dari<select name="default_source_account_id"><option value="">Pilih nanti</option>${accountOptions(defaultSource('expense'))}</select></label><label>Catatan (opsional)<textarea name="note"></textarea></label><button class="primary-button" type="submit">Simpan tagihan</button><p class="form-message" role="status"></p></form>`);
  initCalendarFields($('#new-bill-form'));
  $('#new-bill-form').addEventListener('submit', saveBill);
}

async function saveBill(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  if (!values.due_date) return formError(form, 'Pilih tanggal jatuh tempo.');
  const defaultAmount = parseMoney(values.default_amount);
  if (!defaultAmount) return formError(form, 'Isi nominal tagihan terlebih dahulu.');
  const repeatMonths = Math.max(1, Math.min(Number(values.repeat_months || 1), 36));
  await saveWithButton(form, async () => {
    const { data: recurringBill, error } = await state.client.from('recurring_bills').insert({
      name: values.name.trim(), bill_category: values.bill_category, default_amount: defaultAmount,
      due_day: values.due_date ? Number(values.due_date.slice(-2)) : null,
      is_active: false,
      responsible_person_id: values.responsible_person_id ? Number(values.responsible_person_id) : null,
      default_source_account_id: values.default_source_account_id ? Number(values.default_source_account_id) : null,
      note: values.note.trim() || null
    }).select('id').single();
    if (error) throw error;

    const instances = Array.from({ length: repeatMonths }, (_item, index) => ({
      recurring_bill_id: recurringBill.id,
      bill_month: billMonthValue(values.due_date, index),
      amount_due: defaultAmount
    }));
    const { error: instanceError } = await state.client.from('bill_instances').insert(instances);
    if (instanceError) {
      await state.client.from('recurring_bills').delete().eq('id', recurringBill.id);
      throw instanceError;
    }
  }, repeatMonths > 1 ? `Tagihan dibuat untuk ${repeatMonths} bulan.` : 'Tagihan berulang disimpan.');
}

function calendarField(name, label, value = today()) {
  return `<div class="calendar-field" data-calendar-field><span class="calendar-label">${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="hidden" value="${escapeHtml(value)}" data-calendar-input /><div class="calendar-picker" data-calendar><div class="calendar-top"><button class="calendar-nav" type="button" data-calendar-prev aria-label="Bulan sebelumnya">‹</button><strong data-calendar-title></strong><button class="calendar-nav" type="button" data-calendar-next aria-label="Bulan berikutnya">›</button></div><p class="calendar-selected" data-calendar-selected-text aria-live="polite"></p><div class="calendar-weekdays">${calendarWeekdays.map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar-grid" data-calendar-grid></div></div></div>`;
}

function initCalendarFields(root = document) {
  root.querySelectorAll('[data-calendar]').forEach((calendar) => {
    if (calendar.dataset.ready) return;
    const input = calendar.closest('[data-calendar-field]').querySelector('[data-calendar-input]');
    calendar.dataset.ready = '1';
    calendar.dataset.viewMonth = (input.value || today()).slice(0, 7);
    calendar.addEventListener('click', handleCalendarClick);
    renderCalendar(calendar);
  });
}

function handleCalendarClick(event) {
  const calendar = event.currentTarget;
  if (event.target.closest('[data-calendar-prev]')) return shiftCalendarMonth(calendar, -1);
  if (event.target.closest('[data-calendar-next]')) return shiftCalendarMonth(calendar, 1);
  const dayButton = event.target.closest('[data-calendar-date]');
  if (!dayButton) return;

  const input = calendar.closest('[data-calendar-field]').querySelector('[data-calendar-input]');
  input.value = dayButton.dataset.calendarDate;
  calendar.dataset.viewMonth = input.value.slice(0, 7);
  renderCalendar(calendar);
}

function shiftCalendarMonth(calendar, offset) {
  const [year, month] = calendar.dataset.viewMonth.split('-').map(Number);
  const nextMonth = new Date(year, month - 1 + offset, 1);
  calendar.dataset.viewMonth = toMonthValue(nextMonth);
  renderCalendar(calendar);
}

function renderCalendar(calendar) {
  const input = calendar.closest('[data-calendar-field]').querySelector('[data-calendar-input]');
  const selectedValue = input.value || today();
  const [year, month] = calendar.dataset.viewMonth.split('-').map(Number);
  const monthDate = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = monthDate.getDay();
  const todayValue = today();
  let cells = '';

  for (let index = 0; index < firstWeekday; index += 1) {
    cells += '<span class="calendar-empty" aria-hidden="true"></span>';
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = toDateValue(new Date(year, month - 1, day));
    const classes = ['calendar-day'];
    if (value === selectedValue) classes.push('selected');
    if (value === todayValue) classes.push('today');
    cells += `<button class="${classes.join(' ')}" type="button" data-calendar-date="${value}" aria-pressed="${value === selectedValue}">${day}</button>`;
  }

  calendar.querySelector('[data-calendar-title]').textContent = formatCalendarMonth(monthDate);
  calendar.querySelector('[data-calendar-selected-text]').textContent = formatDate(selectedValue);
  calendar.querySelector('[data-calendar-grid]').innerHTML = cells;
}

function toDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function billMonthValue(dateValue, offset = 0) {
  const [year, month] = dateValue.split('-').map(Number);
  return toDateValue(new Date(year, month - 1 + offset, 1));
}

function addMonths(dateValue, offset = 0) {
  const [year, month] = dateValue.split('-').map(Number);
  return toDateValue(new Date(year, month - 1 + offset, 1));
}

function nextBillMonthFor(bill) {
  const now = new Date(`${today()}T00:00:00`);
  const dueDay = Number(bill.due_day || 1);
  const offset = dueDay < now.getDate() ? 1 : 0;
  return toDateValue(new Date(now.getFullYear(), now.getMonth() + offset, 1));
}

async function generateBills() {
  if (demoMode) return toast('Mode demo: daftar tagihan tidak diubah.');
  const button = $('#generate-bills');
  button.disabled = true;
  try {
    const { data, error } = await state.client.from('recurring_bills').select('*').eq('is_active', true).order('id');
    if (error) throw error;
    await ensureUpcomingBillInstances(data || []);
    toast('Tagihan disinkronkan.');
    await refreshAndRender();
  } catch (error) {
    toast(error.message || 'Tagihan gagal disinkronkan.');
  } finally {
    button.disabled = false;
  }
}

async function deleteBill(billId) {
  const bill = state.bills.find((item) => item.id === billId);
  if (!bill) return;
  const name = bill.recurring_bills?.name || 'tagihan ini';
  if (!window.confirm(`Hapus ${name} dari daftar tagihan?`)) return;

  if (demoMode) return toast('Mode demo: tagihan tidak dihapus.');
  const { error } = await state.client.from('bill_instances').delete().eq('id', billId);
  if (error) return toast(error.message || 'Tagihan gagal dihapus.');
  toast('Tagihan dihapus.');
  await refreshAndRender();
}

function openPayBillSheet(billId) {
  const bill = state.bills.find((item) => item.id === billId);
  if (!bill) return;
  const recurring = bill.recurring_bills || {};
  openSheet(`Bayar ${recurring.name || 'tagihan'}`, 'BAYAR TAGIHAN', `<form class="stack-form" id="pay-bill-form" data-bill-id="${bill.id}"><label>Nominal dibayar (Rp)${moneyField('amount', 'Contoh: 100,000', bill.amount_due)}</label><div class="form-row"><label>Tanggal bayar<input name="paid_on" type="date" value="${today()}" required /></label><label>Dipakai oleh<select name="used_by_person_id">${personOptions(recurring.responsible_person_id)}</select></label></div><label>Bayar dari<select name="from_account_id" required>${accountOptions(recurring.default_source_account_id || defaultSource('expense'))}</select></label><label>Catatan (opsional)<textarea name="note" placeholder="${escapeHtml(recurring.name || '')}"></textarea></label><button class="primary-button" type="submit">Tandai sudah dibayar</button><p class="form-message" role="status"></p></form>`);
  $('#pay-bill-form').addEventListener('submit', saveBillPayment);
}

function openEditBillAmountSheet(billId) {
  const bill = state.bills.find((item) => item.id === billId);
  if (!bill) return;
  if (bill.status !== 'pending') return toast('Nominal tagihan yang sudah dibayar tidak dapat diubah.');

  const name = bill.recurring_bills?.name || 'tagihan';
  openSheet(`Ubah nominal ${name}`, 'EDIT TAGIHAN', `<form class="stack-form" id="edit-bill-amount-form" data-bill-id="${bill.id}"><label>Nominal tagihan (Rp)${moneyField('amount_due', 'Contoh: 100,000', bill.amount_due)}</label><p class="helper-text">Perubahan hanya berlaku untuk tagihan ini.</p><button class="primary-button" type="submit">Simpan nominal</button><p class="form-message" role="status"></p></form>`);
  $('#edit-bill-amount-form').addEventListener('submit', saveBillAmount);
}

async function saveBillAmount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const billId = Number(form.dataset.billId);
  const amountDue = parseMoney(new FormData(form).get('amount_due'));
  if (!amountDue) return formError(form, 'Isi nominal tagihan terlebih dahulu.');

  await saveWithButton(form, async () => {
    const { data, error } = await state.client
      .from('bill_instances')
      .update({ amount_due: amountDue })
      .eq('id', billId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Tagihan sudah dibayar atau tidak ditemukan.');
  }, 'Nominal tagihan diperbarui.');
}

async function saveBillPayment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const bill = state.bills.find((item) => item.id === Number(form.dataset.billId));
  const amount = parseMoney(values.amount);
  if (!amount) return formError(form, 'Isi nominal pembayaran terlebih dahulu.');
  await saveWithButton(form, async () => {
    const { data: entry, error: entryError } = await state.client.from('ledger_entries').insert({
      entry_type: 'bill', category: bill.recurring_bills?.bill_category || 'other', amount,
      entry_date: values.paid_on, from_account_id: Number(values.from_account_id),
      used_by_person_id: values.used_by_person_id ? Number(values.used_by_person_id) : null,
      note: values.note.trim() || bill.recurring_bills?.name || null
    }).select('id').single();
    if (entryError) throw entryError;
    const { error: billError } = await state.client.from('bill_instances').update({ status: 'paid', paid_on: values.paid_on, payment_entry_id: entry.id }).eq('id', bill.id);
    if (billError) {
      await state.client.from('ledger_entries').delete().eq('id', entry.id);
      throw billError;
    }
  }, 'Tagihan ditandai lunas.');
}

function openNewGoalSheet() {
  openSheet('Buat target tabungan', 'TABUNGAN', `<form class="stack-form" id="new-goal-form"><label>Nama target<input name="name" required maxlength="80" placeholder="Contoh: Liburan berdua" /></label><label>Target nominal (Rp)${moneyField('target_amount', 'Contoh: 5,000,000')}</label><label>Target tanggal (opsional)<input name="target_date" type="date" /></label><label>Catatan (opsional)<textarea name="note"></textarea></label><button class="primary-button" type="submit">Buat target</button><p class="form-message" role="status"></p></form>`);
  $('#new-goal-form').addEventListener('submit', saveGoal);
}

async function saveGoal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const targetAmount = parseMoney(values.target_amount);
  if (!targetAmount) return formError(form, 'Isi target nominal terlebih dahulu.');
  await saveWithButton(form, async () => {
    const { error } = await state.client.from('savings_goals').insert({ name: values.name.trim(), target_amount: targetAmount, target_date: values.target_date || null, note: values.note.trim() || null });
    if (error) throw error;
  }, 'Target tabungan dibuat.');
}

function openGoalDepositSheet(goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return;
  openSheet(`Setor ke ${goal.name}`, 'TABUNGAN', `<form class="stack-form" id="goal-deposit-form" data-goal-id="${goal.id}"><label>Nominal setoran (Rp)${moneyField('amount', 'Contoh: 100,000')}</label><label>Dari rekening<select name="from_account_id" required>${accountOptions(defaultSource('saving'))}</select></label><label>Kontributor<select name="contributed_by_person_id">${personOptions(state.me.id)}</select></label><label>Tanggal<input name="entry_date" type="date" value="${today()}" required /></label><button class="primary-button" type="submit">Simpan setoran</button><p class="form-message" role="status"></p></form>`);
  $('#goal-deposit-form').addEventListener('submit', saveGoalDeposit);
}

async function saveGoalDeposit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const goal = state.goals.find((item) => item.id === Number(form.dataset.goalId));
  const savingsAccount = state.accounts.find((account) => account.account_type === 'savings');
  const amount = parseMoney(values.amount);
  if (!savingsAccount) return formError(form, 'Buat rekening dengan tipe savings terlebih dahulu.');
  if (!amount) return formError(form, 'Isi nominal setoran terlebih dahulu.');
  await saveWithButton(form, async () => {
    const { data: entry, error: entryError } = await state.client.from('ledger_entries').insert({
      entry_type: 'saving', category: 'savings', amount, entry_date: values.entry_date,
      from_account_id: Number(values.from_account_id), to_account_id: savingsAccount.id,
      note: `Setoran: ${goal.name}`
    }).select('id').single();
    if (entryError) throw entryError;
    const { error: contributionError } = await state.client.from('savings_contributions').insert({
      goal_id: goal.id, ledger_entry_id: entry.id, contributed_by_person_id: values.contributed_by_person_id ? Number(values.contributed_by_person_id) : null, amount
    });
    if (contributionError) {
      await state.client.from('ledger_entries').delete().eq('id', entry.id);
      throw contributionError;
    }
  }, 'Setoran tabungan disimpan.');
}

function openGoalWithdrawalSheet(goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return;
  const savingsAccount = state.accounts.find((account) => account.account_type === 'savings');
  if (!savingsAccount) return toast('Rekening tabungan belum tersedia.');
  openSheet(`Tarik dari ${goal.name}`, 'TARIK TABUNGAN', `<form class="stack-form" id="goal-withdrawal-form" data-goal-id="${goal.id}"><label>Nominal ditarik (Rp)${moneyField('amount', `Maks. ${formatMoneyInputValue(goal.saved_amount)}`)}</label><p class="helper-text">Tersimpan pada target ini: ${formatMoney(goal.saved_amount)}. Progres target akan berkurang sesuai nominal penarikan.</p><label>Masuk ke rekening<select name="to_account_id" required>${accountOptions(defaultSource('saving'))}</select></label><label>Tanggal<input name="entry_date" type="date" value="${today()}" required /></label><label>Catatan (opsional)<textarea name="note" placeholder="Contoh: kebutuhan mendesak"></textarea></label><button class="primary-button" type="submit">Tarik tabungan</button><p class="form-message" role="status"></p></form>`);
  $('#goal-withdrawal-form').addEventListener('submit', saveGoalWithdrawal);
}

async function saveGoalWithdrawal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const goal = state.goals.find((item) => item.id === Number(form.dataset.goalId));
  const savingsAccount = state.accounts.find((account) => account.account_type === 'savings');
  const amount = parseMoney(values.amount);
  if (!amount) return formError(form, 'Isi nominal penarikan terlebih dahulu.');
  if (amount > Number(goal.saved_amount)) return formError(form, 'Nominal tidak boleh lebih besar dari saldo target.');
  if (String(savingsAccount.id) === values.to_account_id) return formError(form, 'Pilih rekening tujuan selain rekening tabungan.');
  await saveWithButton(form, async () => {
    const { data: entry, error: entryError } = await state.client.from('ledger_entries').insert({
      entry_type: 'saving_withdrawal', category: 'savings_withdrawal', amount, entry_date: values.entry_date,
      from_account_id: savingsAccount.id, to_account_id: Number(values.to_account_id),
      note: values.note.trim() || `Tarik dari: ${goal.name}`
    }).select('id').single();
    if (entryError) throw entryError;
    const { error: withdrawalError } = await state.client.from('savings_withdrawals').insert({
      goal_id: goal.id, ledger_entry_id: entry.id, amount
    });
    if (withdrawalError) {
      await state.client.from('ledger_entries').delete().eq('id', entry.id);
      throw withdrawalError;
    }
  }, 'Penarikan tabungan disimpan.');
}

async function saveWithButton(form, save, successMessage) {
  if (demoMode) return formError(form, 'Mode demo tidak menyimpan perubahan. Hubungkan Supabase untuk mulai mencatat.');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  formError(form, '');
  try {
    await save();
    closeSheet();
    toast(successMessage);
    await refreshAndRender();
  } catch (error) {
    console.error(error);
    formError(form, error.message || 'Gagal menyimpan. Coba lagi.');
  } finally {
    button.disabled = false;
  }
}

async function refreshAndRender() {
  try { await loadData(); renderAll(); } catch (error) { toast(error.message || 'Data belum dapat dimuat.'); }
}

function openSheet(title, kicker, content) {
  $('#sheet-title').textContent = title;
  $('#sheet-kicker').textContent = kicker;
  $('#sheet-content').innerHTML = content;
  initMoneyInputs($('#sheet-content'));
  $('#sheet-backdrop').hidden = false;
  $('#bottom-sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet-backdrop').hidden = true;
  $('#bottom-sheet').hidden = true;
  document.body.style.overflow = '';
}
function formError(form, message) {
  const target = form.querySelector('.form-message');
  target.textContent = message;
  target.classList.toggle('error', Boolean(message));
}
function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => box.classList.remove('show'), 3600);
}

function defaultSource(type) {
  if (type === 'transfer' || type === 'saving') return state.accounts.find((account) => account.name === 'Saldo Utama Maddy')?.id || state.accounts[0]?.id;
  return state.accounts.find((account) => account.name === 'Saldo Utama Maddy')?.id || state.accounts[0]?.id;
}
function defaultDestination(type) {
  if (type === 'transfer') return state.accounts.find((account) => account.name === 'Uang Bryan')?.id || state.accounts[0]?.id;
  if (type === 'saving') return state.accounts.find((account) => account.account_type === 'savings')?.id || state.accounts[0]?.id;
  return defaultSource(type);
}
function accountOptions(selectedId) {
  return state.accounts.map((account) => `<option value="${account.id}" ${String(account.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(account.name)}</option>`).join('');
}
function personOptions(selectedId) {
  return state.people.map((person) => `<option value="${person.id}" ${String(person.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('');
}
function entryRoute(entry, accountMap, personMap) {
  const from = accountMap.get(String(entry.from_account_id));
  const to = accountMap.get(String(entry.to_account_id));
  const who = personMap.get(String(entry.used_by_person_id));
  if (from && to) return `${from} → ${to}`;
  if (who) return `${categoryLabels[entry.category] || 'Lainnya'} · ${who}`;
  return from ? `Dari ${from}` : to ? `Ke ${to}` : categoryLabels[entry.category] || 'Lainnya';
}
function entryIcon(type) { return ({ income: '＋', expense: '−', bill: '▣', transfer: '⇄', saving: '⌁', saving_withdrawal: '↙', adjustment: '≈' }[type] || '•'); }
function accountIcon(type) { return ({ cash: '¤', bank: '▤', e_wallet: '◉', savings: '⌁', other: '◌' }[type] || '◌'); }
function emptyState(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }
function registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {}); }
