/* ============================================
   CalendarGas - App Logic
   Expense, Income & Cards Calendar Application
   ============================================ */

(function () {
    'use strict';

    // ========== Firebase Configuration ==========
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyATE8J6cUvz2xoO-nsHUCa9Jx_txn9XKQA",
        authDomain: "calendargas-86709.firebaseapp.com",
        databaseURL: "https://calendargas-86709-default-rtdb.firebaseio.com",
        projectId: "calendargas-86709",
        storageBucket: "calendargas-86709.firebasestorage.app",
        messagingSenderId: "308072440729",
        appId: "1:308072440729:web:781f3f66d4925213e6a908"
    };

    // Sync state
    let firebaseApp = null;
    let firebaseDb = null;
    let syncRef = null;
    let syncListener = null;
    let isSyncing = false; // Prevents infinite sync loops

    // ========== Currency Symbols ==========
    const CURRENCY_SYMBOLS = {
        USD: '$', MXN: '$', EUR: '€', COP: '$', ARS: '$',
        BRL: 'R$', CLP: '$', PEN: 'S/', GBP: '£', RON: 'lei'
    };

    // ========== State ==========
    const state = {
        currentYear: 2026,
        currentMonth: 1,
        selectedDate: null,
        entries: {},
        budgets: {},
        availability: {},

        cardBudgets: {}, // { "cardId_YYYY-MM": budget } - monthly card budgets
        cards: [], // [{ id, name, type:'credit'|'debit', currency, balance, color }]
    };

    const today = new Date();
    state.currentYear = today.getFullYear();
    state.currentMonth = today.getMonth();

    // ========== Month Names ==========
    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // ========== Category Colors ==========
    const CATEGORY_COLORS = {
        '🏠 Hogar': '#6366f1', '🍔 Alimentación': '#f59e0b', '🚗 Transporte': '#3b82f6',
        '💡 Servicios': '#22c55e', '🎉 Entretenimiento': '#ec4899', '🏥 Salud': '#ef4444',
        '📚 Educación': '#8b5cf6', '👕 Ropa': '#14b8a6', '💼 Trabajo': '#f97316',
        '📱 Tecnología': '#06b6d4', '🎁 Regalos': '#a855f7', '📦 Otros': '#64748b',
        '💵 Salario': '#22c55e', '🏦 Freelance': '#10b981', '📊 Inversiones': '#059669',
        '🎯 Ventas': '#14b8a6', '🔄 Transferencia': '#06b6d4', '💸 Otro ingreso': '#34d399',
    };

    const INCOME_CATEGORIES = [
        '💵 Salario', '🏦 Freelance', '📊 Inversiones',
        '🎯 Ventas', '🔄 Transferencia', '💸 Otro ingreso'
    ];

    const EXPENSE_CATEGORIES = [
        '🏠 Hogar', '🍔 Alimentación', '🚗 Transporte', '💡 Servicios',
        '🎉 Entretenimiento', '🏥 Salud', '📚 Educación', '👕 Ropa',
        '💼 Trabajo', '📱 Tecnología', '🎁 Regalos', '📦 Otros'
    ];

    // ========== DOM Elements ==========
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elements = {
        calendarGrid: $('#calendarGrid'),
        currentMonthLabel: $('#currentMonthLabel'),
        prevMonth: $('#prevMonth'),
        nextMonth: $('#nextMonth'),
        btnToday: $('#btnToday'),
        totalMonth: $('#totalMonth'),
        totalIncome: $('#totalIncome'),
        balanceValue: $('#balanceValue'),
        balanceCard: $('#balanceCard'),
        budgetInput: $('#budgetInput'),
        budgetBarContainer: $('#budgetBarContainer'),
        budgetBarFill: $('#budgetBarFill'),
        budgetPercent: $('#budgetPercent'),
        sidebarCashContainer: $('#sidebarCashContainer'),
        availabilityHint: $('#availabilityHint'),
        availabilityRemaining: $('#availabilityRemaining'),
        availabilityBarFill: $('#availabilityBarFill'),
        remainingValue: $('#remainingValue'),
        availabilityStatus: $('#availabilityStatus'),
        categoryBreakdown: $('#categoryBreakdown'),
        // Transaction modal
        modalOverlay: $('#modalOverlay'),
        modalTitle: $('#modalTitle'),
        modalClose: $('#modalClose'),
        dayExpensesList: $('#dayExpensesList'),
        expenseForm: $('#expenseForm'),
        expenseDescription: $('#expenseDescription'),
        expenseAmount: $('#expenseAmount'),
        expenseCategory: $('#expenseCategory'),
        categoryLabel: $('#categoryLabel'),
        transactionType: $('#transactionType'),
        btnTypeExpense: $('#btnTypeExpense'),
        btnTypeIncome: $('#btnTypeIncome'),
        incomeTargetRow: $('#incomeTargetRow'),
        incomeTargetMonth: $('#incomeTargetMonth'),
        cardSelectRow: $('#cardSelectRow'),
        cardSelectLabel: $('#cardSelectLabel'),
        cardSelectDefault: $('#cardSelectDefault'),
        cashCurrencyGroup: $('#cashCurrencyGroup'),
        cashCurrencySelect: $('#cashCurrencySelect'),
        pendingRow: $('#pendingRow'),
        expensePending: $('#expensePending'),
        expenseCard: $('#expenseCard'),
        btnAddLabel: $('#btnAddLabel'),
        btnAddExpense: $('#btnAddExpense'),
        // Cards
        cardsList: $('#cardsList'),
        btnOpenCardModal: $('#btnOpenCardModal'),
        cardModalOverlay: $('#cardModalOverlay'),
        cardModalTitle: $('#cardModalTitle'),
        cardModalClose: $('#cardModalClose'),
        cardForm: $('#cardForm'),
        cardName: $('#cardName'),
        cardType: $('#cardType'),
        cardCurrency: $('#cardCurrency'),
        cardBalance: $('#cardBalance'),
        cardBudget: $('#cardBudget'),
        cardBalanceLabel: $('#cardBalanceLabel'),
        cardColor: $('#cardColor'),
        cardEditId: $('#cardEditId'),
        btnSaveCardLabel: $('#btnSaveCardLabel'),
        // Report
        btnOpenReport: $('#btnOpenReport'),
        reportModalOverlay: $('#reportModalOverlay'),
        reportModalClose: $('#reportModalClose'),
        reportForm: $('#reportForm'),
        reportDateFrom: $('#reportDateFrom'),
        reportDateTo: $('#reportDateTo'),
        reportIncSummary: $('#reportIncSummary'),
        reportIncCards: $('#reportIncCards'),
        reportIncCategories: $('#reportIncCategories'),
        reportIncDetails: $('#reportIncDetails'),
        // Other
        btnExport: $('#btnExport'),
        sidebar: $('#sidebar'),
        menuToggle: $('#menuToggle'),
        toast: $('#toast'),
        toastMessage: $('#toastMessage'),
    };

    // ========== Data Persistence ==========
    function saveData() {
        try {
            localStorage.setItem('calendargas_entries', JSON.stringify(state.entries));
            localStorage.setItem('calendargas_budgets', JSON.stringify(state.budgets));
            localStorage.setItem('calendargas_availability', JSON.stringify(state.availability));
            localStorage.setItem('calendargas_cards', JSON.stringify(state.cards));

            localStorage.setItem('calendargas_cardBudgets', JSON.stringify(state.cardBudgets));
        } catch (e) {
            console.warn('Error saving local data:', e);
        }
        // Push to Firebase if connected
        if (syncRef && !isSyncing) {
            syncRef.set({
                entries: state.entries,
                budgets: state.budgets,
                availability: state.availability,
                cards: state.cards,

                cardBudgets: state.cardBudgets,
                lastUpdated: Date.now()
            }).catch(err => console.warn('Firebase write error:', err));
        }
    }

    function loadData() {
        try {
            const entries = localStorage.getItem('calendargas_entries');
            const budgets = localStorage.getItem('calendargas_budgets');
            const availability = localStorage.getItem('calendargas_availability');
            const cards = localStorage.getItem('calendargas_cards');
            const oldExpenses = localStorage.getItem('calendargas_expenses');

            if (entries) {
                state.entries = JSON.parse(entries);
            } else if (oldExpenses) {
                const old = JSON.parse(oldExpenses);
                for (const key in old) {
                    old[key] = old[key].map(e => ({ ...e, type: e.type || 'expense' }));
                }
                state.entries = old;
                saveData();
                localStorage.removeItem('calendargas_expenses');
            }

            if (budgets) state.budgets = JSON.parse(budgets);
            if (availability) {
                const parsedAvails = JSON.parse(availability);
                state.availability = {};
                for (const key in parsedAvails) {
                    if (key.includes('_')) {
                        state.availability[key] = parsedAvails[key];
                    } else if (typeof parsedAvails[key] === 'number') {
                        state.availability[key + '_USD'] = parsedAvails[key];
                    }
                }
            }
            if (cards) {
                const parsedCards = JSON.parse(cards);
                // Migrate old budget to monthly budget if needed or just strip it
                parsedCards.forEach(c => delete c.budget);
                state.cards = parsedCards;
            }

            const cardBdg = localStorage.getItem('calendargas_cardBudgets');
            if (cardBdg) state.cardBudgets = JSON.parse(cardBdg);
        } catch (e) {
            console.warn('Error loading data:', e);
        }

        // Check for saved sync code and auto-connect
        const savedCode = localStorage.getItem('calendargas_syncCode');
        if (savedCode) {
            initFirebase(savedCode);
        }
    }

    // ========== Firebase Sync ==========
    function initFirebase(syncCode) {
        if (FIREBASE_CONFIG.apiKey === 'TU_API_KEY') {
            console.warn('Firebase not configured. Skipping sync.');
            return;
        }

        try {
            updateSyncUI('connecting');

            if (!firebaseApp) {
                firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
                firebaseDb = firebase.database();
            }

            // Detach previous listener
            if (syncRef && syncListener) {
                syncRef.off('value', syncListener);
            }

            const safeCode = syncCode.replace(/[.#$\[\]]/g, '-');
            syncRef = firebaseDb.ref('calendargas/' + safeCode);

            let isFirstSync = true;

            // Listen for remote changes
            syncListener = syncRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (!data) {
                    // No remote data - push all local data to Firebase
                    isFirstSync = false;
                    saveData();
                    updateSyncUI('connected');
                    return;
                }

                if (isFirstSync) {
                    // First sync: MERGE local + remote (local data takes priority for conflicts)
                    isFirstSync = false;
                    isSyncing = true;

                    // Merge entries: combine all date keys, merge entries per day
                    const mergedEntries = { ...data.entries };
                    for (const key in state.entries) {
                        if (!mergedEntries[key]) {
                            mergedEntries[key] = state.entries[key];
                        } else {
                            // Merge entries for the same day (avoid duplicates by ID)
                            const existingIds = new Set(mergedEntries[key].map(e => e.id));
                            state.entries[key].forEach(e => {
                                if (!existingIds.has(e.id)) {
                                    mergedEntries[key].push(e);
                                }
                            });
                        }
                    }
                    state.entries = mergedEntries;

                    // Merge cards (keep both, avoid duplicate IDs)
                    if (data.cards && data.cards.length > 0) {
                        const localIds = new Set(state.cards.map(c => c.id));
                        data.cards.forEach(c => {
                            if (!localIds.has(c.id)) state.cards.push(c);
                        });
                    }

                    // Merge availability & budgets (local overrides if set)
                    if (data.availability) {
                        state.availability = { ...data.availability, ...state.availability };
                    }
                    if (data.budgets) {
                        state.budgets = { ...data.budgets, ...state.budgets };
                    }

                    if (data.cardBudgets) {
                        state.cardBudgets = { ...data.cardBudgets, ...state.cardBudgets };
                    }

                    isSyncing = false;
                    saveData(); // Push merged data to both localStorage and Firebase
                    renderCalendar();
                    if (state.selectedDate) renderDayEntries();
                    updateSyncUI('connected');
                    return;
                }

                // Merge remote data into local state
                isSyncing = true;
                if (data.entries) state.entries = data.entries;
                if (data.budgets) state.budgets = data.budgets;
                if (data.availability) state.availability = data.availability;
                if (data.cards) state.cards = data.cards;

                if (data.cardBudgets) state.cardBudgets = data.cardBudgets;

                // Save to localStorage as cache
                try {
                    localStorage.setItem('calendargas_entries', JSON.stringify(state.entries));
                    localStorage.setItem('calendargas_budgets', JSON.stringify(state.budgets));
                    localStorage.setItem('calendargas_availability', JSON.stringify(state.availability));
                    localStorage.setItem('calendargas_cards', JSON.stringify(state.cards));

                    localStorage.setItem('calendargas_cardBudgets', JSON.stringify(state.cardBudgets));
                } catch (e) { }

                // Re-render everything
                renderCalendar();
                if (state.selectedDate) renderDayEntries();

                isSyncing = false;
                updateSyncUI('connected');
            }, (error) => {
                console.error('Firebase sync error:', error);
                updateSyncUI('error');
            });

            localStorage.setItem('calendargas_syncCode', syncCode);
            showToast('🔄 Sincronización activada');

        } catch (err) {
            console.error('Firebase init error:', err);
            updateSyncUI('error');
        }
    }

    function disconnectSync() {
        if (syncRef && syncListener) {
            syncRef.off('value', syncListener);
        }
        syncRef = null;
        syncListener = null;
        localStorage.removeItem('calendargas_syncCode');
        updateSyncUI('disconnected');
        showToast('🔌 Sincronización desconectada');
    }

    function updateSyncUI(status) {
        const dot = document.getElementById('syncDot');
        const label = document.getElementById('syncLabel');
        if (!dot || !label) return;

        dot.className = 'sync-dot';
        switch (status) {
            case 'connected':
                dot.classList.add('connected');
                label.textContent = 'Sincronizado';
                break;
            case 'connecting':
                dot.classList.add('connecting');
                label.textContent = 'Conectando...';
                break;
            case 'error':
                dot.classList.add('error');
                label.textContent = 'Error';
                break;
            default:
                label.textContent = 'Local';
                break;
        }
    }

    function openSyncModal() {
        const overlay = document.getElementById('syncModalOverlay');
        const form = document.getElementById('syncForm');
        const status = document.getElementById('syncStatus');
        const code = document.getElementById('syncCode');
        const currentCode = document.getElementById('syncCurrentCode');
        const savedCode = localStorage.getItem('calendargas_syncCode');

        if (savedCode && syncRef) {
            form.style.display = 'none';
            status.style.display = 'block';
            currentCode.textContent = 'Código: ' + savedCode;
        } else {
            form.style.display = 'block';
            status.style.display = 'none';
            code.value = savedCode || '';
        }

        overlay.classList.add('active');
    }

    function closeSyncModal() {
        document.getElementById('syncModalOverlay').classList.remove('active');
    }

    // ========== Utility ==========
    function formatAmount(amount, currency) {
        const sym = CURRENCY_SYMBOLS[currency] || '$';
        const sign = amount < 0 ? '-' : '';
        return sign + sym + Math.abs(amount).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatCurrency(amount) {
        return formatAmount(amount, 'USD');
    }

    function dateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function monthKey(year, month) {
        return `${year}-${String(month + 1).padStart(2, '0')}`;
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function showToast(message) {
        elements.toastMessage.textContent = message;
        elements.toast.classList.add('show');
        setTimeout(() => elements.toast.classList.remove('show'), 2500);
    }

    // ========== Data Helpers ==========
    function getEntriesForDay(year, month, day) {
        return state.entries[dateKey(year, month, day)] || [];
    }

    function getExpensesForDay(year, month, day, includePending) {
        return getEntriesForDay(year, month, day).filter(e => e.type === 'expense' && (includePending || !e.pending));
    }

    function getIncomeForDay(year, month, day) {
        return getEntriesForDay(year, month, day).filter(e => e.type === 'income');
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    function isToday(year, month, day) {
        const t = new Date();
        return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
    }

    function getMonthExpenseTotal(year, month) {
        const days = getDaysInMonth(year, month);
        let total = 0;
        for (let d = 1; d <= days; d++) {
            total += getExpensesForDay(year, month, d, false).reduce((s, e) => s + e.amount, 0);
        }
        return total;
    }

    function getMonthPendingTotal(year, month) {
        const days = getDaysInMonth(year, month);
        let total = 0;
        for (let d = 1; d <= days; d++) {
            const entries = getEntriesForDay(year, month, d).filter(e => e.type === 'expense' && e.pending);
            total += entries.reduce((s, e) => s + e.amount, 0);
        }
        return total;
    }

    function getMonthIncomeTotal(year, month) {
        const days = getDaysInMonth(year, month);
        let total = 0;
        for (let d = 1; d <= days; d++) {
            total += getIncomeForDay(year, month, d).reduce((s, e) => s + e.amount, 0);
        }
        return total;
    }

    function getIncomeForTargetMonth(targetMKey) {
        let total = 0;
        for (const key in state.entries) {
            state.entries[key].forEach(e => {
                if (e.type === 'income') {
                    const target = e.targetMonth || key.substring(0, 7);
                    if (target === targetMKey) total += e.amount;
                }
            });
        }
        return total;
    }

    function getMonthExpensesByCategory(year, month) {
        const days = getDaysInMonth(year, month);
        const categories = {};
        for (let d = 1; d <= days; d++) {
            getExpensesForDay(year, month, d).forEach(e => {
                if (!categories[e.category]) categories[e.category] = 0;
                categories[e.category] += e.amount;
            });
        }
        return categories;
    }

    // ========== Card Helpers ==========
    function getCardById(cardId) {
        return state.cards.find(c => c.id === cardId);
    }

    function getCardSpent(cardId) {
        // Total spent across ALL confirmed entries linked to this card
        let total = 0;
        for (const key in state.entries) {
            state.entries[key].forEach(e => {
                if (e.type === 'expense' && e.cardId === cardId && !e.pending) {
                    total += e.amount;
                }
            });
        }
        return total;
    }

    function getCardDeposits(cardId) {
        // Total income deposited into this card
        let total = 0;
        for (const key in state.entries) {
            state.entries[key].forEach(e => {
                if (e.type === 'income' && e.cardId === cardId) {
                    total += e.amount;
                }
            });
        }
        return total;
    }

    function getCardAvailable(card) {
        const spent = getCardSpent(card.id);
        const deposits = getCardDeposits(card.id);
        return card.balance - spent + deposits;
    }

    // ========== Calendar Rendering ==========
    function renderCalendar() {
        const { currentYear, currentMonth } = state;
        const daysInMonth = getDaysInMonth(currentYear, currentMonth);
        const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

        elements.currentMonthLabel.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
        elements.calendarGrid.innerHTML = '';

        for (let i = 0; i < firstDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day empty';
            elements.calendarGrid.appendChild(emptyDiv);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            const dayEntries = getEntriesForDay(currentYear, currentMonth, day);
            const dayExpensesConfirmed = dayEntries.filter(e => e.type === 'expense' && !e.pending);
            const dayExpensesPending = dayEntries.filter(e => e.type === 'expense' && e.pending);
            const dayExpensesAll = dayEntries.filter(e => e.type === 'expense');
            const dayIncome = dayEntries.filter(e => e.type === 'income');
            const todayClass = isToday(currentYear, currentMonth, day) ? ' today' : '';
            const hasExpenses = dayExpensesConfirmed.length > 0 ? ' has-expenses' : '';
            const hasIncome = dayIncome.length > 0 ? ' has-income' : '';
            const hasPending = dayExpensesPending.length > 0 ? ' has-pending' : '';

            dayDiv.className = `calendar-day${todayClass}${hasExpenses}${hasIncome}${hasPending}`;
            dayDiv.dataset.day = day;

            let html = `<span class="day-number">${day}</span>`;

            if (dayEntries.length > 0) {
                html += `<div class="day-expense-dots">`;
                const dotsCount = Math.min(dayEntries.length, 6);
                for (let i = 0; i < dotsCount; i++) {
                    const entry = dayEntries[i];
                    const isPending = entry.pending;
                    const color = entry.type === 'income' ? '#22c55e' : (CATEGORY_COLORS[entry.category] || '#6366f1');
                    const pendingClass = isPending ? ' pending-dot' : '';
                    html += `<span class="expense-dot${pendingClass}" style="background:${isPending ? 'transparent' : color}"></span>`;
                }
                html += `</div>`;

                if (dayEntries.length === 1) {
                    const desc = dayEntries[0].pending ? `🕐 ${dayEntries[0].description}` : dayEntries[0].description;
                    html += `<span class="day-expense-preview">${desc}</span>`;
                } else {
                    const parts = [];
                    if (dayExpensesConfirmed.length > 0) parts.push(`${dayExpensesConfirmed.length} gasto${dayExpensesConfirmed.length > 1 ? 's' : ''}`);
                    if (dayExpensesPending.length > 0) parts.push(`${dayExpensesPending.length} pend.`);
                    if (dayIncome.length > 0) parts.push(`${dayIncome.length} ingreso${dayIncome.length > 1 ? 's' : ''}`);
                    html += `<span class="day-expense-preview">${parts.join(', ')}</span>`;
                }

                const getTotals = (arr) => {
                    const sums = {};
                    arr.forEach(e => {
                        const c = e.cardId ? getCardById(e.cardId)?.currency || 'USD' : (e.currency || 'USD');
                        if (!sums[c]) sums[c] = 0;
                        sums[c] += e.amount;
                    });
                    return sums;
                };

                const dayIncomesByCurr = getTotals(dayIncome);
                const dayExpensesByCurr = getTotals(dayExpensesConfirmed);
                const dayPendingByCurr = getTotals(dayExpensesPending);

                for (const c in dayIncomesByCurr) {
                    html += `<span class="day-income-total">+${formatAmount(dayIncomesByCurr[c], c)}</span>`;
                }
                for (const c in dayExpensesByCurr) {
                    html += `<span class="day-total">-${formatAmount(dayExpensesByCurr[c], c)}</span>`;
                }
                for (const c in dayPendingByCurr) {
                    html += `<span class="day-pending-total">🕐 -${formatAmount(dayPendingByCurr[c], c)}</span>`;
                }
            }

            dayDiv.innerHTML = html;
            dayDiv.addEventListener('click', () => openModal(day));
            elements.calendarGrid.appendChild(dayDiv);
        }

        updateSidebar();
    }

    // ========== Sidebar Update ==========
    function updateSidebar() {
        const { currentYear, currentMonth } = state;
        const expenseTotal = getMonthExpenseTotal(currentYear, currentMonth);
        const incomeTotal = getMonthIncomeTotal(currentYear, currentMonth);
        const mKey = monthKey(currentYear, currentMonth);
        const budget = state.budgets[mKey] || 0;
        const incomeForThisMonth = getIncomeForTargetMonth(mKey);

        // Calculate card contributions (user-chosen amounts, grouped by currency)
        const cardBreakdownEl = document.getElementById('availabilityCardsBreakdown');
        if (state.cards.length > 0) {
            // Group cards by currency
            const groups = {};
            state.cards.forEach(card => {
                if (!groups[card.currency]) groups[card.currency] = [];
                const spent = getCardSpent(card.id);
                const deposits = getCardDeposits(card.id);
                const maxAvailable = card.balance - spent + deposits;
                const chosen = state.cardBudgets[card.id + '_' + mKey] !== undefined ? state.cardBudgets[card.id + '_' + mKey] : 0;
                groups[card.currency].push({ ...card, maxAvailable, chosen });
            });

            let cardsHTML = '<div class="avail-cards-list">';
            for (const currency of Object.keys(groups)) {
                const sym = CURRENCY_SYMBOLS[currency] || '$';
                const groupCards = groups[currency];
                const groupTotal = groupCards.reduce((s, c) => s + c.chosen, 0);
                cardsHTML += `<div class="avail-currency-group">
                    <span class="avail-currency-label">${currency} (${sym})</span>`;
                groupCards.forEach(card => {
                    cardsHTML += `
                    <div class="avail-card-row">
                        <span class="avail-card-dot" style="background:${card.color};"></span>
                        <span class="avail-card-name">${card.name}</span>
                        <div class="avail-card-input-wrap">
                            <input type="number" class="avail-card-input" data-card-id="${card.id}" 
                                value="${card.chosen || ''}" placeholder="0" min="0" 
                                max="${card.maxAvailable.toFixed(2)}" step="0.01">
                            <span class="avail-card-max" title="Disponible en tarjeta">/ ${sym}${card.maxAvailable.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>`;
                });
                if (groupTotal > 0) {
                    cardsHTML += `<div class="avail-card-row avail-card-total">
                        <span class="avail-card-name">Subtotal ${currency}</span>
                        <span class="avail-card-amount">${sym}${groupTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>`;
                }
                cardsHTML += '</div>';
            }
            cardsHTML += '</div>';
            cardBreakdownEl.innerHTML = cardsHTML;
            cardBreakdownEl.style.display = 'block';

            // Event listeners for card availability inputs
            cardBreakdownEl.querySelectorAll('.avail-card-input').forEach(inp => {
                inp.addEventListener('change', () => {
                    const cardId = inp.dataset.cardId;
                    const val = parseFloat(inp.value) || 0;
                    if (val > 0) state.cardBudgets[cardId + '_' + mKey] = val;
                    else delete state.cardBudgets[cardId + '_' + mKey];
                    saveData();
                    updateSidebar();
                    renderCards(); // Re-render cards to update budget progress bars
                });
            });
        } else {
            cardBreakdownEl.innerHTML = '';
            cardBreakdownEl.style.display = 'none';
        }

        // Calculate unified totals BY CURRENCY without mixing them
        function getTotalsByCurrency(year, month) {
            const days = getDaysInMonth(year, month);
            const totals = {};

            function initCurrency(curr) {
                if (!totals[curr]) totals[curr] = { expense: 0, income: 0, available: 0 };
            }

            initCurrency('USD');
            for (const curr of Object.keys(CURRENCY_SYMBOLS)) {
                if (state.availability[mKey + '_' + curr]) {
                    initCurrency(curr);
                    totals[curr].available += state.availability[mKey + '_' + curr];
                }
            }

            state.cards.forEach(c => {
                const curr = c.currency || 'USD';
                const chosen = state.cardBudgets[c.id + '_' + mKey] || 0;
                initCurrency(curr);
                totals[curr].available += chosen;
            });

            for (const key in state.entries) {
                state.entries[key].forEach(e => {
                    if (e.type === 'income') {
                        const target = e.targetMonth || key.substring(0, 7);
                        if (target === mKey) {
                            const curr = e.cardId ? getCardById(e.cardId)?.currency || 'USD' : 'USD';
                            initCurrency(curr);
                            totals[curr].income += e.amount;
                            totals[curr].available += e.amount;
                        }
                    }
                });
            }

            for (let d = 1; d <= days; d++) {
                const dateK = dateKey(year, month, d);
                if (state.entries[dateK]) {
                    state.entries[dateK].forEach(e => {
                        if (e.type === 'expense' && !e.pending) {
                            const curr = e.cardId ? getCardById(e.cardId)?.currency || 'USD' : 'USD';
                            initCurrency(curr);
                            totals[curr].expense += e.amount;
                        }
                    });
                }
            }
            return totals;
        }

        const totals = getTotalsByCurrency(currentYear, currentMonth);

        // Helper to format multi-currency blocks
        function buildMultiCurrencyHTML(type, dataToUse) {
            const currentTotals = dataToUse || totals;
            let html = '';
            const currencies = Object.keys(currentTotals).sort((a, b) => a === 'USD' ? -1 : (b === 'USD' ? 1 : 0));
            currencies.forEach(curr => {
                let amount = currentTotals[curr][type];
                if (type === 'balance') amount = currentTotals[curr].income - currentTotals[curr].expense;
                if (type === 'remaining') amount = currentTotals[curr].available - currentTotals[curr].expense;

                if (curr === 'USD' || currentTotals[curr].available > 0 || currentTotals[curr].expense > 0 || currentTotals[curr].income > 0) {
                    let colorClass = '';
                    if (type === 'balance' || type === 'remaining') {
                        if (amount > 0) colorClass = 'style="color:#22c55e;"';
                        else if (amount < 0) colorClass = 'style="color:#ef4444;"';
                    }
                    html += `<div ${colorClass}>${formatAmount(amount, curr)} <span style="font-size: 0.5em; opacity: 0.6; vertical-align: middle;">${curr}</span></div>`;
                }
            });
            return html || `<div>${formatAmount(0, 'USD')}</div>`;
        }

        elements.totalMonth.innerHTML = buildMultiCurrencyHTML('expense');
        elements.totalIncome.innerHTML = buildMultiCurrencyHTML('income');
        elements.balanceValue.innerHTML = buildMultiCurrencyHTML('balance');

        if (elements.sidebarCashContainer) {
            let cashHTML = '<div class="avail-cards-list" style="margin-bottom: 15px;">';
            cashHTML += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">';
            cashHTML += '<span class="avail-currency-label" style="font-size: 0.7rem; color: var(--text-muted); font-weight: bold;">💵 EFECTIVO (CASH)</span>';
            cashHTML += `<select id="addCashCurrencySelect" style="font-size: 0.7rem; padding: 2px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text-primary);">
                <option value="">+ Añadir divisa...</option>
                ${Object.keys(CURRENCY_SYMBOLS).map(c => `<option value="${c}">${c} (${CURRENCY_SYMBOLS[c]})</option>`).join('')}
            </select>`;
            cashHTML += '</div>';

            const currenciesToShow = new Set(['USD']);
            state.cards.forEach(c => currenciesToShow.add(c.currency));
            for (const k in state.availability) {
                if (k.startsWith(mKey + '_')) {
                    currenciesToShow.add(k.split('_')[1]);
                }
            }

            currenciesToShow.forEach(curr => {
                const sym = CURRENCY_SYMBOLS[curr] || '$';
                const val = state.availability[mKey + '_' + curr] || '';
                cashHTML += `
                    <div class="budget-input-wrapper" style="margin-bottom: 8px; background: rgba(0,0,0,0.15); padding: 4px 8px; border-radius: 6px;">
                        <span class="summary-label" style="font-size: 0.65rem; color: var(--text-muted); margin-right: 8px; min-width: 65px;">Efectivo ${curr}</span>
                        <span class="currency-sign" style="font-size:0.9rem;">${sym}</span>
                        <input type="number" class="budget-input avail-cash-input" data-currency="${curr}" 
                            value="${val}" placeholder="0.00" min="0" step="0.01" style="font-size: 0.95rem; padding: 2px;">
                    </div>`;
            });
            cashHTML += '</div>';
            elements.sidebarCashContainer.innerHTML = cashHTML;

            elements.sidebarCashContainer.querySelectorAll('.avail-cash-input').forEach(inp => {
                inp.addEventListener('input', () => {
                    const curr = inp.dataset.currency;
                    const val = parseFloat(inp.value) || 0;
                    if (val > 0) state.availability[mKey + '_' + curr] = val;
                    else delete state.availability[mKey + '_' + curr];
                    saveData();

                    // Live update just the totals to avoid focus loss
                    const newTotals = getTotalsByCurrency(currentYear, currentMonth);
                    const totalDisplayEl = document.getElementById('availabilityTotalDisplay');
                    if (totalDisplayEl) {
                        totalDisplayEl.innerHTML = buildMultiCurrencyHTML('available', newTotals);
                    }
                    if (elements.remainingValue) {
                        elements.remainingValue.innerHTML = buildMultiCurrencyHTML('remaining', newTotals);
                    }
                });
            });

            const addCashSelect = document.getElementById('addCashCurrencySelect');
            addCashSelect.addEventListener('change', () => {
                const curr = addCashSelect.value;
                if (curr && !state.availability[mKey + '_' + curr]) {
                    state.availability[mKey + '_' + curr] = 0;
                    saveData();
                    updateSidebar();
                }
                addCashSelect.value = '';
            });
        }

        const totalDisplayEl = document.getElementById('availabilityTotalDisplay');
        if (totalDisplayEl) {
            totalDisplayEl.innerHTML = buildMultiCurrencyHTML('available');
        }

        elements.availabilityHint.textContent = 'Valores separados por divisa. Las divisas no se mezclan.';

        const hasAvailable = Object.values(totals).some(t => t.available > 0);
        if (hasAvailable) {
            elements.availabilityRemaining.style.display = 'block';
            elements.remainingValue.innerHTML = buildMultiCurrencyHTML('remaining');

            // Progress bars do not work for multi-currency arrays correctly. Hide them.
            if (elements.availabilityBarFill && elements.availabilityBarFill.parentElement) {
                elements.availabilityBarFill.parentElement.style.display = 'none';
            }
            if (elements.availabilityStatus) {
                elements.availabilityStatus.style.display = 'none';
            }
        } else {
            elements.availabilityRemaining.style.display = 'none';
        }

        elements.budgetInput.value = budget || '';
        if (budget > 0) {
            elements.budgetBarContainer.style.display = 'block';
            const baseExpenseTotal = totals['USD'] ? totals['USD'].expense : 0;
            const percent = Math.min((baseExpenseTotal / budget) * 100, 100);
            elements.budgetBarFill.style.width = percent + '%';
            elements.budgetPercent.textContent = `${percent.toFixed(1)}% utilizado`;
            elements.budgetBarFill.classList.remove('warning', 'danger');
            if (percent >= 90) elements.budgetBarFill.classList.add('danger');
            else if (percent >= 70) elements.budgetBarFill.classList.add('warning');
        } else {
            elements.budgetBarContainer.style.display = 'none';
        }

        // Categories
        const categories = getMonthExpensesByCategory(currentYear, currentMonth);
        const catEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        if (catEntries.length === 0) {
            elements.categoryBreakdown.innerHTML = '<p class="empty-state-small">Sin gastos aún</p>';
        } else {
            elements.categoryBreakdown.innerHTML = catEntries.map(([cat, amount]) => {
                const color = CATEGORY_COLORS[cat] || '#6366f1';
                return `<div class="category-item">
                    <span class="category-name" style="border-left: 3px solid ${color}; padding-left: 8px;">${cat}</span>
                    <span class="category-amount">${formatCurrency(amount)}</span>
                </div>`;
            }).join('');
        }

        // Render cards in sidebar
        renderCards();
    }

    // ========== Cards Rendering ==========
    function renderCards() {
        if (state.cards.length === 0) {
            elements.cardsList.innerHTML = '<p class="empty-state-small">Sin tarjetas</p>';
            return;
        }

        elements.cardsList.innerHTML = state.cards.map(card => {
            const spent = getCardSpent(card.id);
            const deposits = getCardDeposits(card.id);
            const available = card.balance - spent + deposits;
            const sym = CURRENCY_SYMBOLS[card.currency] || '$';
            const typeLabel = card.type === 'credit' ? 'Crédito' : 'Débito';
            const balanceLabel = card.type === 'credit' ? 'Disponible' : 'Saldo';

            // Budget progress
            const mKey = monthKey(state.currentYear, state.currentMonth);
            const budget = state.cardBudgets[card.id + '_' + mKey] || 0;
            let budgetHTML = '';
            if (budget > 0) {
                const budgetPercent = Math.min((spent / budget) * 100, 100);
                let budgetBarClass = '';
                if (budgetPercent >= 100) budgetBarClass = 'danger';
                else if (budgetPercent >= 80) budgetBarClass = 'warning';
                const remaining = budget - spent;
                budgetHTML = `
                    <div class="mini-card-budget">
                        <div class="mini-card-budget-header">
                            <span class="mini-card-budget-label">🎯 Presupuesto</span>
                            <span class="mini-card-budget-pct ${budgetBarClass}">${budgetPercent.toFixed(0)}%</span>
                        </div>
                        <div class="mini-card-spent-bar">
                            <div class="mini-card-spent-fill ${budgetBarClass}" style="width: ${budgetPercent}%"></div>
                        </div>
                        <div class="mini-card-budget-info">
                            <span>Gastado: ${sym}${spent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                            <span>de ${sym}${budget.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                        </div>
                        ${remaining >= 0
                        ? `<span class="mini-card-budget-remaining">Quedan: ${sym}${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>`
                        : `<span class="mini-card-budget-remaining over">Excedido: ${sym}${Math.abs(remaining).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>`}
                    </div>`;
            } else {
                // If no budget, show simple spent info
                const spentPercent = card.balance > 0 ? Math.min((spent / card.balance) * 100, 100) : 0;
                let barClass = '';
                if (spentPercent >= 90) barClass = 'danger';
                else if (spentPercent >= 70) barClass = 'warning';
                budgetHTML = `
                    <div class="mini-card-spent">
                        <div class="mini-card-spent-bar">
                            <div class="mini-card-spent-fill ${barClass}" style="width: ${spentPercent}%"></div>
                        </div>
                        <span class="mini-card-spent-text">Gastado: ${sym}${spent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>`;
            }

            return `
            <div class="mini-card" data-card-id="${card.id}" style="background: linear-gradient(135deg, ${card.color}, ${card.color}cc); cursor:pointer;" title="Clic para editar">
                <div class="mini-card-top">
                    <span class="mini-card-name">${card.name}</span>
                    <span class="mini-card-type">${typeLabel}</span>
                </div>
                <div class="mini-card-bottom">
                    <div class="mini-card-balance">
                        <span class="mini-card-label">${balanceLabel}</span>
                        <span class="mini-card-amount">${sym}${Math.abs(available).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <span class="mini-card-currency">${card.currency}</span>
                    <div class="mini-card-actions">
                        <button class="mini-card-btn delete" data-card-id="${card.id}" title="Eliminar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${budgetHTML}
            </div>
            `;
        }).join('');

        // Click on card to edit
        elements.cardsList.querySelectorAll('.mini-card[data-card-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.mini-card-btn.delete')) return;
                openCardModalForEdit(card.dataset.cardId);
            });
        });

        elements.cardsList.querySelectorAll('.mini-card-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCard(btn.dataset.cardId);
            });
        });

        // Carousel navigation
        const dotsContainer = document.getElementById('cardsDots');
        const nav = document.getElementById('cardsNav');
        if (state.cards.length <= 1) {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
            dotsContainer.innerHTML = state.cards.map((_, i) =>
                `<span class="cards-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></span>`
            ).join('');

            // Dot click
            dotsContainer.querySelectorAll('.cards-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    const idx = parseInt(dot.dataset.idx);
                    elements.cardsList.scrollTo({ left: idx * elements.cardsList.offsetWidth, behavior: 'smooth' });
                });
            });

            // Prev/Next
            document.getElementById('cardPrev').onclick = () => {
                elements.cardsList.scrollBy({ left: -elements.cardsList.offsetWidth, behavior: 'smooth' });
            };
            document.getElementById('cardNext').onclick = () => {
                elements.cardsList.scrollBy({ left: elements.cardsList.offsetWidth, behavior: 'smooth' });
            };

            // Scroll tracking - update active dot
            elements.cardsList.onscroll = () => {
                const idx = Math.round(elements.cardsList.scrollLeft / elements.cardsList.offsetWidth);
                dotsContainer.querySelectorAll('.cards-dot').forEach((d, i) => {
                    d.classList.toggle('active', i === idx);
                });
            };
        }
    }

    // ========== Card CRUD ==========
    function openCardModal(editCard) {
        if (editCard) {
            elements.cardModalTitle.textContent = 'Editar Tarjeta';
            elements.btnSaveCardLabel.textContent = 'Guardar Cambios';
            elements.cardEditId.value = editCard.id;
            elements.cardName.value = editCard.name;
            elements.cardType.value = editCard.type;
            elements.cardCurrency.value = editCard.currency;
            elements.cardBalance.value = editCard.balance;
            const mKey = monthKey(state.currentYear, state.currentMonth);
            elements.cardBudget.value = state.cardBudgets[editCard.id + '_' + mKey] || '';
            elements.cardColor.value = editCard.color;
            updateCardBalanceLabel();
        } else {
            elements.cardModalTitle.textContent = 'Agregar Tarjeta';
            elements.btnSaveCardLabel.textContent = 'Agregar Tarjeta';
            elements.cardEditId.value = '';
            elements.cardForm.reset();
        }
        elements.cardModalOverlay.classList.add('active');
        elements.cardName.focus();
    }

    function closeCardModal() {
        elements.cardModalOverlay.classList.remove('active');
        elements.cardForm.reset();
        elements.cardEditId.value = '';
    }

    function openCardModalForEdit(cardId) {
        const card = getCardById(cardId);
        if (card) openCardModal(card);
    }

    function saveCard(data) {
        const editId = elements.cardEditId.value;
        const mKey = monthKey(state.currentYear, state.currentMonth);
        const budgetValue = data.budget;
        delete data.budget; // Don't store budget on card object

        if (editId) {
            const idx = state.cards.findIndex(c => c.id === editId);
            if (idx >= 0) {
                state.cards[idx] = { ...state.cards[idx], ...data };
                delete state.cards[idx].budget; // Ensure old budget prop is wiped
                // Save budget for current month
                if (budgetValue > 0) {
                    state.cardBudgets[editId + '_' + mKey] = budgetValue;
                } else {
                    delete state.cardBudgets[editId + '_' + mKey];
                }
            }
            showToast('💳 Tarjeta actualizada');
        } else {
            const newCard = { id: generateId(), ...data };
            state.cards.push(newCard);
            if (budgetValue > 0) {
                state.cardBudgets[newCard.id + '_' + mKey] = budgetValue;
            }
            showToast('💳 Tarjeta agregada');
        }
        saveData();
        renderCards();
        updateSidebar();
        populateCardSelect();
        closeCardModal();
    }

    function deleteCard(cardId) {
        state.cards = state.cards.filter(c => c.id !== cardId);
        // Remove cardId from any entries
        for (const key in state.entries) {
            state.entries[key].forEach(e => {
                if (e.cardId === cardId) delete e.cardId;
            });
        }
        saveData();
        renderCards();
        populateCardSelect();
        showToast('🗑️ Tarjeta eliminada');
    }

    function updateCardBalanceLabel() {
        const type = elements.cardType.value;
        elements.cardBalanceLabel.textContent = type === 'credit' ? 'Límite de crédito' : 'Saldo disponible';
    }

    // ========== Card Select in Expense/Income Form ==========
    function populateCardSelect(type) {
        const select = elements.expenseCard;
        const currentVal = select.value;
        const isIncome = (type || elements.transactionType.value) === 'income';
        const defaultText = isIncome ? 'Sin tarjeta' : 'Sin tarjeta (efectivo)';
        select.innerHTML = `<option value="">${defaultText}</option>`;
        state.cards.forEach(card => {
            const sym = CURRENCY_SYMBOLS[card.currency] || '$';
            const avail = getCardAvailable(card);
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = `${card.name} (${sym}${avail.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${card.currency})`;
            select.appendChild(option);
        });
        // Restore selection if still valid
        if (currentVal && getCardById(currentVal)) {
            select.value = currentVal;
        }

        // Initialize cash currency select if empty
        if (!elements.cashCurrencySelect.options.length) {
            elements.cashCurrencySelect.innerHTML = Object.keys(CURRENCY_SYMBOLS)
                .map(c => `<option value="${c}">${c} (${CURRENCY_SYMBOLS[c]})</option>`).join('');
        }
        elements.cashCurrencyGroup.style.display = select.value === '' ? 'block' : 'none';
    }

    // ========== Modal ==========
    function openModal(day) {
        state.selectedDate = day;
        const { currentYear, currentMonth } = state;
        const dayName = new Date(currentYear, currentMonth, day).toLocaleDateString('es-ES', { weekday: 'long' });
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        elements.modalTitle.textContent = `${capitalizedDay}, ${day} de ${MONTH_NAMES[currentMonth]}`;
        setTransactionType('expense');
        populateTargetMonthSelect();
        populateCardSelect();
        renderDayEntries();
        elements.modalOverlay.classList.add('active');
        elements.expenseDescription.focus();
    }

    function closeModal() {
        elements.modalOverlay.classList.remove('active');
        state.selectedDate = null;
        elements.expenseForm.reset();
        setTransactionType('expense');
    }

    function populateTargetMonthSelect() {
        const { currentYear, currentMonth } = state;
        const select = elements.incomeTargetMonth;
        select.innerHTML = '';
        for (let i = 0; i < 13; i++) {
            let m = currentMonth + i;
            let y = currentYear;
            while (m > 11) { m -= 12; y++; }
            const mKey = monthKey(y, m);
            const label = `${MONTH_NAMES[m]} ${y}`;
            const isCurrent = (m === currentMonth && y === currentYear);
            const option = document.createElement('option');
            option.value = mKey;
            option.textContent = isCurrent ? `${label} (este mes)` : label;
            if (isCurrent) option.selected = true;
            select.appendChild(option);
        }
    }

    function setTransactionType(type) {
        elements.transactionType.value = type;
        elements.btnTypeExpense.classList.toggle('active', type === 'expense');
        elements.btnTypeIncome.classList.toggle('active', type === 'income');
        elements.expenseForm.classList.toggle('income-mode', type === 'income');

        const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        elements.expenseCategory.innerHTML = '<option value="">Seleccionar...</option>' +
            cats.map(c => `<option value="${c}">${c}</option>`).join('');

        elements.incomeTargetRow.style.display = type === 'income' ? 'flex' : 'none';
        // Show card selector for BOTH expense and income when cards exist
        elements.cardSelectRow.style.display = state.cards.length > 0 ? 'flex' : 'none';

        // Show pending checkbox only for expenses
        elements.pendingRow.style.display = type === 'expense' ? 'flex' : 'none';
        if (type === 'income') elements.expensePending.checked = false;

        // Update card selector label and default based on type
        if (type === 'income') {
            elements.cardSelectLabel.textContent = '💳 Recibir en tarjeta';
        } else {
            elements.cardSelectLabel.textContent = '💳 Pagar con tarjeta';
        }
        populateCardSelect(type);

        elements.categoryLabel.textContent = type === 'income' ? 'Fuente' : 'Categoría';
        elements.btnAddLabel.textContent = type === 'income' ? 'Agregar Ingreso' : 'Agregar Gasto';
        elements.expenseDescription.placeholder = type === 'income' ? 'Ej: Pago de nómina' : 'Ej: Supermercado';
    }

    function renderDayEntries() {
        const { currentYear, currentMonth, selectedDate } = state;
        const key = dateKey(currentYear, currentMonth, selectedDate);
        const entries = state.entries[key] || [];

        if (entries.length === 0) {
            elements.dayExpensesList.innerHTML = '<p class="no-expenses">No hay movimientos registrados</p>';
            return;
        }

        const confirmedExpenses = entries.filter(e => e.type === 'expense' && !e.pending);
        const pendingExpenses = entries.filter(e => e.type === 'expense' && e.pending);
        const dayIncomes = entries.filter(e => e.type === 'income');

        const getTotals = (arr) => {
            const sums = {};
            arr.forEach(e => {
                const c = e.cardId ? getCardById(e.cardId)?.currency || 'USD' : (e.currency || 'USD');
                if (!sums[c]) sums[c] = 0;
                sums[c] += e.amount;
            });
            return sums;
        };

        const incomesByCurr = getTotals(dayIncomes);
        const expensesByCurr = getTotals(confirmedExpenses);
        const pendingByCurr = getTotals(pendingExpenses);

        elements.dayExpensesList.innerHTML = entries.map((entry, index) => {
            const isIncome = entry.type === 'income';
            const isPending = entry.pending;
            let itemClass = isIncome ? 'day-expense-item income-item' : 'day-expense-item';
            if (isPending) itemClass += ' pending-item';

            let badgeClass, badgeText;
            if (isPending) {
                badgeClass = 'income-badge badge-pending';
                badgeText = '🕐 Pendiente';
            } else if (isIncome) {
                badgeClass = 'income-badge badge-income';
                badgeText = 'Ingreso';
            } else {
                badgeClass = 'income-badge badge-expense';
                badgeText = 'Gasto';
            }
            const amountPrefix = isIncome ? '+' : '';

            let targetInfo = '';
            if (isIncome && entry.targetMonth) {
                const parts = entry.targetMonth.split('-');
                const tMonth = parseInt(parts[1]) - 1;
                const tYear = parseInt(parts[0]);
                const currentMKey = monthKey(currentYear, currentMonth);
                if (entry.targetMonth !== currentMKey) {
                    targetInfo = `<span class="income-target-info">→ Para ${MONTH_NAMES[tMonth]} ${tYear}</span>`;
                }
            }

            // Show card / cash info
            let cardInfo = '';
            let dispCurr = 'USD';
            if (entry.cardId) {
                const card = getCardById(entry.cardId);
                if (card) {
                    dispCurr = card.currency;
                    const action = isIncome ? '→' : '💳';
                    cardInfo = `<span class="income-target-info">${action} ${card.name} (${card.currency})</span>`;
                }
            } else {
                dispCurr = entry.currency || 'USD';
                cardInfo = `<span class="income-target-info">💵 Efectivo (${dispCurr})</span>`;
            }

            // Confirm button for pending entries
            const confirmBtn = isPending ? `
                <button class="btn-confirm-expense" data-id="${entry.id}" title="Confirmar gasto">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </button>` : '';

            return `
            <div class="${itemClass}" style="animation-delay: ${index * 0.05}s">
                <div class="expense-info">
                    <span class="expense-desc">
                        ${entry.description}
                        <span class="${badgeClass}">${badgeText}</span>
                    </span>
                    <span class="expense-cat">${entry.category}</span>
                    ${targetInfo}${cardInfo}
                </div>
                <span class="expense-amount">${amountPrefix}${formatAmount(entry.amount, dispCurr)}</span>
                ${confirmBtn}
                <button class="btn-delete-expense" data-id="${entry.id}" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>`;
        }).join('');

        let summaryHtml = '';

        if (dayIncomes.length > 0) {
            let sumsHtml = Object.keys(incomesByCurr).map(c => `+${formatAmount(incomesByCurr[c], c)}`).join('<br>');
            summaryHtml += `<div class="day-expense-item income-item" style="border-color: rgba(34,197,94,0.2);">
                <div class="expense-info"><span class="expense-desc">Total ingresos</span></div>
                <span class="expense-amount" style="color:#22c55e; font-size:1rem;">${sumsHtml}</span>
                <div style="width:30px;"></div>
            </div>`;
        }
        if (confirmedExpenses.length > 0) {
            let sumsHtml = Object.keys(expensesByCurr).map(c => `-${formatAmount(expensesByCurr[c], c)}`).join('<br>');
            summaryHtml += `<div class="day-expense-item" style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08)); border-color: rgba(99,102,241,0.2);">
                <div class="expense-info"><span class="expense-desc">Total gastos</span></div>
                <span class="expense-amount" style="font-size:1rem;">${sumsHtml}</span>
                <div style="width:30px;"></div>
            </div>`;
        }
        if (pendingExpenses.length > 0) {
            let sumsHtml = Object.keys(pendingByCurr).map(c => formatAmount(pendingByCurr[c], c)).join('<br>');
            summaryHtml += `<div class="day-expense-item pending-item" style="border-color: rgba(245,158,11,0.2);">
                <div class="expense-info"><span class="expense-desc">🕐 Total pendiente</span></div>
                <span class="expense-amount" style="color:#f59e0b; font-size:1rem;">${sumsHtml}</span>
                <div style="width:30px;"></div>
            </div>`;
        }
        elements.dayExpensesList.innerHTML += summaryHtml;

        elements.dayExpensesList.querySelectorAll('.btn-delete-expense').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteEntry(btn.dataset.id);
            });
        });

        elements.dayExpensesList.querySelectorAll('.btn-confirm-expense').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmEntry(btn.dataset.id);
            });
        });
    }

    // ========== Entry CRUD ==========
    function addEntry(description, amount, category, type, targetMonth, cardId, pending, cashCurrency) {
        const { currentYear, currentMonth, selectedDate } = state;
        const key = dateKey(currentYear, currentMonth, selectedDate);

        if (!state.entries[key]) state.entries[key] = [];

        const entry = {
            id: generateId(),
            description,
            amount: parseFloat(amount),
            category,
            type,
        };

        if (type === 'expense' && pending) entry.pending = true;

        if (type === 'income' && targetMonth) entry.targetMonth = targetMonth;
        if (cardId) entry.cardId = cardId;
        else if (cashCurrency) entry.currency = cashCurrency;

        state.entries[key].push(entry);
        saveData();
        renderDayEntries();
        renderCalendar();

        if (type === 'income') {
            const card = cardId ? getCardById(cardId) : null;
            if (card) {
                showToast(`💰 Ingreso depositado en ${card.name}`);
            } else if (targetMonth) {
                const parts = targetMonth.split('-');
                const tMonth = parseInt(parts[1]) - 1;
                const tYear = parseInt(parts[0]);
                const currentMKey = monthKey(currentYear, currentMonth);
                if (targetMonth !== currentMKey) {
                    showToast(`💰 Ingreso agregado → disponible en ${MONTH_NAMES[tMonth]} ${tYear}`);
                } else {
                    showToast('💰 Ingreso agregado correctamente');
                }
            } else {
                showToast('💰 Ingreso agregado correctamente');
            }
        } else {
            if (pending) {
                showToast('🕐 Gasto pendiente agregado');
            } else if (cardId) {
                const card = getCardById(cardId);
                showToast(`✅ Gasto con ${card ? card.name : 'tarjeta'}`);
            } else {
                showToast('✅ Gasto agregado correctamente');
            }
        }
    }

    function confirmEntry(entryId) {
        for (const key in state.entries) {
            const entry = state.entries[key].find(e => e.id === entryId);
            if (entry) {
                delete entry.pending;
                saveData();
                renderDayEntries();
                renderCalendar();
                showToast('✅ Gasto confirmado');
                return;
            }
        }
    }

    function deleteEntry(id) {
        const { currentYear, currentMonth, selectedDate } = state;
        const key = dateKey(currentYear, currentMonth, selectedDate);
        if (state.entries[key]) {
            const entry = state.entries[key].find(e => e.id === id);
            state.entries[key] = state.entries[key].filter(e => e.id !== id);
            if (state.entries[key].length === 0) delete state.entries[key];
            const wasIncome = entry && entry.type === 'income';
            saveData();
            renderDayEntries();
            renderCalendar();
            showToast(wasIncome ? '🗑️ Ingreso eliminado' : '🗑️ Gasto eliminado');
        }
    }

    // ========== Export CSV ==========
    function exportCSV() {
        const { currentYear, currentMonth } = state;
        const daysInMonth = getDaysInMonth(currentYear, currentMonth);
        let csv = 'Fecha,Tipo,Descripción,Categoría,Monto,Tarjeta,Mes Destino\n';
        let hasData = false;

        for (let d = 1; d <= daysInMonth; d++) {
            getEntriesForDay(currentYear, currentMonth, d).forEach(e => {
                hasData = true;
                const date = `${d}/${currentMonth + 1}/${currentYear}`;
                const tipo = e.type === 'income' ? 'Ingreso' : 'Gasto';
                const target = e.targetMonth || '';
                const card = e.cardId ? (getCardById(e.cardId)?.name || '') : '';
                csv += `"${date}","${tipo}","${e.description}","${e.category}","${e.amount.toFixed(2)}","${card}","${target}"\n`;
            });
        }

        if (!hasData) { showToast('⚠️ No hay datos para exportar'); return; }

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `movimientos_${MONTH_NAMES[currentMonth]}_${currentYear}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('📁 CSV exportado correctamente');
    }

    // ========== Report Generation ==========
    function openReportModal() {
        initReportDefaults();
        elements.reportModalOverlay.classList.add('active');
    }

    function closeReportModal() {
        elements.reportModalOverlay.classList.remove('active');
    }

    function initReportDefaults() {
        const { currentYear, currentMonth } = state;
        const firstDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const lastDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(getDaysInMonth(currentYear, currentMonth)).padStart(2, '0')}`;
        elements.reportDateFrom.value = firstDay;
        elements.reportDateTo.value = lastDay;
    }

    function generateReport() {
        const fromDate = new Date(elements.reportDateFrom.value + 'T00:00:00');
        const toDate = new Date(elements.reportDateTo.value + 'T23:59:59');

        if (isNaN(fromDate) || isNaN(toDate) || fromDate > toDate) {
            showToast('⚠️ Rango de fechas inválido');
            return;
        }

        const incSummary = elements.reportIncSummary.checked;
        const incCards = elements.reportIncCards.checked;
        const incCategories = elements.reportIncCategories.checked;
        const incDetails = elements.reportIncDetails.checked;

        // Collect data in range
        const allEntries = [];
        let totalIncome = 0, totalExpenses = 0;
        const categoryTotals = {};

        const current = new Date(fromDate);
        while (current <= toDate) {
            const y = current.getFullYear();
            const m = current.getMonth();
            const d = current.getDate();
            const key = dateKey(y, m, d);
            const dayEntries = state.entries[key] || [];

            dayEntries.forEach(e => {
                allEntries.push({ ...e, date: key, dateObj: new Date(current) });
                if (e.type === 'income') totalIncome += e.amount;
                else {
                    totalExpenses += e.amount;
                    if (!categoryTotals[e.category]) categoryTotals[e.category] = 0;
                    categoryTotals[e.category] += e.amount;
                }
            });
            current.setDate(current.getDate() + 1);
        }

        const balance = totalIncome - totalExpenses;
        const fromStr = fromDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        const toStr = toDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

        // Build report HTML
        let reportBody = '';

        // Summary section
        if (incSummary) {
            reportBody += `
            <div class="report-section">
                <h2>Resumen Financiero</h2>
                <div class="summary-grid">
                    <div class="summary-box income-box">
                        <span class="box-label">Total Ingresos</span>
                        <span class="box-value">+${formatCurrency(totalIncome)}</span>
                    </div>
                    <div class="summary-box expense-box">
                        <span class="box-label">Total Gastos</span>
                        <span class="box-value">-${formatCurrency(totalExpenses)}</span>
                    </div>
                    <div class="summary-box balance-box ${balance >= 0 ? 'positive' : 'negative'}">
                        <span class="box-label">Balance</span>
                        <span class="box-value">${formatCurrency(balance)}</span>
                    </div>
                    <div class="summary-box transactions-box">
                        <span class="box-label">Movimientos</span>
                        <span class="box-value">${allEntries.length}</span>
                    </div>
                </div>
            </div>`;
        }

        // Cards section
        if (incCards && state.cards.length > 0) {
            reportBody += `
            <div class="report-section">
                <h2>Estado de Tarjetas</h2>
                <table class="report-table">
                    <thead><tr><th>Tarjeta</th><th>Tipo</th><th>Moneda</th><th>Balance Inicial</th><th>Gastado</th><th>Depositado</th><th>Disponible</th></tr></thead>
                    <tbody>
                    ${state.cards.map(card => {
                const sym = CURRENCY_SYMBOLS[card.currency] || '$';
                const spent = getCardSpent(card.id);
                const deposits = getCardDeposits(card.id);
                const avail = card.balance - spent + deposits;
                return `<tr>
                            <td><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${card.color};margin-right:6px;"></span>${card.name}</td>
                            <td>${card.type === 'credit' ? 'Crédito' : 'Débito'}</td>
                            <td>${card.currency}</td>
                            <td>${sym}${card.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                            <td style="color:#ef4444;">-${sym}${spent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                            <td style="color:#22c55e;">+${sym}${deposits.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                            <td style="font-weight:700;">${sym}${avail.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        </tr>`;
            }).join('')}
                    </tbody>
                </table>
            </div>`;
        }

        // Categories section
        if (incCategories && Object.keys(categoryTotals).length > 0) {
            const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
            const maxCat = sortedCats[0][1];
            reportBody += `
            <div class="report-section">
                <h2>Desglose por Categoría</h2>
                <div class="category-bars">
                    ${sortedCats.map(([cat, amount]) => {
                const pct = (amount / maxCat * 100).toFixed(1);
                const color = CATEGORY_COLORS[cat] || '#6366f1';
                return `<div class="cat-row">
                            <span class="cat-name">${cat}</span>
                            <div class="cat-bar-container"><div class="cat-bar" style="width:${pct}%;background:${color};"></div></div>
                            <span class="cat-amount">${formatCurrency(amount)}</span>
                        </div>`;
            }).join('')}
                </div>
            </div>`;
        }

        // Details section
        if (incDetails && allEntries.length > 0) {
            reportBody += `
            <div class="report-section">
                <h2>Detalle de Movimientos</h2>
                <table class="report-table">
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th><th>Tarjeta</th><th>Monto</th></tr></thead>
                    <tbody>
                    ${allEntries.map(e => {
                const dateStr = e.dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                const tipo = e.type === 'income' ? '<span style="color:#22c55e;">Ingreso</span>' : '<span style="color:#ef4444;">Gasto</span>';
                const card = e.cardId ? (getCardById(e.cardId)?.name || '-') : '-';
                const amtStyle = e.type === 'income' ? 'color:#22c55e' : 'color:#ef4444';
                const prefix = e.type === 'income' ? '+' : '-';
                return `<tr>
                            <td>${dateStr}</td>
                            <td>${tipo}</td>
                            <td>${e.description}</td>
                            <td>${e.category}</td>
                            <td>${card}</td>
                            <td style="${amtStyle};font-weight:600;">${prefix}${formatCurrency(e.amount)}</td>
                        </tr>`;
            }).join('')}
                    </tbody>
                </table>
            </div>`;
        }

        if (!reportBody) {
            showToast('⚠️ Selecciona al menos una sección');
            return;
        }

        // Full report HTML
        const reportHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe CalendarGas - ${fromStr} a ${toStr}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; line-height: 1.6; }
        .report-container { max-width: 900px; margin: 0 auto; }
        .report-header { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
        .report-header h1 { font-size: 1.8rem; font-weight: 800; color: #6366f1; margin-bottom: 4px; }
        .report-header .subtitle { font-size: 0.95rem; color: #64748b; }
        .report-header .date-range { font-size: 1rem; font-weight: 600; color: #334155; margin-top: 8px; }
        .report-header .generated { font-size: 0.75rem; color: #94a3b8; margin-top: 4px; }
        .report-section { margin-bottom: 32px; }
        .report-section h2 { font-size: 1.15rem; font-weight: 700; color: #334155; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .summary-box { padding: 16px; border-radius: 12px; text-align: center; }
        .income-box { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .expense-box { background: #fef2f2; border: 1px solid #fecaca; }
        .balance-box.positive { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .balance-box.negative { background: #fef2f2; border: 1px solid #fecaca; }
        .transactions-box { background: #f8fafc; border: 1px solid #e2e8f0; }
        .box-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
        .box-value { display: block; font-size: 1.3rem; font-weight: 800; color: #1e293b; }
        .income-box .box-value { color: #16a34a; }
        .expense-box .box-value { color: #dc2626; }
        .balance-box.positive .box-value { color: #16a34a; }
        .balance-box.negative .box-value { color: #dc2626; }
        .report-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .report-table th { background: #f1f5f9; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.05em; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        .report-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
        .report-table tr:hover { background: #f8fafc; }
        .category-bars { display: flex; flex-direction: column; gap: 8px; }
        .cat-row { display: flex; align-items: center; gap: 12px; }
        .cat-name { font-size: 0.82rem; font-weight: 500; min-width: 160px; }
        .cat-bar-container { flex: 1; height: 20px; background: #f1f5f9; border-radius: 100px; overflow: hidden; }
        .cat-bar { height: 100%; border-radius: 100px; transition: width 0.5s; }
        .cat-amount { font-size: 0.82rem; font-weight: 700; min-width: 90px; text-align: right; }
        .report-footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; }
        @media print {
            body { padding: 20px; background: white; }
            .summary-grid { grid-template-columns: repeat(4, 1fr); }
            .report-table tr:hover { background: transparent; }
            .no-print { display: none; }
        }
        @media (max-width: 600px) {
            .summary-grid { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>📊 CalendarGas - Informe Financiero</h1>
            <div class="subtitle">Control de Gastos e Ingresos</div>
            <div class="date-range">${fromStr} — ${toStr}</div>
            <div class="generated">Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        ${reportBody}
        <div class="report-footer">
            <p>Informe generado por CalendarGas • ${new Date().getFullYear()}</p>
            <p class="no-print" style="margin-top:8px;font-size:0.8rem;color:#6366f1;">Usa Ctrl+P para imprimir o guardar como PDF</p>
        </div>
    </div>
</body>
</html>`;

        // Open in new window
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
            reportWindow.document.write(reportHTML);
            reportWindow.document.close();
            closeReportModal();
            showToast('📊 Informe generado correctamente');
        } else {
            showToast('⚠️ Permite ventanas emergentes para generar el informe');
        }
    }

    // ========== Event Listeners ==========
    function initEvents() {
        elements.prevMonth.addEventListener('click', () => {
            state.currentMonth--;
            if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
            renderCalendar();
        });

        elements.nextMonth.addEventListener('click', () => {
            state.currentMonth++;
            if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
            renderCalendar();
        });

        elements.btnToday.addEventListener('click', () => {
            const t = new Date();
            state.currentYear = t.getFullYear();
            state.currentMonth = t.getMonth();
            renderCalendar();
        });

        // Transaction Modal
        elements.modalClose.addEventListener('click', closeModal);
        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) closeModal();
        });

        // Type toggle
        elements.btnTypeExpense.addEventListener('click', () => setTransactionType('expense'));
        elements.btnTypeIncome.addEventListener('click', () => setTransactionType('income'));

        // Transaction form
        elements.expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const desc = elements.expenseDescription.value.trim();
            const amount = elements.expenseAmount.value;
            const category = elements.expenseCategory.value;
            const type = elements.transactionType.value;
            if (!desc || !amount || !category) return;

            let targetMonth = null;
            let cardId = elements.expenseCard.value || null;
            const pending = type === 'expense' && elements.expensePending.checked;
            if (type === 'income') {
                targetMonth = elements.incomeTargetMonth.value;
            }
            const cashCurrency = !cardId ? elements.cashCurrencySelect.value : null;

            addEntry(desc, amount, category, type, targetMonth, cardId, pending, cashCurrency);
            elements.expenseForm.reset();
            elements.cashCurrencyGroup.style.display = 'block'; // Reset to cash view
            elements.transactionType.value = type;
            setTransactionType(type);
            elements.expenseDescription.focus();
        });

        elements.expenseCard.addEventListener('change', () => {
            elements.cashCurrencyGroup.style.display = elements.expenseCard.value === '' ? 'block' : 'none';
        });

        // Budget
        elements.budgetInput.addEventListener('change', () => {
            const mKey = monthKey(state.currentYear, state.currentMonth);
            const val = parseFloat(elements.budgetInput.value);
            if (val > 0) state.budgets[mKey] = val;
            else delete state.budgets[mKey];
            saveData();
            updateSidebar();
        });

        // ===== Card Modal =====
        elements.btnOpenCardModal.addEventListener('click', () => openCardModal(null));

        elements.cardModalClose.addEventListener('click', closeCardModal);
        elements.cardModalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.cardModalOverlay) closeCardModal();
        });

        elements.cardType.addEventListener('change', updateCardBalanceLabel);

        elements.cardForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = elements.cardName.value.trim();
            const type = elements.cardType.value;
            const currency = elements.cardCurrency.value;
            const balance = parseFloat(elements.cardBalance.value);
            const budget = parseFloat(elements.cardBudget.value) || 0;
            const color = elements.cardColor.value;
            if (!name || isNaN(balance)) return;
            saveCard({ name, type, currency, balance, budget, color });
        });

        // Export
        elements.btnExport.addEventListener('click', exportCSV);

        // ===== Report Modal =====
        elements.btnOpenReport.addEventListener('click', openReportModal);
        elements.reportModalClose.addEventListener('click', closeReportModal);
        elements.reportModalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.reportModalOverlay) closeReportModal();
        });
        elements.reportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            generateReport();
        });

        // ===== Sync Modal =====
        document.getElementById('btnOpenSync').addEventListener('click', openSyncModal);
        document.getElementById('syncIndicator').addEventListener('click', openSyncModal);
        document.getElementById('syncModalClose').addEventListener('click', closeSyncModal);
        document.getElementById('syncModalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'syncModalOverlay') closeSyncModal();
        });
        document.getElementById('syncForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('syncCode').value.trim();
            if (code.length >= 6) {
                initFirebase(code);
                closeSyncModal();
            }
        });
        document.getElementById('btnSyncDisconnect').addEventListener('click', () => {
            disconnectSync();
            closeSyncModal();
        });

        // Mobile
        elements.menuToggle.addEventListener('click', () => {
            elements.sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 900 &&
                elements.sidebar.classList.contains('open') &&
                !elements.sidebar.contains(e.target) &&
                e.target !== elements.menuToggle &&
                !elements.menuToggle.contains(e.target)) {
                elements.sidebar.classList.remove('open');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const syncOverlay = document.getElementById('syncModalOverlay');
                if (syncOverlay && syncOverlay.classList.contains('active')) closeSyncModal();
                else if (elements.reportModalOverlay.classList.contains('active')) closeReportModal();
                else if (elements.cardModalOverlay.classList.contains('active')) closeCardModal();
                else closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (elements.modalOverlay.classList.contains('active')) return;
            if (elements.cardModalOverlay.classList.contains('active')) return;
            if (elements.reportModalOverlay.classList.contains('active')) return;
            if (e.key === 'ArrowLeft') elements.prevMonth.click();
            else if (e.key === 'ArrowRight') elements.nextMonth.click();
        });
    }

    // ========== Init ==========
    function init() {
        loadData();
        renderCalendar();
        initEvents();

        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('SW registered'))
                .catch(err => console.warn('SW registration failed:', err));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
