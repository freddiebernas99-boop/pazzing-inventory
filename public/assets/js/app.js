/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Pazings application client for the Vercel API and shared Supabase database
 *
 * Rules:
 * - Simple, professional, minimal blue-and-white theme.
 * - Zero emojis in interface text, buttons, alerts, or messages.
 * - Real-time calculation of transaction totals.
 * - Supabase-backed records through same-origin authenticated API routes.
 */

(function () {
    'use strict';

    // Default master service catalog
    const DEFAULT_SERVICES = [
        { id: 'srv_water_refill', category: 'water', serviceCode: 'refill', serviceName: 'Refill', defaultRate: 30.00, unitLabel: 'bottles', isActive: true, displayOrder: 1 },
        { id: 'srv_water_delivered', category: 'water', serviceCode: 'delivered', serviceName: 'Delivered', defaultRate: 35.00, unitLabel: 'bottles', isActive: true, displayOrder: 2 },
        { id: 'srv_water_gallon_refill', category: 'water', serviceCode: 'gallon_refill', serviceName: 'Gallon w/ Refill', defaultRate: 210.00, unitLabel: 'gallons', isActive: true, displayOrder: 3 },
        { id: 'srv_water_gallon_cover', category: 'water', serviceCode: 'gallon_cover', serviceName: 'Round Gallon Cover', defaultRate: 15.00, unitLabel: 'pcs', isActive: true, displayOrder: 4 },
        { id: 'srv_water_half_gallon', category: 'water', serviceCode: 'half_gallon', serviceName: 'Half Gallon Refill', defaultRate: 15.00, unitLabel: 'bottles', isActive: true, displayOrder: 5 },
        { id: 'srv_laundry_regular', category: 'laundry', serviceCode: 'regular', serviceName: 'Regular', defaultRate: 175.00, unitLabel: 'loads', isActive: true, displayOrder: 1 },
        { id: 'srv_laundry_special', category: 'laundry', serviceCode: 'special', serviceName: 'Special', defaultRate: 205.00, unitLabel: 'loads', isActive: true, displayOrder: 2 },
        { id: 'srv_laundry_comforter', category: 'laundry', serviceCode: 'comforter', serviceName: 'Comforter', defaultRate: 235.00, unitLabel: 'loads', isActive: true, displayOrder: 3 },
        { id: 'srv_laundry_detergent', category: 'laundry', serviceCode: 'detergent', serviceName: 'Detergent', defaultRate: 10.00, unitLabel: 'packs', isActive: true, displayOrder: 4 },
        { id: 'srv_laundry_fabcon', category: 'laundry', serviceCode: 'fabcon', serviceName: 'Fab Con', defaultRate: 10.00, unitLabel: 'packs', isActive: true, displayOrder: 5 }
    ];

    // Global application state
    const AppState = {
        currentUser: null,
        currentView: 'login',
        deviceUnlocked: false,
        services: JSON.parse(JSON.stringify(DEFAULT_SERVICES)),
        rates: {
            water: {
                refill: 30.00,
                delivered: 35.00,
                gallon_refill: 210.00,
                gallon_cover: 15.00,
                half_gallon: 15.00
            },
            laundry: {
                regular: 175.00,
                special: 205.00,
                comforter: 235.00,
                detergent: 10.00,
                fabcon: 10.00
            }
        },
    };

    function syncRatesFromServices() {
        AppState.rates = { water: {}, laundry: {} };
        AppState.services.forEach(s => {
            if (s.category && s.serviceCode) {
                if (!AppState.rates[s.category]) AppState.rates[s.category] = {};
                AppState.rates[s.category][s.serviceCode] = Number(s.defaultRate) || 0;
            }
        });
    }

    // ============================================================
    // 1. Storage & Persistence Engine & Security
    // ============================================================

    // Legacy helper retained for compatibility with existing local PIN hashes.
    function sha256(ascii) {
        function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
        var i, j, result = '';
        var words = [];
        var asciiBitLength = ascii.length * 8;
        var hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        var k = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];

        for (i = 0; i < ascii.length; i++) {
            words[i >> 2] |= (ascii.charCodeAt(i) & 255) << (24 - (i % 4) * 8);
        }
        words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
        words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

        for (j = 0; j < words.length; j += 16) {
            var w = [];
            for (i = 0; i < 16; i++) w[i] = words[j + i] | 0;
            for (i = 16; i < 64; i++) {
                var s0 = (rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3));
                var s1 = (rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10));
                w[i] = ((w[i - 16] + s0 + w[i - 7] + s1) | 0);
            }
            var a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
            for (i = 0; i < 64; i++) {
                var S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25));
                var ch = ((e & f) ^ ((~e) & g));
                var temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
                var S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22));
                var maj = ((a & b) ^ (a & c) ^ (b & c));
                var temp2 = (S0 + maj) | 0;
                h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
            }
            hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
            hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
        }
        for (i = 0; i < 8; i++) {
            for (j = 3; j >= 0; j--) {
                var byte = (hash[i] >> (j * 8)) & 255;
                result += (byte < 16 ? '0' : '') + byte.toString(16);
            }
        }
        return result;
    }

    const SESSION_KEY = 'pazings_cloud_session';
    let activeTabSession = null;

    function getSession() {
        try {
            const rawLocal = localStorage.getItem(SESSION_KEY);
            if (!rawLocal) {
                activeTabSession = null;
                return null;
            }
            const parsedLocal = JSON.parse(rawLocal);
            if (activeTabSession?.accessToken) {
                return activeTabSession;
            }
            return parsedLocal;
        } catch (error) {
            localStorage.removeItem(SESSION_KEY);
            activeTabSession = null;
            return null;
        }
    }

    function saveSession(session) {
        activeTabSession = session ? { ...session } : null;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    function clearSession() {
        activeTabSession = null;
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('pazings_session_user');
    }

    let syncChannel = null;
    if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
        try {
            syncChannel = new window.BroadcastChannel('pazings_sync_channel');
            if (typeof syncChannel.unref === 'function') syncChannel.unref();
        } catch (e) {
            syncChannel = null;
        }
    }

    function notifyDataChanged(kind = 'data') {
        const msg = { kind, ts: Date.now() };
        try {
            if (syncChannel) syncChannel.postMessage(msg);
        } catch (e) {}
        try {
            if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
                localStorage.setItem('pazings_sync_signal', JSON.stringify(msg));
            }
        } catch (e) {}
    }

    const STATIC_DB_KEY = 'pazings_static_db_v1';

    function loadStaticDb() {
        const defaultDb = {
            users: [
                {
                    id: 'usr_owner_1',
                    fullName: 'Admin / Owner',
                    role: 'owner',
                    status: 'active',
                    pinCode: String(5555),
                    hasPin: true,
                    createdAt: '2026-01-01T00:00:00.000Z'
                },
                {
                    id: 'usr_staff_1',
                    fullName: 'Store Staff',
                    role: 'staff',
                    status: 'active',
                    pinCode: String(1111),
                    hasPin: true,
                    createdAt: '2026-01-01T00:00:00.000Z'
                }
            ],
            services: DEFAULT_SERVICES.map(s => ({ ...s })),
            transactions: [],
            expenses: [],
            customers: []
        };
        try {
            const raw = localStorage.getItem(STATIC_DB_KEY);
            if (!raw) {
                localStorage.setItem(STATIC_DB_KEY, JSON.stringify(defaultDb));
                return defaultDb;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed.users) || parsed.users.length === 0) parsed.users = defaultDb.users;
            if (!Array.isArray(parsed.services) || parsed.services.length === 0) parsed.services = defaultDb.services;
            if (!Array.isArray(parsed.transactions)) parsed.transactions = [];
            if (!Array.isArray(parsed.expenses)) parsed.expenses = [];
            if (!Array.isArray(parsed.customers)) parsed.customers = [];
            return parsed;
        } catch (e) {
            return defaultDb;
        }
    }

    function saveStaticDb(db) {
        try {
            localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
        } catch (e) {}
    }

    function sanitizeStaticUser(u) {
        if (!u) return null;
        return {
            id: u.id,
            fullName: u.fullName,
            role: u.role,
            status: u.status || 'active',
            hasPin: Boolean(u.pinCode),
            createdAt: u.createdAt || new Date().toISOString()
        };
    }

    function localStaticApi(action, payload = {}, session = null) {
        const db = loadStaticDb();
        let currentUser = null;
        if (session?.accessToken && String(session.accessToken).startsWith('static-token:')) {
            const uid = String(session.accessToken).slice('static-token:'.length);
            currentUser = db.users.find(u => u.id === uid && u.status === 'active') || null;
        }

        switch (action) {
            case 'loginPin': {
                const role = String(payload.role || '').trim();
                const pin = String(payload.pin || '').trim();
                const matched = db.users.find(u => u.status === 'active' && u.pinCode === pin && (!role || u.role === role));
                if (!matched) {
                    const err = new Error('Invalid PIN for the selected role.');
                    err.status = 401;
                    throw err;
                }
                const userObj = sanitizeStaticUser(matched);
                return {
                    accessToken: `static-token:${matched.id}`,
                    refreshToken: `static-refresh:${matched.id}`,
                    user: userObj
                };
            }
            case 'me':
            case 'refresh': {
                if (!currentUser && session?.user?.id) {
                    currentUser = db.users.find(u => u.id === session.user.id && u.status === 'active') || null;
                }
                if (!currentUser) {
                    const err = new Error('Session expired. Please sign in again.');
                    err.status = 401;
                    throw err;
                }
                const userObj = sanitizeStaticUser(currentUser);
                return {
                    accessToken: `static-token:${currentUser.id}`,
                    refreshToken: `static-refresh:${currentUser.id}`,
                    user: userObj
                };
            }
            case 'logout':
                return { success: true };
            case 'getServices': {
                const activeOnly = Boolean(payload.activeOnly);
                return db.services
                    .filter(s => !activeOnly || s.isActive)
                    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            }
            case 'addService': {
                const srv = {
                    id: 'srv_' + Date.now(),
                    category: payload.category,
                    serviceCode: String(payload.serviceName || 'service').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                    serviceName: String(payload.serviceName || '').trim(),
                    defaultRate: Number(payload.defaultRate || 0),
                    unitLabel: String(payload.unitLabel || 'units').trim(),
                    isActive: true,
                    displayOrder: Number(payload.displayOrder || db.services.length + 1)
                };
                db.services.push(srv);
                saveStaticDb(db);
                return srv;
            }
            case 'updateService': {
                const idx = db.services.findIndex(s => s.id === payload.id);
                if (idx !== -1) {
                    db.services[idx] = {
                        ...db.services[idx],
                        serviceName: String(payload.serviceName ?? db.services[idx].serviceName).trim(),
                        defaultRate: Number(payload.defaultRate ?? db.services[idx].defaultRate),
                        unitLabel: String(payload.unitLabel ?? db.services[idx].unitLabel).trim()
                    };
                    saveStaticDb(db);
                    return db.services[idx];
                }
                return null;
            }
            case 'toggleServiceActive': {
                const srv = db.services.find(s => s.id === payload.id);
                if (srv) {
                    srv.isActive = !payload.currentActive;
                    saveStaticDb(db);
                    return srv.isActive;
                }
                return false;
            }
            case 'deleteService': {
                db.services = db.services.filter(s => s.id !== payload.id);
                saveStaticDb(db);
                return { success: true };
            }
            case 'getTransactions': {
                return db.transactions
                    .filter(tx => {
                        if (payload.filterDate && tx.transactionDate !== payload.filterDate) return false;
                        if (payload.category && payload.category !== 'all' && tx.businessCategory !== payload.category) return false;
                        return true;
                    })
                    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            }
            case 'getTransactionsByDateRange': {
                return db.transactions
                    .filter(tx => {
                        if (payload.startDate && tx.transactionDate < payload.startDate) return false;
                        if (payload.endDate && tx.transactionDate > payload.endDate) return false;
                        if (payload.category && payload.category !== 'all' && tx.businessCategory !== payload.category) return false;
                        return true;
                    })
                    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            }
            case 'addTransaction': {
                const txDate = payload.transactionDate || getTodayString();
                const prefix = payload.businessCategory === 'water' ? 'WTR' : 'LND';
                const dateCompact = txDate.replace(/-/g, '');
                const sameDayCount = db.transactions.filter(
                    t => t.businessCategory === payload.businessCategory && t.transactionDate === txDate
                ).length + 1;
                const transactionCode = `${prefix}-${dateCompact}-${String(sameDayCount).padStart(3, '0')}`;
                const customerName = String(payload.customerName || 'Walk-in Customer').trim() || 'Walk-in Customer';
                const newTx = {
                    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    transactionCode,
                    businessCategory: payload.businessCategory,
                    transactionDate: txDate,
                    transactionTime: payload.transactionTime || getCurrentTimeString(),
                    customerName,
                    serviceType: payload.serviceType || 'Standard',
                    orderType: payload.orderType || 'Walk-in',
                    paymentStatus: payload.paymentStatus || 'paid',
                    totalAmount: Number(payload.totalAmount || 0),
                    notes: payload.notes || '',
                    createdByName: currentUser?.fullName || session?.user?.fullName || 'Staff',
                    createdAt: new Date().toISOString(),
                    items: Array.isArray(payload.items) ? payload.items : []
                };
                db.transactions.unshift(newTx);

                const existingCustomer = db.customers.find(
                    c => c.customerName.toLowerCase() === customerName.toLowerCase()
                );
                if (!existingCustomer) {
                    db.customers.push({
                        id: 'cust_' + Date.now(),
                        customerName,
                        contactNumber: '',
                        address: '',
                        createdAt: new Date().toISOString()
                    });
                }
                saveStaticDb(db);
                return newTx;
            }
            case 'togglePaymentStatus': {
                const tx = db.transactions.find(t => t.id === payload.id);
                const nextStatus = payload.currentStatus === 'paid' ? 'unpaid' : 'paid';
                if (tx) {
                    tx.paymentStatus = nextStatus;
                    saveStaticDb(db);
                }
                return nextStatus;
            }
            case 'deleteTransaction': {
                db.transactions = db.transactions.filter(t => t.id !== payload.id);
                saveStaticDb(db);
                return { success: true };
            }
            case 'getExpenses': {
                return db.expenses
                    .filter(exp => {
                        if (payload.filterDate && exp.expenseDate !== payload.filterDate) return false;
                        if (payload.category && payload.category !== 'all' && exp.businessCategory !== payload.category) return false;
                        return true;
                    })
                    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            }
            case 'getExpensesByDateRange': {
                return db.expenses
                    .filter(exp => {
                        if (payload.startDate && exp.expenseDate < payload.startDate) return false;
                        if (payload.endDate && exp.expenseDate > payload.endDate) return false;
                        if (payload.category && payload.category !== 'all' && exp.businessCategory !== payload.category) return false;
                        return true;
                    })
                    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            }
            case 'addExpense': {
                const newExp = {
                    id: 'exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    expenseDate: payload.expenseDate || getTodayString(),
                    businessCategory: payload.businessCategory || 'shared',
                    particular: String(payload.particular || '').trim(),
                    totalAmount: Number(payload.totalAmount || 0),
                    createdByName: currentUser?.fullName || session?.user?.fullName || 'Staff',
                    createdAt: new Date().toISOString()
                };
                db.expenses.unshift(newExp);
                saveStaticDb(db);
                return newExp;
            }
            case 'deleteExpense': {
                db.expenses = db.expenses.filter(e => e.id !== payload.id);
                saveStaticDb(db);
                return { success: true };
            }
            case 'getCustomers': {
                return db.customers.map(c => {
                    const custTxs = db.transactions.filter(
                        t => String(t.customerName || '').toLowerCase() === c.customerName.toLowerCase()
                    );
                    const totalSpent = custTxs.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
                    const lastVisit = custTxs.reduce(
                        (latest, t) => (!latest || t.transactionDate > latest ? t.transactionDate : latest),
                        null
                    );
                    return {
                        ...c,
                        transactionCount: custTxs.length,
                        totalSpent,
                        lastVisit
                    };
                });
            }
            case 'addCustomer': {
                const name = String(payload.customerName || '').trim();
                const newCust = {
                    id: 'cust_' + Date.now(),
                    customerName: name,
                    contactNumber: String(payload.contactNumber || '').trim(),
                    address: String(payload.address || '').trim(),
                    createdAt: new Date().toISOString()
                };
                db.customers.push(newCust);
                saveStaticDb(db);
                return newCust;
            }
            case 'getUsers':
                return db.users.map(sanitizeStaticUser);
            case 'createUser': {
                const fullName = String(payload.fullName || '').trim();
                const pin = String(payload.pin || '').trim();
                const role = payload.role === 'owner' ? 'owner' : 'staff';
                if (!fullName || !/^\d{4}$/.test(pin)) {
                    throw new Error('Full name and a 4-digit PIN are required.');
                }
                if (db.users.some(u => u.pinCode === pin)) {
                    throw new Error('This 4-digit PIN is already assigned to another account.');
                }
                const newUser = {
                    id: 'usr_' + Date.now(),
                    fullName,
                    role,
                    status: 'active',
                    pinCode: pin,
                    hasPin: true,
                    createdAt: new Date().toISOString()
                };
                db.users.push(newUser);
                saveStaticDb(db);
                return sanitizeStaticUser(newUser);
            }
            case 'toggleUserStatus': {
                const target = db.users.find(u => u.id === payload.id);
                const nextStatus = payload.currentStatus === 'active' ? 'inactive' : 'active';
                if (target) {
                    target.status = nextStatus;
                    saveStaticDb(db);
                }
                return nextStatus;
            }
            default:
                return null;
        }
    }

    async function apiRequest(action, payload = {}, retry = true) {
        const session = getSession();
        const headers = { 'Content-Type': 'application/json' };
        if (session?.accessToken && action !== 'login' && action !== 'loginPin' && action !== 'refresh') {
            headers.Authorization = `Bearer ${session.accessToken}`;
        }

        let response;
        try {
            response = await fetch('/api', {
                method: 'POST',
                headers,
                body: JSON.stringify({ action, payload })
            });
        } catch (networkErr) {
            return localStaticApi(action, payload, session);
        }

        if (response.status === 404 || response.status === 405) {
            return localStaticApi(action, payload, session);
        }

        let result;
        try {
            result = await response.json();
        } catch (error) {
            throw new Error('The server returned an invalid response. Please try again later.');
        }

        if (response.status === 401 && retry && session?.refreshToken && action !== 'login') {
            try {
                const refreshed = await apiRequest('refresh', { refreshToken: session.refreshToken }, false);
                saveSession(refreshed);
                return await apiRequest(action, payload, false);
            } catch (error) {
                clearSession();
                AppState.currentUser = null;
                throw error;
            }
        }
        if (!response.ok) {
            if (response.status === 401 && session?.accessToken
                && action !== 'login' && action !== 'loginPin' && action !== 'refresh') {
                clearSession();
                AppState.currentUser = null;
                AppState.deviceUnlocked = false;
                switchView('login');
                showAlert('Your session expired. Sign in again with your account PIN.', 'info');
            }
            const error = new Error(result.error || `Request failed (${response.status}).`);
            error.status = response.status;
            throw error;
        }
        return result;
    }

    function formatPeso(amount) {
        const val = Number(amount) || 0;
        return '₱' + val.toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
            return dateStr;
        } catch (e) {
            return dateStr;
        }
    }

    function getTodayString() {
        try {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(new Date());
            const y = parts.find(p => p.type === 'year')?.value;
            const m = parts.find(p => p.type === 'month')?.value;
            const d = parts.find(p => p.type === 'day')?.value;
            if (y && m && d) return `${y}-${m}-${d}`;
        } catch (e) {}
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getCurrentTimeString() {
        const now = new Date();
        try {
            return now.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }
    }

    function showAlert(message, type = 'info', durationMs = 4000) {
        const container = document.getElementById('alert-container');
        if (!container) return;

        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type}`;
        alertEl.style.marginBottom = '8px';
        alertEl.style.boxShadow = 'var(--shadow-md)';
        alertEl.textContent = message;

        container.appendChild(alertEl);

        setTimeout(() => {
            alertEl.style.opacity = '0';
            alertEl.style.transition = 'opacity 0.3s ease';
            setTimeout(() => alertEl.remove(), 300);
        }, durationMs);
    }

    // ============================================================
    // 2. Data Service Layer
    // ============================================================

    const DataService = {
        async initAuth() {
            if (!getSession()?.accessToken) return null;
            try {
                const result = await apiRequest('me');
                AppState.currentUser = result.user;
                return result.user;
            } catch (error) {
                if ((error.status >= 400 && error.status < 500)
                    || /sign in again|inactive|not configured/i.test(error.message)) {
                    clearSession();
                    AppState.currentUser = null;
                    return null;
                }
                throw error;
            }
        },

        async loginWithPin(role, pin) {
            const cleanPin = String(pin || '').trim();
            if (!/^\d{4}$/.test(cleanPin)) {
                throw new Error('Enter a 4-digit PIN.');
            }
            const result = await apiRequest('loginPin', { role, pin: cleanPin });
            saveSession(result);
            AppState.currentUser = result.user;
            AppState.deviceUnlocked = true;
            return result.user;
        },

        async logout() {
            try {
                if (getSession()?.accessToken) await apiRequest('logout');
            } finally {
                clearSession();
                AppState.currentUser = null;
                AppState.deviceUnlocked = false;
            }
        },

        async getServices() {
            AppState.services = await apiRequest('getServices');
            syncRatesFromServices();
            return AppState.services;
        },

        async addService(serviceData) {
            const cleanCode = (serviceData.serviceCode || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const cleanName = (serviceData.serviceName || '').trim();
            const cat = serviceData.category === 'laundry' ? 'laundry' : 'water';

            if (!cleanName) throw new Error('Service name is required.');
            if (!cleanCode) throw new Error('Service code is required.');

            // Verify unique code within category
            if (AppState.services.some(s => s.category === cat && s.serviceCode.toLowerCase() === cleanCode)) {
                throw new Error(`A service with code "${cleanCode}" already exists in ${cat}.`);
            }

            const id = 'srv_' + cat + '_' + Date.now();
            const newService = {
                id,
                category: cat,
                serviceCode: cleanCode,
                serviceName: cleanName,
                defaultRate: Math.max(0, Number(serviceData.defaultRate) || 0),
                unitLabel: (serviceData.unitLabel || (cat === 'laundry' ? 'load' : 'bottle')).trim(),
                isActive: serviceData.isActive !== false,
                displayOrder: AppState.services.length + 1,
                createdAt: new Date().toISOString()
            };

            const savedService = await apiRequest('addService', newService);
            AppState.services.push(savedService);
            syncRatesFromServices();
            notifyDataChanged('services');
            return savedService;
        },

        async updateService(id, updateData) {
            const index = AppState.services.findIndex(s => s.id === id);
            if (index === -1) throw new Error('Service not found.');

            const existing = AppState.services[index];
            const updated = {
                ...existing,
                serviceName: updateData.serviceName !== undefined ? updateData.serviceName.trim() : existing.serviceName,
                defaultRate: updateData.defaultRate !== undefined ? Math.max(0, Number(updateData.defaultRate) || 0) : existing.defaultRate,
                unitLabel: updateData.unitLabel !== undefined ? updateData.unitLabel.trim() : existing.unitLabel,
                isActive: updateData.isActive !== undefined ? Boolean(updateData.isActive) : existing.isActive,
                updatedAt: new Date().toISOString()
            };

            AppState.services[index] = await apiRequest('updateService', { id, ...updateData, ...updated });
            syncRatesFromServices();
            notifyDataChanged('services');
            return AppState.services[index];
        },

        async toggleServiceActive(id) {
            const s = AppState.services.find(item => item.id === id);
            if (!s) return null;
            return await this.updateService(id, { isActive: !s.isActive });
        },

        async deleteService(id) {
            const service = AppState.services.find(s => s.id === id);
            if (!service) return { deleted: false, message: 'Service not found.' };

            // Check if any existing transactions reference this service
            const result = await apiRequest('deleteService', { id });
            AppState.services = AppState.services.filter(s => s.id !== id);
            if (result.deactivated) {
                AppState.services.push({ ...service, isActive: false });
            }
            syncRatesFromServices();
            notifyDataChanged('services');
            return result;
        },

        async saveRates(newRatesMap) {
            for (const [srvId, rate] of Object.entries(newRatesMap)) {
                const s = AppState.services.find(item => item.id === srvId);
                if (s) {
                    s.defaultRate = Math.max(0, Number(rate) || 0);
                }
            }
            await apiRequest('saveRates', { rates: newRatesMap });
            syncRatesFromServices();
            notifyDataChanged('services');
        },

        async getRates() {
            await this.getServices();
            return AppState.rates;
        },

        async addTransaction(tx) {
            const date = tx.transactionDate || getTodayString();
            const time = tx.transactionTime || getCurrentTimeString();

            const record = await apiRequest('addTransaction', {
                businessCategory: tx.businessCategory,
                transactionDate: date,
                transactionTime: time,
                customerName: tx.customerName || 'Walk-in Customer',
                totalAmount: Number(tx.totalAmount) || 0,
                paymentMethod: tx.paymentMethod || 'Cash',
                paymentStatus: tx.paymentStatus || 'paid',
                items: tx.items || [],
                notes: tx.notes || ''
            });
            notifyDataChanged('transactions');
            return record;
        },

        async getTransactions(filterDate = null, category = null) {
            return apiRequest('getTransactions', { filterDate, category });
        },

        async deleteTransaction(txId) {
            await apiRequest('deleteTransaction', { id: txId });
            notifyDataChanged('transactions');
        },

        async togglePaymentStatus(txId, currentStatus) {
            const updatedStatus = await apiRequest('togglePaymentStatus', { id: txId, currentStatus });
            notifyDataChanged('transactions');
            return updatedStatus;
        },

        async addExpense(exp) {
            const date = exp.expenseDate || getTodayString();
            const createdExp = await apiRequest('addExpense', {
                expenseDate: date,
                businessCategory: exp.businessCategory || 'shared',
                particular: exp.particular || '',
                quantity: exp.quantity !== null && exp.quantity !== '' ? Number(exp.quantity) : null,
                unitPrice: exp.unitPrice !== null && exp.unitPrice !== '' ? Number(exp.unitPrice) : null,
                totalAmount: Number(exp.totalAmount) || 0,
                notes: exp.notes || ''
            });
            notifyDataChanged('expenses');
            return createdExp;
        },

        async getExpenses(filterDate = null, category = null) {
            return apiRequest('getExpenses', { filterDate, category });
        },

        async deleteExpense(expId) {
            await apiRequest('deleteExpense', { id: expId });
            notifyDataChanged('expenses');
        },

        async getCustomers() {
            return apiRequest('getCustomers');
        },

        async getUsers() {
            return apiRequest('getUsers');
        },

        async createUser(fullName, pin, role = 'staff') {
            return apiRequest('createUser', { fullName, pin, role });
        }
    };

    // ============================================================
    // 3. UI Navigation & Role Management
    // ============================================================

    function closeMobileMenu() {
        const navLinks = document.getElementById('navLinks');
        const toggleBtn = document.getElementById('navToggle');
        if (navLinks) navLinks.classList.remove('open');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.classList.remove('active');
        }
    }

    function openMobileMenu() {
        const navLinks = document.getElementById('navLinks');
        const toggleBtn = document.getElementById('navToggle');
        if (navLinks) navLinks.classList.add('open');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.classList.add('active');
        }
    }

    function toggleMobileMenu() {
        const navLinks = document.getElementById('navLinks');
        if (navLinks && navLinks.classList.contains('open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }

    function setupNavigation() {
        // 1. View navigation buttons
        document.querySelectorAll('.nav-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-view');
                if (view) switchView(view);
                closeMobileMenu();
            });
        });

        // 2. Dashboard action shortcuts and data-nav buttons
        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-nav');
                if (view) switchView(view);
                closeMobileMenu();
            });
        });

        // 3. Menu Toggle Button
        const toggleBtn = document.getElementById('navToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMobileMenu();
            });
        }

        // 4. Brand logo click returns to dashboard
        const brand = document.getElementById('nav-brand');
        if (brand) {
            brand.addEventListener('click', () => {
                switchView('dashboard');
                closeMobileMenu();
            });
        }

        // 5. Logout handler
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                closeMobileMenu();
                try {
                    await DataService.logout();
                    switchView('login');
                    showAlert('You have been logged out.', 'info');
                } catch (error) {
                    switchView('login');
                    showAlert(error.message || 'Logged out, but the server could not revoke the session.', 'warning');
                }
            });
        }

        // 6. Close menu when clicking outside
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('click', (e) => {
                const navLinks = document.getElementById('navLinks');
                const toggleBtn = document.getElementById('navToggle');
                if (!navLinks || !navLinks.classList.contains('open')) return;

                if (!navLinks.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
                    closeMobileMenu();
                }
            });

            // 7. Close menu on Escape key press
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' || e.key === 'Esc') {
                    const navLinks = document.getElementById('navLinks');
                    if (navLinks && navLinks.classList.contains('open')) {
                        closeMobileMenu();
                        const toggleBtn = document.getElementById('navToggle');
                        if (toggleBtn && typeof toggleBtn.focus === 'function') toggleBtn.focus();
                    }
                }
            });
        }

        // 8. Close menu automatically if viewport is resized beyond mobile breakpoint
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    closeMobileMenu();
                }
            });
        }
    }

    function switchView(viewName) {
        closeMobileMenu();
        AppState.currentView = viewName;

        // If not logged in, enforce login view
        if ((!AppState.currentUser || !AppState.deviceUnlocked) && viewName !== 'login') {
            switchView('login');
            return;
        }

        // Reset login role selection card state when viewing login
        if (viewName === 'login') {
            const pinCard = document.getElementById('login-pin-card');
            const pinRoleSelect = document.getElementById('pin-role-select');
            const staffPinCard = document.getElementById('login-staff-pin-card');
            const adminPinCard = document.getElementById('login-admin-pin-card');
            const staffPinForm = document.getElementById('staff-pin-login-form');
            const adminPinForm = document.getElementById('admin-pin-login-form');
            const staffPinError = document.getElementById('login-staff-pin-error');
            const adminPinError = document.getElementById('login-admin-pin-error');
            if (pinCard) pinCard.style.display = 'block';
            if (pinRoleSelect) pinRoleSelect.style.display = 'flex';
            if (staffPinCard) staffPinCard.style.display = 'none';
            if (adminPinCard) adminPinCard.style.display = 'none';
            if (staffPinError) staffPinError.style.display = 'none';
            if (adminPinError) adminPinError.style.display = 'none';
            if (staffPinForm) staffPinForm.reset();
            if (adminPinForm) adminPinForm.reset();
        }

        // Hide all views
        document.querySelectorAll('.app-view, #view-login').forEach(el => {
            el.style.display = 'none';
        });

        // Top nav header visibility
        const mainHeader = document.getElementById('main-header');
        if (mainHeader) {
            mainHeader.style.display = AppState.currentUser && AppState.deviceUnlocked ? 'block' : 'none';
        }

        // Update active nav button
        document.querySelectorAll('.nav-link').forEach(btn => {
            if (btn.getAttribute('data-view') === viewName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Owner-only visibility
        const isOwner = AppState.currentUser && AppState.currentUser.role === 'owner';
        document.querySelectorAll('.owner-only').forEach(el => {
            el.style.display = isOwner ? '' : 'none';
        });

        // Restrict owner views from staff
        const ownerViews = ['customers', 'rates', 'staff'];
        if (!isOwner && ownerViews.includes(viewName)) {
            showAlert('Access restricted to business owners.', 'danger');
            switchView('dashboard');
            return;
        }

        // Show selected view
        const targetSection = document.getElementById(`view-${viewName}`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // Trigger view renderers
        switch (viewName) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'water':
                renderWaterView();
                break;
            case 'laundry':
                renderLaundryView();
                break;
            case 'expenses':
                renderExpensesView();
                break;
            case 'reports':
                renderReportsView();
                break;
            case 'customers':
                renderCustomersView();
                break;
            case 'rates':
                renderRatesView();
                break;
            case 'staff':
                renderStaffView();
                break;
        }

        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function resetAllDatesToToday() {
        const today = getTodayString();
        waterFilterDate = today;
        laundryFilterDate = today;
        expensesFilterDate = today;
        expensesFilterCat = 'all';
        reportDate = today;
        ['water-date', 'water-filter-date', 'laundry-date', 'laundry-filter-date', 'expense-date', 'expenses-filter-date', 'reports-date-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = today;
        });
    }

    async function finishSignIn() {
        AppState.deviceUnlocked = true;
        resetAllDatesToToday();
        updateUserInfoHeader();
        switchView('dashboard');
        showAlert('Signed in. Records are saved to the shared database.', 'success');
    }

    function setupAccountPinHandlers() {
        const pinRoleSelect = document.getElementById('pin-role-select');
        const staffPinCard = document.getElementById('login-staff-pin-card');
        const adminPinCard = document.getElementById('login-admin-pin-card');

        const selectPinRole = (role) => {
            if (pinRoleSelect) pinRoleSelect.style.display = 'none';
            if (staffPinCard) staffPinCard.style.display = role === 'staff' ? 'block' : 'none';
            if (adminPinCard) adminPinCard.style.display = role === 'owner' ? 'block' : 'none';
            const input = document.getElementById(role === 'staff' ? 'staff-account-pin' : 'admin-account-pin');
            if (input) input.focus();
        };
        const selectRoleButton = document.getElementById('btn-select-staff-pin');
        const selectAdminButton = document.getElementById('btn-select-admin-pin');
        const backStaffButton = document.getElementById('btn-staff-pin-back');
        const backAdminButton = document.getElementById('btn-admin-pin-back');
        if (selectRoleButton) selectRoleButton.addEventListener('click', () => selectPinRole('staff'));
        if (selectAdminButton) selectAdminButton.addEventListener('click', () => selectPinRole('owner'));
        if (backStaffButton) backStaffButton.addEventListener('click', () => switchView('login'));
        if (backAdminButton) backAdminButton.addEventListener('click', () => switchView('login'));

        const bindPinLogin = (role) => {
            const form = document.getElementById(role === 'staff' ? 'staff-pin-login-form' : 'admin-pin-login-form');
            const input = document.getElementById(role === 'staff' ? 'staff-account-pin' : 'admin-account-pin');
            const errorElement = document.getElementById(role === 'staff' ? 'login-staff-pin-error' : 'login-admin-pin-error');
            const submitButton = document.getElementById(role === 'staff' ? 'staff-pin-login-btn' : 'admin-pin-login-btn');
            if (!form) return;

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (errorElement) errorElement.style.display = 'none';
                if (submitButton) submitButton.disabled = true;
                try {
                    await DataService.loginWithPin(role, input.value);
                    await DataService.getRates();
                    form.reset();
                    await finishSignIn();
                } catch (error) {
                    if (errorElement) {
                        errorElement.textContent = error.message || 'Unable to sign in with that PIN.';
                        errorElement.style.display = 'block';
                    }
                    input.value = '';
                    input.focus();
                } finally {
                    if (submitButton) submitButton.disabled = false;
                }
            });
        };
        bindPinLogin('staff');
        bindPinLogin('owner');
    }

    function updateUserInfoHeader() {
        const user = AppState.currentUser;
        const nameEl = document.getElementById('nav-user-name');
        const badgeEl = document.getElementById('user-role-badge');
        const footerLabel = document.getElementById('footer-user-label');

        if (user) {
            const displayName = user.fullName || (user.role === 'owner' ? 'Business Owner' : 'Staff');
            if (nameEl) nameEl.textContent = displayName;
            if (badgeEl) {
                badgeEl.textContent = (user.role || 'staff').toUpperCase();
                badgeEl.className = 'brand-badge' + (user.role === 'owner' ? ' owner' : '');
            }
            if (footerLabel) footerLabel.textContent = `${displayName} (${(user.role || 'staff').toUpperCase()})`;
        } else {
            if (footerLabel) footerLabel.textContent = 'Guest';
        }
    }

    // ============================================================
    // 4. View Renderers
    // ============================================================

    // --- VIEW 2: STAFF DASHBOARD / DAILY OVERVIEW ---
    async function renderDashboard() {
        const today = getTodayString();
        const dateDisplay = document.getElementById('dashboard-date-display');
        if (dateDisplay) {
            dateDisplay.textContent = formatDate(today);
        }

        const txList = await DataService.getTransactions(today);

        let paidSales = 0;
        let waterPaid = 0;
        let laundryPaid = 0;

        let unpaidBalance = 0;
        let waterUnpaid = 0;
        let laundryUnpaid = 0;
        let unpaidCount = 0;

        txList.forEach(t => {
            const amt = Number(t.totalAmount) || 0;
            const isPaid = (t.paymentStatus === 'paid');

            if (isPaid) {
                paidSales += amt;
                if (t.businessCategory === 'water') {
                    waterPaid += amt;
                } else if (t.businessCategory === 'laundry') {
                    laundryPaid += amt;
                }
            } else {
                unpaidBalance += amt;
                unpaidCount++;
                if (t.businessCategory === 'water') {
                    waterUnpaid += amt;
                } else if (t.businessCategory === 'laundry') {
                    laundryUnpaid += amt;
                }
            }
        });

        const grossSales = paidSales + unpaidBalance;
        const waterGross = waterPaid + waterUnpaid;
        const laundryGross = laundryPaid + laundryUnpaid;

        // 1. Primary summary area: Today's Paid Sales & Gross Sales
        const paidEl = document.getElementById('dashboard-paid-sales');
        const waterPaidEl = document.getElementById('dashboard-water-paid');
        const laundryPaidEl = document.getElementById('dashboard-laundry-paid');
        const grossEl = document.getElementById('dashboard-gross-sales');
        const waterGrossEl = document.getElementById('dashboard-water-gross');
        const laundryGrossEl = document.getElementById('dashboard-laundry-gross');
        const countEl = document.getElementById('dashboard-trans-count');

        if (paidEl) paidEl.textContent = formatPeso(paidSales);
        if (waterPaidEl) waterPaidEl.textContent = formatPeso(waterPaid);
        if (laundryPaidEl) laundryPaidEl.textContent = formatPeso(laundryPaid);
        if (grossEl) grossEl.textContent = formatPeso(grossSales);
        if (waterGrossEl) waterGrossEl.textContent = formatPeso(waterGross);
        if (laundryGrossEl) laundryGrossEl.textContent = formatPeso(laundryGross);
        if (countEl) countEl.textContent = `${txList.length} transaction(s) recorded today`;

        // 2. Compact section immediately below: Unpaid Balance
        const unpaidEl = document.getElementById('dashboard-unpaid-balance');
        const unpaidCountEl = document.getElementById('dashboard-unpaid-count');
        const waterUnpaidEl = document.getElementById('dashboard-water-unpaid');
        const laundryUnpaidEl = document.getElementById('dashboard-laundry-unpaid');
        const unpaidBanner = document.getElementById('dashboard-unpaid-banner');

        if (unpaidEl) unpaidEl.textContent = formatPeso(unpaidBalance);
        if (unpaidCountEl) unpaidCountEl.textContent = `${unpaidCount} unpaid transaction(s)`;
        if (waterUnpaidEl) waterUnpaidEl.textContent = formatPeso(waterUnpaid);
        if (laundryUnpaidEl) laundryUnpaidEl.textContent = formatPeso(laundryUnpaid);

        if (unpaidBanner) {
            if (unpaidBalance > 0) {
                unpaidBanner.classList.add('has-unpaid');
            } else {
                unpaidBanner.classList.remove('has-unpaid');
            }
        }

        const tbody = document.getElementById('dashboard-recent-tbody');
        const countLabel = document.getElementById('dashboard-recent-count');

        if (!tbody) return;

        if (txList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                        No transactions recorded today yet. Select Water Refilling or Laundry to record one.
                    </td>
                </tr>
            `;
            if (countLabel) countLabel.textContent = '0 records';
            return;
        }

        if (countLabel) countLabel.textContent = `${txList.length} today`;

        let rowsHtml = '';

        txList.forEach(t => {
            const catBadge = t.businessCategory === 'water'
                ? '<span class="badge" style="background: var(--blue-light); color: var(--blue);">Water</span>'
                : '<span class="badge" style="background: #E8F4FD; color: #0C66E4;">Laundry</span>';

            const statusBadge = t.paymentStatus === 'paid'
                ? `<button type="button" class="badge badge-paid toggle-payment" data-id="${t.id}" data-status="paid" style="border:none; cursor:pointer;" title="Click to change payment status">Paid</button>`
                : `<button type="button" class="badge badge-unpaid toggle-payment" data-id="${t.id}" data-status="unpaid" style="border:none; cursor:pointer;" title="Click to mark as paid">Unpaid</button>`;

            const itemSummaries = (t.items || [])
                .map(item => `${item.itemName} (${item.quantity} × ${formatPeso(item.unitPrice)})`)
                .join(', ');

            rowsHtml += `
                <tr>
                    <td style="color: var(--text-secondary);">${escapeHtml(t.transactionTime || '--:--')}</td>
                    <td><code>${escapeHtml(t.transactionCode || 'TRX')}</code></td>
                    <td>${catBadge}</td>
                    <td style="font-weight: 500;">
                        ${escapeHtml(t.customerName || 'Walk-in')}
                        ${itemSummaries ? `<div style="font-size: 0.74rem; color: var(--text-secondary); font-weight: 400;">${escapeHtml(itemSummaries)}</div>` : ''}
                    </td>
                    <td style="text-align: right; font-weight: 600; color: var(--navy);">${formatPeso(t.totalAmount)}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        // Attach payment status toggle on recent transactions
        tbody.querySelectorAll('.toggle-payment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const status = e.currentTarget.getAttribute('data-status');
                await DataService.togglePaymentStatus(id, status);
                renderDashboard();
            });
        });
    }

    // --- VIEW 3: WATER REFILLING ---
    let waterFilterDate = getTodayString();

    function renderWaterFormFields() {
        const container = document.getElementById('water-services-container');
        if (!container) return;

        const preserved = {};
        if (typeof container.querySelectorAll === 'function') {
            container.querySelectorAll('.water-input').forEach(inp => {
                const sid = inp.getAttribute('data-service-id');
                if (sid && inp.value) preserved[sid] = inp.value;
            });
        }

        const activeServices = AppState.services.filter(s => s.category === 'water' && s.isActive !== false);

        if (activeServices.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 12px; background: var(--bg-page); border: 1px dashed var(--border); border-radius: var(--radius-sm); text-align: center; color: var(--text-secondary); font-size: 0.82rem;">
                    No active water services configured. Add or activate services under Rates.
                </div>
            `;
            return;
        }

        let html = '';
        activeServices.forEach(s => {
            html += `
                <div class="qty-field">
                    <label for="water-qty-${s.id}">${escapeHtml(s.serviceName)}</label>
                    <span class="rate-hint">${formatPeso(s.defaultRate)} / ${escapeHtml(s.unitLabel || 'bottle')}</span>
                    <input type="number" id="water-qty-${s.id}" class="water-input"
                           data-service-id="${s.id}" data-service-name="${escapeHtml(s.serviceName)}"
                           data-service-rate="${s.defaultRate}" data-unit="${escapeHtml(s.unitLabel || 'bottle')}"
                           min="0" step="1">
                </div>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('.water-input').forEach(input => {
            const sid = input.getAttribute('data-service-id');
            if (sid && preserved[sid] !== undefined) {
                input.value = preserved[sid];
            }
            input.addEventListener('input', calculateWaterTotal);
            input.addEventListener('change', calculateWaterTotal);
        });
    }

    function calculateWaterTotal() {
        let total = 0;
        document.querySelectorAll('#water-services-container .water-input').forEach(input => {
            const qty = Number(input.value) || 0;
            const rate = Number(input.getAttribute('data-service-rate')) || 0;
            total += (qty * rate);
        });

        const extraQty = Number(document.getElementById('water-extra-qty')?.value) || 0;
        const extraPrice = Number(document.getElementById('water-extra-price')?.value) || 0;
        total += (extraQty * extraPrice);

        const totalDisplay = document.getElementById('water-total-display');
        if (totalDisplay) {
            totalDisplay.textContent = formatPeso(total);
        }
        return total;
    }

    function renderWaterView() {
        const today = getTodayString();
        const dateInput = document.getElementById('water-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
        }

        const filterInput = document.getElementById('water-filter-date');
        if (filterInput) {
            filterInput.value = waterFilterDate;
        }

        renderWaterFormFields();
        calculateWaterTotal();
        loadWaterTransactions();

        DataService.getServices().then(() => {
            if (AppState.currentView === 'water') {
                renderWaterFormFields();
                calculateWaterTotal();
            }
        }).catch(() => {});
    }

    async function loadWaterTransactions() {
        const tbody = document.getElementById('water-tbody');
        const dayTotalEl = document.getElementById('water-day-total');
        const summaryCountEl = document.getElementById('water-summary-count');
        const summaryGrossEl = document.getElementById('water-summary-gross');
        const summaryPaidEl = document.getElementById('water-summary-paid');
        const summaryUnpaidEl = document.getElementById('water-summary-unpaid');
        if (!tbody) return;

        const txList = await DataService.getTransactions(waterFilterDate, 'water');
        let dayTotal = 0;
        let dayPaid = 0;
        let dayUnpaid = 0;

        if (txList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                        No water transactions recorded for ${formatDate(waterFilterDate)}.
                    </td>
                </tr>
            `;
            if (dayTotalEl) dayTotalEl.textContent = 'Total: ₱0.00';
            if (summaryCountEl) summaryCountEl.textContent = '0';
            if (summaryGrossEl) summaryGrossEl.textContent = formatPeso(0);
            if (summaryPaidEl) summaryPaidEl.textContent = formatPeso(0);
            if (summaryUnpaidEl) summaryUnpaidEl.textContent = formatPeso(0);
            return;
        }

        const isOwner = AppState.currentUser && AppState.currentUser.role === 'owner';
        let rowsHtml = '';

        txList.forEach((t, idx) => {
            const amount = Number(t.totalAmount) || 0;
            dayTotal += amount;
            if (t.paymentStatus === 'paid') {
                dayPaid += amount;
            } else {
                dayUnpaid += amount;
            }

            const itemSummaries = (t.items || [])
                .map(item => `${item.itemName} (${item.quantity} × ${formatPeso(item.unitPrice)})`)
                .join(', ');
            const statusBadge = t.paymentStatus === 'paid'
                ? `<button type="button" class="badge badge-paid toggle-payment" data-id="${t.id}" data-status="paid" style="border:none; cursor:pointer;">Paid</button>`
                : `<button type="button" class="badge badge-unpaid toggle-payment" data-id="${t.id}" data-status="unpaid" style="border:none; cursor:pointer;">Unpaid</button>`;
            const deleteButton = isOwner
                ? `<button type="button" class="btn btn-danger btn-sm delete-tx-btn" data-id="${t.id}" data-code="${escapeHtml(t.transactionCode || '')}">Delete</button>`
                : '';

            rowsHtml += `
                <tr>
                    <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                    <td style="color: var(--text-secondary);">${escapeHtml(t.transactionTime || '--:--')}</td>
                    <td style="font-weight: 500;">
                        ${escapeHtml(t.customerName || 'Walk-in Customer')}
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">${escapeHtml(t.transactionCode || '')}${t.notes ? ' &bull; ' + escapeHtml(t.notes) : ''}</div>
                    </td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(itemSummaries || 'Water')}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--navy);">${formatPeso(amount)}</td>
                    <td>${statusBadge}</td>
                    ${isOwner ? `<td style="text-align: center;">${deleteButton}</td>` : ''}
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;
        if (dayTotalEl) dayTotalEl.textContent = `Total: ${formatPeso(dayTotal)}`;
        if (summaryCountEl) summaryCountEl.textContent = `${txList.length}`;
        if (summaryGrossEl) summaryGrossEl.textContent = formatPeso(dayTotal);
        if (summaryPaidEl) summaryPaidEl.textContent = formatPeso(dayPaid);
        if (summaryUnpaidEl) summaryUnpaidEl.textContent = formatPeso(dayUnpaid);

        attachTransactionActionListeners(tbody, () => loadWaterTransactions());
    }

    // --- VIEW 4: LAUNDRY ---
    let laundryFilterDate = getTodayString();

    function renderLaundryFormFields() {
        const container = document.getElementById('laundry-services-container');
        if (!container) return;

        const preserved = {};
        if (typeof container.querySelectorAll === 'function') {
            container.querySelectorAll('.laundry-input').forEach(inp => {
                const sid = inp.getAttribute('data-service-id');
                if (sid && inp.value) preserved[sid] = inp.value;
            });
        }

        const activeServices = AppState.services.filter(s => s.category === 'laundry' && s.isActive !== false);

        if (activeServices.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 12px; background: var(--bg-page); border: 1px dashed var(--border); border-radius: var(--radius-sm); text-align: center; color: var(--text-secondary); font-size: 0.82rem;">
                    No active laundry services configured. Add or activate services under Rates.
                </div>
            `;
            return;
        }

        let html = '';
        activeServices.forEach(s => {
            html += `
                <div class="qty-field">
                    <label for="laundry-qty-${s.id}">${escapeHtml(s.serviceName)}</label>
                    <span class="rate-hint">${formatPeso(s.defaultRate)} / ${escapeHtml(s.unitLabel || 'load')}</span>
                    <input type="number" id="laundry-qty-${s.id}" class="laundry-input"
                           data-service-id="${s.id}" data-service-name="${escapeHtml(s.serviceName)}"
                           data-service-rate="${s.defaultRate}" data-unit="${escapeHtml(s.unitLabel || 'load')}"
                           min="0" step="1">
                </div>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('.laundry-input').forEach(input => {
            const sid = input.getAttribute('data-service-id');
            if (sid && preserved[sid] !== undefined) {
                input.value = preserved[sid];
            }
            input.addEventListener('input', calculateLaundryTotal);
            input.addEventListener('change', calculateLaundryTotal);
        });
    }

    function calculateLaundryTotal() {
        let total = 0;
        document.querySelectorAll('#laundry-services-container .laundry-input').forEach(input => {
            const qty = Number(input.value) || 0;
            const rate = Number(input.getAttribute('data-service-rate')) || 0;
            total += (qty * rate);
        });

        const totalDisplay = document.getElementById('laundry-total-display');
        if (totalDisplay) {
            totalDisplay.textContent = formatPeso(total);
        }
        return total;
    }

    function renderLaundryView() {
        const today = getTodayString();
        const dateInput = document.getElementById('laundry-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
        }

        const filterInput = document.getElementById('laundry-filter-date');
        if (filterInput) {
            filterInput.value = laundryFilterDate;
        }

        renderLaundryFormFields();
        calculateLaundryTotal();
        loadLaundryTransactions();

        DataService.getServices().then(() => {
            if (AppState.currentView === 'laundry') {
                renderLaundryFormFields();
                calculateLaundryTotal();
            }
        }).catch(() => {});
    }

    async function loadLaundryTransactions() {
        const tbody = document.getElementById('laundry-tbody');
        const dayTotalEl = document.getElementById('laundry-day-total');
        const summaryCountEl = document.getElementById('laundry-summary-count');
        const summaryGrossEl = document.getElementById('laundry-summary-gross');
        const summaryPaidEl = document.getElementById('laundry-summary-paid');
        const summaryUnpaidEl = document.getElementById('laundry-summary-unpaid');
        if (!tbody) return;

        const txList = await DataService.getTransactions(laundryFilterDate, 'laundry');
        let dayTotal = 0;
        let dayPaid = 0;
        let dayUnpaid = 0;

        if (txList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                        No laundry transactions recorded for ${formatDate(laundryFilterDate)}.
                    </td>
                </tr>
            `;
            if (dayTotalEl) dayTotalEl.textContent = 'Total: ₱0.00';
            if (summaryCountEl) summaryCountEl.textContent = '0';
            if (summaryGrossEl) summaryGrossEl.textContent = formatPeso(0);
            if (summaryPaidEl) summaryPaidEl.textContent = formatPeso(0);
            if (summaryUnpaidEl) summaryUnpaidEl.textContent = formatPeso(0);
            return;
        }

        const isOwner = AppState.currentUser && AppState.currentUser.role === 'owner';
        let rowsHtml = '';

        txList.forEach((t, idx) => {
            const amt = Number(t.totalAmount) || 0;
            dayTotal += amt;
            if (t.paymentStatus === 'paid') {
                dayPaid += amt;
            } else {
                dayUnpaid += amt;
            }

            const itemSummaries = (t.items || []).map(item => `${item.itemName} (${item.quantity} × ${formatPeso(item.unitPrice)})`).join(', ');

            const statusBadge = t.paymentStatus === 'paid'
                ? `<button type="button" class="badge badge-paid toggle-payment" data-id="${t.id}" data-status="paid" style="border:none; cursor:pointer;">Paid</button>`
                : `<button type="button" class="badge badge-unpaid toggle-payment" data-id="${t.id}" data-status="unpaid" style="border:none; cursor:pointer;">Unpaid</button>`;

            const deleteBtn = isOwner
                ? `<button type="button" class="btn btn-danger btn-sm delete-tx-btn" data-id="${escapeHtml(t.id)}" data-code="${escapeHtml(t.transactionCode || '')}">Delete</button>`
                : '';

            rowsHtml += `
                <tr>
                    <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                    <td style="color: var(--text-secondary);">${escapeHtml(t.transactionTime || '--:--')}</td>
                    <td style="font-weight: 500;">
                        ${escapeHtml(t.customerName || 'Customer')}
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">${escapeHtml(t.transactionCode || '')}${t.notes ? ' &bull; ' + escapeHtml(t.notes) : ''}</div>
                    </td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(itemSummaries || 'Laundry')}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--navy);">${formatPeso(amt)}</td>
                    <td>${statusBadge}</td>
                    ${isOwner ? `<td style="text-align: center;">${deleteBtn}</td>` : ''}
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;
        if (dayTotalEl) dayTotalEl.textContent = `Total: ${formatPeso(dayTotal)}`;
        if (summaryCountEl) summaryCountEl.textContent = `${txList.length}`;
        if (summaryGrossEl) summaryGrossEl.textContent = formatPeso(dayTotal);
        if (summaryPaidEl) summaryPaidEl.textContent = formatPeso(dayPaid);
        if (summaryUnpaidEl) summaryUnpaidEl.textContent = formatPeso(dayUnpaid);

        attachTransactionActionListeners(tbody, () => loadLaundryTransactions());
    }

    function attachTransactionActionListeners(tbody, reloadCallback) {
        tbody.querySelectorAll('.toggle-payment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const status = e.currentTarget.getAttribute('data-status');
                await DataService.togglePaymentStatus(id, status);
                reloadCallback();
            });
        });

        tbody.querySelectorAll('.delete-tx-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const code = e.currentTarget.getAttribute('data-code');
                if (confirm(`Delete transaction ${code}? This action cannot be undone.`)) {
                    await DataService.deleteTransaction(id);
                    showAlert(`Transaction ${code} removed.`, 'info');
                    reloadCallback();
                }
            });
        });
    }

    // --- VIEW 5: EXPENSES ---
    let expensesFilterDate = getTodayString();
    let expensesFilterCat = 'all';

    function renderExpensesView() {
        const today = getTodayString();
        const dateInput = document.getElementById('expense-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
        }

        const filterDateInput = document.getElementById('expenses-filter-date');
        if (filterDateInput) {
            filterDateInput.value = expensesFilterDate;
        }

        const filterCatSelect = document.getElementById('expenses-filter-category');
        if (filterCatSelect) {
            filterCatSelect.value = expensesFilterCat;
        }

        loadExpensesList();
    }

    async function loadExpensesList() {
        const tbody = document.getElementById('expenses-tbody');
        const dayTotalEl = document.getElementById('expenses-day-total');
        if (!tbody) return;

        const expList = await DataService.getExpenses(expensesFilterDate, expensesFilterCat);
        let totalExp = 0;

        if (expList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                        No expenses recorded for ${formatDate(expensesFilterDate)}.
                    </td>
                </tr>
            `;
            if (dayTotalEl) dayTotalEl.textContent = 'Total: ₱0.00';
            return;
        }

        const isOwner = AppState.currentUser && AppState.currentUser.role === 'owner';
        let rowsHtml = '';

        expList.forEach((e, idx) => {
            const amt = Number(e.totalAmount) || 0;
            totalExp += amt;

            let catBadge = '';
            if (e.businessCategory === 'water') {
                catBadge = '<span class="badge" style="background: var(--blue-light); color: var(--blue);">Water</span>';
            } else if (e.businessCategory === 'laundry') {
                catBadge = '<span class="badge" style="background: #E8F4FD; color: #0C66E4;">Laundry</span>';
            } else {
                catBadge = '<span class="badge" style="background: #F4F5F7; color: var(--navy); border: 1px solid var(--border);">Shared</span>';
            }

            const qtyDisplay = e.quantity !== null && e.quantity !== undefined ? e.quantity : '--';
            const priceDisplay = e.unitPrice !== null && e.unitPrice !== undefined ? formatPeso(e.unitPrice) : '--';
            const deleteBtn = isOwner
                ? `<button type="button" class="btn btn-danger btn-sm delete-exp-btn" data-id="${e.id}" data-name="${escapeHtml(e.particular)}">Delete</button>`
                : '';

            rowsHtml += `
                <tr>
                    <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                    <td>${catBadge}</td>
                    <td style="font-weight: 500;">${escapeHtml(e.particular)}</td>
                    <td style="text-align: center; color: var(--text-secondary);">${qtyDisplay}</td>
                    <td style="text-align: right; color: var(--text-secondary);">${priceDisplay}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--danger);">${formatPeso(amt)}</td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(e.notes || '')}</td>
                    ${isOwner ? `<td style="text-align: center;">${deleteBtn}</td>` : ''}
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;
        if (dayTotalEl) dayTotalEl.textContent = `Total: ${formatPeso(totalExp)}`;

        tbody.querySelectorAll('.delete-exp-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const name = e.currentTarget.getAttribute('data-name');
                if (confirm(`Delete expense "${name}"?`)) {
                    await DataService.deleteExpense(id);
                    showAlert(`Expense "${name}" removed.`, 'info');
                    loadExpensesList();
                }
            });
        });
    }

    // --- VIEW 6: REPORTS & OVERALL DAILY SUMMARY ---
    let reportDate = getTodayString();

    async function renderReportsView() {
        const dateInput = document.getElementById('reports-date-input');
        if (dateInput) {
            dateInput.value = reportDate;
        }

        const dateSubtitle = document.getElementById('reports-date-subtitle');
        const statementDate = document.getElementById('reports-statement-date');
        const printDate = document.getElementById('print-date-label');

        const formattedDate = formatDate(reportDate);
        if (dateSubtitle) dateSubtitle.textContent = `Daily Business Summary for ${formattedDate}`;
        if (statementDate) statementDate.textContent = formattedDate;
        if (printDate) printDate.textContent = `Report Date: ${formattedDate}`;

        const [transactions, expenses] = await Promise.all([
            DataService.getTransactions(reportDate),
            DataService.getExpenses(reportDate)
        ]);

        let waterGross = 0;
        let laundryGross = 0;
        let paidCollections = 0;
        let unpaidBalance = 0;
        let waterPaid = 0;
        let laundryPaid = 0;
        let waterUnpaid = 0;
        let laundryUnpaid = 0;

        transactions.forEach(t => {
            const amt = Number(t.totalAmount) || 0;
            const isPaid = t.paymentStatus === 'paid';
            if (t.businessCategory === 'water') {
                waterGross += amt;
                if (isPaid) waterPaid += amt;
                else waterUnpaid += amt;
            } else if (t.businessCategory === 'laundry') {
                laundryGross += amt;
                if (isPaid) laundryPaid += amt;
                else laundryUnpaid += amt;
            }

            if (isPaid) {
                paidCollections += amt;
            } else {
                unpaidBalance += amt;
            }
        });

        const totalGrossSales = waterGross + laundryGross;

        let waterExp = 0;
        let laundryExp = 0;
        let sharedExp = 0;
        const sharedItems = [];

        expenses.forEach(e => {
            const amt = Number(e.totalAmount) || 0;
            if (e.businessCategory === 'water') waterExp += amt;
            else if (e.businessCategory === 'laundry') laundryExp += amt;
            else {
                sharedExp += amt;
                sharedItems.push(e);
            }
        });

        const grandTotalExpenses = waterExp + laundryExp + sharedExp;
        const netCashFlow = paidCollections - grandTotalExpenses;
        const netProfit = totalGrossSales - grandTotalExpenses;

        const repWaterEl = document.getElementById('rep-water-sales');
        const repLaundryEl = document.getElementById('rep-laundry-sales');
        const repTotalSalesEl = document.getElementById('rep-total-sales');
        const repPaidEl = document.getElementById('rep-paid-collections');
        const repUnpaidEl = document.getElementById('rep-unpaid-balance');
        const repWaterPaidEl = document.getElementById('rep-water-paid');
        const repLaundryPaidEl = document.getElementById('rep-laundry-paid');
        const repWaterUnpaidEl = document.getElementById('rep-water-unpaid');
        const repLaundryUnpaidEl = document.getElementById('rep-laundry-unpaid');

        if (repWaterEl) repWaterEl.textContent = formatPeso(waterGross);
        if (repLaundryEl) repLaundryEl.textContent = formatPeso(laundryGross);
        if (repTotalSalesEl) repTotalSalesEl.textContent = formatPeso(totalGrossSales);
        if (repPaidEl) repPaidEl.textContent = formatPeso(paidCollections);
        if (repUnpaidEl) repUnpaidEl.textContent = formatPeso(unpaidBalance);
        if (repWaterPaidEl) repWaterPaidEl.textContent = formatPeso(waterPaid);
        if (repLaundryPaidEl) repLaundryPaidEl.textContent = formatPeso(laundryPaid);
        if (repWaterUnpaidEl) repWaterUnpaidEl.textContent = formatPeso(waterUnpaid);
        if (repLaundryUnpaidEl) repLaundryUnpaidEl.textContent = formatPeso(laundryUnpaid);

        document.getElementById('rep-water-exp').textContent = formatPeso(waterExp);
        document.getElementById('rep-laundry-exp').textContent = formatPeso(laundryExp);
        document.getElementById('rep-shared-exp').textContent = formatPeso(sharedExp);
        document.getElementById('rep-total-exp').textContent = formatPeso(grandTotalExpenses);

        const cashFlowEl = document.getElementById('rep-cash-flow');
        if (cashFlowEl) {
            cashFlowEl.textContent = formatPeso(netCashFlow);
            cashFlowEl.style.color = netCashFlow >= 0 ? 'var(--navy)' : 'var(--danger)';
        }

        const netValueEl = document.getElementById('rep-net-value');
        const netLabelEl = document.getElementById('rep-net-label');
        const netRowEl = document.getElementById('rep-net-row');

        if (netValueEl) netValueEl.textContent = formatPeso(netProfit);

        if (netProfit >= 0) {
            if (netLabelEl) netLabelEl.textContent = 'ESTIMATED NET PROFIT (Accrual)';
            if (netValueEl) {
                netValueEl.style.color = 'var(--success)';
                netValueEl.textContent = formatPeso(netProfit);
            }
            if (netRowEl) netRowEl.style.background = 'var(--success-bg)';
        } else {
            if (netLabelEl) netLabelEl.textContent = 'NET OPERATING DEFICIT';
            if (netValueEl) {
                netValueEl.style.color = 'var(--danger)';
                netValueEl.textContent = formatPeso(netProfit);
            }
            if (netRowEl) netRowEl.style.background = 'var(--danger-bg)';
        }

        const sharedTbody = document.getElementById('rep-shared-tbody');
        const sharedCountEl = document.getElementById('rep-shared-items-count');

        if (sharedTbody) {
            if (sharedItems.length === 0) {
                sharedTbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                            No shared business expenses recorded for this date.
                        </td>
                    </tr>
                `;
                if (sharedCountEl) sharedCountEl.textContent = '0 items';
            } else {
                if (sharedCountEl) sharedCountEl.textContent = `${sharedItems.length} item(s)`;
                let sHtml = '';
                sharedItems.forEach((item, idx) => {
                    sHtml += `
                        <tr>
                            <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                            <td style="font-weight: 500;">${escapeHtml(item.particular)}</td>
                            <td style="text-align: center; color: var(--text-secondary);">${item.quantity !== null && item.quantity !== undefined ? item.quantity : '--'}</td>
                            <td style="text-align: right; color: var(--text-secondary);">${item.unitPrice ? formatPeso(item.unitPrice) : '--'}</td>
                            <td style="text-align: right; font-weight: 600; color: var(--danger);">${formatPeso(item.totalAmount)}</td>
                        </tr>
                    `;
                });
                sharedTbody.innerHTML = sHtml;
            }
        }

        // 3. Render Left Card: Water Refilling Daily Transactions
        const waterTx = transactions.filter(t => t.businessCategory === 'water');
        let waterCardGross = 0;
        let waterCardPaid = 0;
        let waterCardUnpaid = 0;

        waterTx.forEach(t => {
            const amt = Number(t.totalAmount) || 0;
            waterCardGross += amt;
            if (t.paymentStatus === 'paid') waterCardPaid += amt;
            else waterCardUnpaid += amt;
        });

        const repWaterTbody = document.getElementById('rep-water-tx-tbody');
        const repWaterCountBadge = document.getElementById('rep-water-tx-count');
        const repWaterSummaryCount = document.getElementById('rep-water-summary-count');
        const repWaterSummaryGross = document.getElementById('rep-water-summary-gross');
        const repWaterSummaryPaid = document.getElementById('rep-water-summary-paid');
        const repWaterSummaryUnpaid = document.getElementById('rep-water-summary-unpaid');

        if (repWaterCountBadge) repWaterCountBadge.textContent = `${waterTx.length} records`;
        if (repWaterSummaryCount) repWaterSummaryCount.textContent = `${waterTx.length}`;
        if (repWaterSummaryGross) repWaterSummaryGross.textContent = formatPeso(waterCardGross);
        if (repWaterSummaryPaid) repWaterSummaryPaid.textContent = formatPeso(waterCardPaid);
        if (repWaterSummaryUnpaid) repWaterSummaryUnpaid.textContent = formatPeso(waterCardUnpaid);

        if (repWaterTbody) {
            if (waterTx.length === 0) {
                repWaterTbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                            No water transactions recorded for ${formattedDate}.
                        </td>
                    </tr>
                `;
            } else {
                let wHtml = '';
                waterTx.forEach((t, idx) => {
                    const amt = Number(t.totalAmount) || 0;
                    const itemsText = (t.items || []).map(it => `${it.itemName} (${it.quantity} × ${formatPeso(it.unitPrice)})`).join(', ') || 'Refill';
                    const statusBadge = t.paymentStatus === 'paid'
                        ? `<button type="button" class="badge badge-paid toggle-payment" data-id="${t.id}" data-status="paid" style="border:none; cursor:pointer;" title="Click to change payment status">Paid</button>`
                        : `<button type="button" class="badge badge-unpaid toggle-payment" data-id="${t.id}" data-status="unpaid" style="border:none; cursor:pointer;" title="Click to mark as paid">Unpaid</button>`;

                    wHtml += `
                        <tr>
                            <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                            <td style="color: var(--text-secondary);">${escapeHtml(t.transactionTime || '--:--')}</td>
                            <td style="font-weight: 500;">
                                ${escapeHtml(t.customerName || 'Walk-in')}
                                <div style="font-size: 0.72rem; color: var(--text-secondary);">${escapeHtml(t.transactionCode || '')}${t.notes ? ` — ${escapeHtml(t.notes)}` : ''}</div>
                            </td>
                            <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(itemsText)}</td>
                            <td style="text-align: right; font-weight: 600; color: var(--navy);">${formatPeso(amt)}</td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                });
                repWaterTbody.innerHTML = wHtml;
                repWaterTbody.querySelectorAll('.toggle-payment').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        const status = e.currentTarget.getAttribute('data-status');
                        await DataService.togglePaymentStatus(id, status);
                        renderReportsView();
                    });
                });
            }
        }

        // 4. Render Right Card: Laundry Daily Transactions
        const laundryTx = transactions.filter(t => t.businessCategory === 'laundry');
        let laundryCardGross = 0;
        let laundryCardPaid = 0;
        let laundryCardUnpaid = 0;

        laundryTx.forEach(t => {
            const amt = Number(t.totalAmount) || 0;
            laundryCardGross += amt;
            if (t.paymentStatus === 'paid') laundryCardPaid += amt;
            else laundryCardUnpaid += amt;
        });

        const repLaundryTbody = document.getElementById('rep-laundry-tx-tbody');
        const repLaundryCountBadge = document.getElementById('rep-laundry-tx-count');
        const repLaundrySummaryCount = document.getElementById('rep-laundry-summary-count');
        const repLaundrySummaryGross = document.getElementById('rep-laundry-summary-gross');
        const repLaundrySummaryPaid = document.getElementById('rep-laundry-summary-paid');
        const repLaundrySummaryUnpaid = document.getElementById('rep-laundry-summary-unpaid');

        if (repLaundryCountBadge) repLaundryCountBadge.textContent = `${laundryTx.length} records`;
        if (repLaundrySummaryCount) repLaundrySummaryCount.textContent = `${laundryTx.length}`;
        if (repLaundrySummaryGross) repLaundrySummaryGross.textContent = formatPeso(laundryCardGross);
        if (repLaundrySummaryPaid) repLaundrySummaryPaid.textContent = formatPeso(laundryCardPaid);
        if (repLaundrySummaryUnpaid) repLaundrySummaryUnpaid.textContent = formatPeso(laundryCardUnpaid);

        if (repLaundryTbody) {
            if (laundryTx.length === 0) {
                repLaundryTbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                            No laundry transactions recorded for ${formattedDate}.
                        </td>
                    </tr>
                `;
            } else {
                let lHtml = '';
                laundryTx.forEach((t, idx) => {
                    const amt = Number(t.totalAmount) || 0;
                    const itemsText = (t.items || []).map(it => `${it.itemName} (${it.quantity} × ${formatPeso(it.unitPrice)})`).join(', ') || 'Laundry';
                    const statusBadge = t.paymentStatus === 'paid'
                        ? `<button type="button" class="badge badge-paid toggle-payment" data-id="${t.id}" data-status="paid" style="border:none; cursor:pointer;" title="Click to change payment status">Paid</button>`
                        : `<button type="button" class="badge badge-unpaid toggle-payment" data-id="${t.id}" data-status="unpaid" style="border:none; cursor:pointer;" title="Click to mark as paid">Unpaid</button>`;

                    lHtml += `
                        <tr>
                            <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                            <td style="color: var(--text-secondary);">${escapeHtml(t.transactionTime || '--:--')}</td>
                            <td style="font-weight: 500;">
                                ${escapeHtml(t.customerName || 'Customer')}
                                <div style="font-size: 0.72rem; color: var(--text-secondary);">${escapeHtml(t.transactionCode || '')}${t.notes ? ` — ${escapeHtml(t.notes)}` : ''}</div>
                            </td>
                            <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(itemsText)}</td>
                            <td style="text-align: right; font-weight: 600; color: var(--navy);">${formatPeso(amt)}</td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                });
                repLaundryTbody.innerHTML = lHtml;
                repLaundryTbody.querySelectorAll('.toggle-payment').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        const status = e.currentTarget.getAttribute('data-status');
                        await DataService.togglePaymentStatus(id, status);
                        renderReportsView();
                    });
                });
            }
        }
    }

    async function exportReportCsv() {
        const [transactions, expenses] = await Promise.all([
            DataService.getTransactions(reportDate),
            DataService.getExpenses(reportDate)
        ]);

        let csvContent = '\uFEFF';

        csvContent += 'PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM\n';
        csvContent += `Daily Business Report Date: ${reportDate}\n\n`;

        // 1. Water
        csvContent += '--- WATER REFILLING TRANSACTIONS ---\n';
        csvContent += 'No.,Time,Code,Customer,Items,Amount,Status\n';
        const waterTx = transactions.filter(t => t.businessCategory === 'water');
        let waterSum = 0;
        waterTx.forEach((t, i) => {
            const amt = Number(t.totalAmount) || 0;
            waterSum += amt;
            const items = (t.items || []).map(it => `${it.itemName} (${it.quantity})`).join('; ');
            csvContent += `"${i + 1}","${t.transactionTime || ''}","${t.transactionCode}","${cleanCsv(t.customerName)}","${cleanCsv(items)}","${amt.toFixed(2)}","${t.paymentStatus}"\n`;
        });
        csvContent += `,,,Total Water Sales,,${waterSum.toFixed(2)},\n\n`;

        // 2. Laundry
        csvContent += '--- LAUNDRY TRANSACTIONS ---\n';
        csvContent += 'No.,Time,Code,Customer,Items,Amount,Status\n';
        const laundryTx = transactions.filter(t => t.businessCategory === 'laundry');
        let laundrySum = 0;
        laundryTx.forEach((t, i) => {
            const amt = Number(t.totalAmount) || 0;
            laundrySum += amt;
            const items = (t.items || []).map(it => `${it.itemName} (${it.quantity})`).join('; ');
            csvContent += `"${i + 1}","${t.transactionTime || ''}","${t.transactionCode}","${cleanCsv(t.customerName)}","${cleanCsv(items)}","${amt.toFixed(2)}","${t.paymentStatus}"\n`;
        });
        csvContent += `,,,Total Laundry Sales,,${laundrySum.toFixed(2)},\n\n`;

        // 3. Expenses
        csvContent += '--- BUSINESS EXPENSES ---\n';
        csvContent += 'No.,Category,Description,Quantity,Unit Price,Total Amount,Notes\n';
        let expSum = 0;
        expenses.forEach((e, i) => {
            const amt = Number(e.totalAmount) || 0;
            expSum += amt;
            csvContent += `"${i + 1}","${e.businessCategory}","${cleanCsv(e.particular)}","${e.quantity || ''}","${e.unitPrice ? e.unitPrice.toFixed(2) : ''}","${amt.toFixed(2)}","${cleanCsv(e.notes || '')}"\n`;
        });
        csvContent += `,,,,,Total Expenses,${expSum.toFixed(2)}\n\n`;

        // 4. Financial Summary
        const totalGrossSales = waterSum + laundrySum;
        const totalPaid = transactions.filter(t => t.paymentStatus === 'paid').reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
        const totalUnpaid = transactions.filter(t => t.paymentStatus === 'unpaid').reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
        const netCashFlow = totalPaid - expSum;
        const netProfit = totalGrossSales - expSum;

        csvContent += '--- FINANCIAL SUMMARY ---\n';
        csvContent += `Gross Water Refilling Sales,${waterSum.toFixed(2)}\n`;
        csvContent += `Gross Laundry Shop Sales,${laundrySum.toFixed(2)}\n`;
        csvContent += `TOTAL GROSS SALES (Services Sold),${totalGrossSales.toFixed(2)}\n`;
        csvContent += `Paid Sales / Collections (Actual Cash),${totalPaid.toFixed(2)}\n`;
        csvContent += `Unpaid Balance (Customer Receivables),${totalUnpaid.toFixed(2)}\n`;
        csvContent += `GRAND TOTAL EXPENSES,${expSum.toFixed(2)}\n`;
        csvContent += `NET CASH FLOW (Collections - Expenses),${netCashFlow.toFixed(2)}\n`;
        csvContent += `ESTIMATED NET PROFIT (Accrual),${netProfit.toFixed(2)}\n`;


        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Pazings_Summary_${reportDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function cleanCsv(text) {
        if (!text) return '';
        return String(text).replace(/"/g, '""');
    }

    // --- VIEW 7: CUSTOMERS (OWNER ONLY) ---
    async function renderCustomersView() {
        const tbody = document.getElementById('customers-tbody');
        const datalist = document.getElementById('customer-datalist');
        if (!tbody) return;

        const customers = await DataService.getCustomers();

        if (datalist) {
            datalist.innerHTML = customers.map(c => `<option value="${escapeHtml(c.name)}">`).join('');
        }

        if (customers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                        No customer records created yet. Customers are automatically indexed when transactions are recorded.
                    </td>
                </tr>
            `;
            return;
        }

        let rowsHtml = '';
        customers.forEach((c, idx) => {
            rowsHtml += `
                <tr>
                    <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                    <td style="font-weight: 500;">${escapeHtml(c.name)}</td>
                    <td style="color: var(--text-secondary);">${escapeHtml(c.contactNumber || '--')}</td>
                    <td style="color: var(--text-secondary);">${escapeHtml(c.address || '--')}</td>
                    <td style="text-align: center;">${c.totalOrders || 1}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--navy);">${formatPeso(c.lifetimeSpend || 0)}</td>
                    <td style="color: var(--text-secondary);">${formatDate(c.lastOrderDate) || '--'}</td>
                </tr>
            `;
        });
        tbody.innerHTML = rowsHtml;
    }

    // --- VIEW 8: SERVICE RATES (OWNER ONLY) ---
    async function renderRatesView() {
        await DataService.getServices();
        const waterTbody = document.getElementById('rates-water-tbody');
        const laundryTbody = document.getElementById('rates-laundry-tbody');
        const waterCountEl = document.getElementById('rates-water-count');
        const laundryCountEl = document.getElementById('rates-laundry-count');

        const waterServices = AppState.services.filter(s => s.category === 'water');
        const laundryServices = AppState.services.filter(s => s.category === 'laundry');

        if (waterCountEl) waterCountEl.textContent = `${waterServices.length} items`;
        if (laundryCountEl) laundryCountEl.textContent = `${laundryServices.length} items`;

        if (waterTbody) {
            if (waterServices.length === 0) {
                waterTbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                            No water services found. Click "+ Add New Service" above to add one.
                        </td>
                    </tr>
                `;
            } else {
                let wHtml = '';
                waterServices.forEach(s => {
                    const statusBadge = s.isActive !== false
                        ? `<button type="button" class="badge badge-paid toggle-srv-btn" data-id="${s.id}" title="Click to toggle status" style="border:none; cursor:pointer;">Active</button>`
                        : `<button type="button" class="badge badge-unpaid toggle-srv-btn" data-id="${s.id}" title="Click to toggle status" style="border:none; cursor:pointer;">Inactive</button>`;

                    wHtml += `
                        <tr>
                            <td style="font-weight: 500;">${escapeHtml(s.serviceName)}</td>
                            <td><code>${escapeHtml(s.serviceCode)}</code></td>
                            <td>
                                <input type="number" step="0.50" min="0" class="form-control form-control-sm rate-input"
                                       data-service-id="${s.id}" value="${Number(s.defaultRate).toFixed(2)}" style="max-width: 120px;">
                            </td>
                            <td style="color: var(--text-secondary);">${escapeHtml(s.unitLabel || 'bottle')}</td>
                            <td style="text-align: center;">${statusBadge}</td>
                            <td style="text-align: center;">
                                <div style="display: flex; gap: 4px; justify-content: center;">
                                    <button type="button" class="btn btn-secondary btn-sm edit-srv-btn" data-id="${s.id}">Edit</button>
                                    <button type="button" class="btn btn-danger btn-sm delete-srv-btn" data-id="${s.id}" data-name="${escapeHtml(s.serviceName)}">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                waterTbody.innerHTML = wHtml;
            }
        }

        if (laundryTbody) {
            if (laundryServices.length === 0) {
                laundryTbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                            No laundry services found. Click "+ Add New Service" above to add one.
                        </td>
                    </tr>
                `;
            } else {
                let lHtml = '';
                laundryServices.forEach(s => {
                    const statusBadge = s.isActive !== false
                        ? `<button type="button" class="badge badge-paid toggle-srv-btn" data-id="${s.id}" title="Click to toggle status" style="border:none; cursor:pointer;">Active</button>`
                        : `<button type="button" class="badge badge-unpaid toggle-srv-btn" data-id="${s.id}" title="Click to toggle status" style="border:none; cursor:pointer;">Inactive</button>`;

                    lHtml += `
                        <tr>
                            <td style="font-weight: 500;">${escapeHtml(s.serviceName)}</td>
                            <td><code>${escapeHtml(s.serviceCode)}</code></td>
                            <td>
                                <input type="number" step="0.50" min="0" class="form-control form-control-sm rate-input"
                                       data-service-id="${s.id}" value="${Number(s.defaultRate).toFixed(2)}" style="max-width: 120px;">
                            </td>
                            <td style="color: var(--text-secondary);">${escapeHtml(s.unitLabel || 'load')}</td>
                            <td style="text-align: center;">${statusBadge}</td>
                            <td style="text-align: center;">
                                <div style="display: flex; gap: 4px; justify-content: center;">
                                    <button type="button" class="btn btn-secondary btn-sm edit-srv-btn" data-id="${s.id}">Edit</button>
                                    <button type="button" class="btn btn-danger btn-sm delete-srv-btn" data-id="${s.id}" data-name="${escapeHtml(s.serviceName)}">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                laundryTbody.innerHTML = lHtml;
            }
        }

        attachRatesActionListeners();
    }

    function attachRatesActionListeners() {
        // Toggle Active
        document.querySelectorAll('.toggle-srv-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const updated = await DataService.toggleServiceActive(id);
                if (updated) {
                    showAlert(`Service "${updated.serviceName}" is now ${updated.isActive ? 'Active' : 'Inactive'}.`, 'info');
                    renderRatesView();
                    renderWaterFormFields();
                    renderLaundryFormFields();
                }
            });
        });

        // Edit Service Button
        document.querySelectorAll('.edit-srv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const s = AppState.services.find(item => item.id === id);
                if (!s) return;

                document.getElementById('edit-srv-id').value = s.id;
                document.getElementById('edit-srv-name').value = s.serviceName;
                document.getElementById('edit-srv-rate').value = s.defaultRate;
                document.getElementById('edit-srv-unit').value = s.unitLabel || '';
                document.getElementById('edit-srv-status').value = s.isActive !== false ? 'true' : 'false';

                const modal = document.getElementById('edit-service-modal');
                if (modal) modal.style.display = 'flex';
            });
        });

        // Delete Service Button
        document.querySelectorAll('.delete-srv-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const name = e.currentTarget.getAttribute('data-name');
                if (confirm(`Are you sure you want to remove or deactivate service "${name}"?`)) {
                    const res = await DataService.deleteService(id);
                    showAlert(res.message, res.deleted ? 'info' : 'warning');
                    renderRatesView();
                    renderWaterFormFields();
                    renderLaundryFormFields();
                }
            });
        });
    }

    // --- VIEW 9: STAFF MANAGEMENT (OWNER ONLY) ---
    async function renderStaffView() {
        const tbody = document.getElementById('staff-tbody');
        if (!tbody) return;

        const users = await DataService.getUsers();

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-secondary);">
                        No accounts registered.
                    </td>
                </tr>
            `;
            return;
        }

        let rowsHtml = '';
        users.forEach((u, idx) => {
            const roleBadge = u.role === 'owner'
                ? '<span class="badge" style="background: var(--navy); color: #fff;">Owner</span>'
                : '<span class="badge" style="background: var(--blue-light); color: var(--blue);">Staff</span>';

            const statusBadge = u.status === 'active'
                ? '<span class="badge badge-paid">Active</span>'
                : '<span class="badge badge-unpaid">Inactive</span>';

            rowsHtml += `
                <tr>
                    <td style="color: var(--text-secondary); text-align: center;">${idx + 1}</td>
                    <td style="font-weight: 500;">${escapeHtml(u.fullName || '')}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td><span class="badge">4-Digit PIN</span></td>
                </tr>
            `;
        });
        tbody.innerHTML = rowsHtml;
    }

    // ============================================================
    // 5. Form Handlers & Event Listeners
    // ============================================================

    function setupFormHandlers() {
        // 1. Role Selection & PIN Authentication
        setupAccountPinHandlers();

        // 2. Water Refilling Form
        const waterForm = document.getElementById('water-form');
        if (waterForm) {
            waterForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const date = document.getElementById('water-date').value || getTodayString();
                const customer = document.getElementById('water-customer').value.trim();
                const payStatus = document.getElementById('water-payment-status').value;
                const notes = document.getElementById('water-notes').value.trim();

                const items = [];
                let total = 0;

                // Collect from dynamically generated active water service inputs
                document.querySelectorAll('#water-services-container .water-input').forEach(inp => {
                    const qty = Number(inp.value) || 0;
                    if (qty > 0) {
                        const srvId = inp.getAttribute('data-service-id');
                        const srvName = inp.getAttribute('data-service-name');
                        const srvRate = Number(inp.getAttribute('data-service-rate')) || 0;
                        const sub = qty * srvRate;
                        items.push({
                            serviceId: srvId,
                            itemName: srvName,
                            quantity: qty,
                            unitPrice: srvRate,
                            subtotal: sub
                        });
                        total += sub;
                    }
                });

                // Extra ad-hoc item if specified
                const exName = document.getElementById('water-extra-name')?.value.trim();
                const exQty = Number(document.getElementById('water-extra-qty')?.value) || 0;
                const exPrice = Number(document.getElementById('water-extra-price')?.value) || 0;
                if (exName && exQty > 0 && exPrice >= 0) {
                    const sub = exQty * exPrice;
                    items.push({
                        serviceId: 'extra_adhoc',
                        itemName: exName,
                        quantity: exQty,
                        unitPrice: exPrice,
                        subtotal: sub
                    });
                    total += sub;
                }

                if (items.length === 0) {
                    showAlert('Please enter at least one quantity for the selected services.', 'danger');
                    return;
                }

                const saveBtn = document.getElementById('water-save-btn');
                if (saveBtn) saveBtn.disabled = true;

                const created = await DataService.addTransaction({
                    businessCategory: 'water',
                    transactionDate: date,
                    customerName: customer || 'Walk-in Customer',
                    totalAmount: total,
                    paymentStatus: payStatus,
                    items,
                    notes
                });

                if (saveBtn) saveBtn.disabled = false;

                // Reset quantities
                document.querySelectorAll('#water-services-container .water-input').forEach(inp => inp.value = '');
                if (document.getElementById('water-extra-qty')) document.getElementById('water-extra-qty').value = '';
                if (document.getElementById('water-extra-price')) document.getElementById('water-extra-price').value = '';
                if (document.getElementById('water-extra-name')) document.getElementById('water-extra-name').value = '';
                document.getElementById('water-customer').value = '';
                document.getElementById('water-notes').value = '';
                calculateWaterTotal();

                waterFilterDate = date;
                const waterFilterInput = document.getElementById('water-filter-date');
                if (waterFilterInput) waterFilterInput.value = date;
                reportDate = date;
                const repDateInput = document.getElementById('reports-date-input');
                if (repDateInput) repDateInput.value = date;

                loadWaterTransactions();
                renderCustomersView();
                showAlert(`Saved water transaction ${created.transactionCode} (${formatPeso(total)})`, 'success');
            });
        }

        const waterFilterBtn = document.getElementById('water-filter-btn');
        const waterTodayBtn = document.getElementById('water-today-btn');
        if (waterFilterBtn) {
            waterFilterBtn.addEventListener('click', () => {
                const val = document.getElementById('water-filter-date').value;
                if (val) {
                    waterFilterDate = val;
                    loadWaterTransactions();
                }
            });
        }
        if (waterTodayBtn) {
            waterTodayBtn.addEventListener('click', () => {
                waterFilterDate = getTodayString();
                const filterInput = document.getElementById('water-filter-date');
                if (filterInput) filterInput.value = waterFilterDate;
                loadWaterTransactions();
            });
        }

        // 3. Laundry Form
        const laundryForm = document.getElementById('laundry-form');
        if (laundryForm) {
            laundryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const date = document.getElementById('laundry-date').value || getTodayString();
                const customer = document.getElementById('laundry-customer').value.trim();
                const payStatus = document.getElementById('laundry-payment-status').value;
                const notes = document.getElementById('laundry-notes').value.trim();

                if (!customer) {
                    showAlert('Please enter customer name.', 'danger');
                    return;
                }

                const items = [];
                let total = 0;

                // Collect from dynamically generated active laundry service inputs
                document.querySelectorAll('#laundry-services-container .laundry-input').forEach(inp => {
                    const qty = Number(inp.value) || 0;
                    if (qty > 0) {
                        const srvId = inp.getAttribute('data-service-id');
                        const srvName = inp.getAttribute('data-service-name');
                        const srvRate = Number(inp.getAttribute('data-service-rate')) || 0;
                        const sub = qty * srvRate;
                        items.push({
                            serviceId: srvId,
                            itemName: srvName,
                            quantity: qty,
                            unitPrice: srvRate,
                            subtotal: sub
                        });
                        total += sub;
                    }
                });

                if (items.length === 0) {
                    showAlert('Please enter at least one quantity for the selected laundry services or supplies.', 'danger');
                    return;
                }

                const saveBtn = document.getElementById('laundry-save-btn');
                if (saveBtn) saveBtn.disabled = true;

                const created = await DataService.addTransaction({
                    businessCategory: 'laundry',
                    transactionDate: date,
                    customerName: customer,
                    totalAmount: total,
                    paymentStatus: payStatus,
                    items,
                    notes
                });

                if (saveBtn) saveBtn.disabled = false;

                document.querySelectorAll('#laundry-services-container .laundry-input').forEach(inp => inp.value = '');
                document.getElementById('laundry-customer').value = '';
                document.getElementById('laundry-notes').value = '';
                calculateLaundryTotal();

                laundryFilterDate = date;
                const laundryFilterInput = document.getElementById('laundry-filter-date');
                if (laundryFilterInput) laundryFilterInput.value = date;
                reportDate = date;
                const repDateInput = document.getElementById('reports-date-input');
                if (repDateInput) repDateInput.value = date;

                loadLaundryTransactions();
                renderCustomersView();
                showAlert(`Saved laundry transaction ${created.transactionCode} (${formatPeso(total)})`, 'success');
            });
        }

        const laundryFilterBtn = document.getElementById('laundry-filter-btn');
        const laundryTodayBtn = document.getElementById('laundry-today-btn');
        if (laundryFilterBtn) {
            laundryFilterBtn.addEventListener('click', () => {
                const val = document.getElementById('laundry-filter-date').value;
                if (val) {
                    laundryFilterDate = val;
                    loadLaundryTransactions();
                }
            });
        }
        if (laundryTodayBtn) {
            laundryTodayBtn.addEventListener('click', () => {
                laundryFilterDate = getTodayString();
                const filterInput = document.getElementById('laundry-filter-date');
                if (filterInput) filterInput.value = laundryFilterDate;
                loadLaundryTransactions();
            });
        }

        // 4. Expenses Form
        const expQty = document.getElementById('expense-qty');
        const expUnitPrice = document.getElementById('expense-unit-price');
        const expAmount = document.getElementById('expense-amount');

        function checkComputeExpense() {
            const q = Number(expQty?.value);
            const p = Number(expUnitPrice?.value);
            if (q > 0 && p > 0 && expAmount) {
                expAmount.value = (q * p).toFixed(2);
            }
        }
        if (expQty) expQty.addEventListener('input', checkComputeExpense);
        if (expUnitPrice) expUnitPrice.addEventListener('input', checkComputeExpense);

        const expensesForm = document.getElementById('expenses-form');
        if (expensesForm) {
            expensesForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const date = document.getElementById('expense-date').value || getTodayString();
                const cat = document.getElementById('expense-category').value;
                const particular = document.getElementById('expense-particular').value.trim();
                const q = expQty.value.trim() !== '' ? Number(expQty.value) : null;
                const p = expUnitPrice.value.trim() !== '' ? Number(expUnitPrice.value) : null;
                const amount = Number(expAmount.value) || 0;
                const notes = document.getElementById('expense-notes').value.trim();

                if (!particular) {
                    showAlert('Please enter an expense description.', 'danger');
                    return;
                }
                if (amount <= 0) {
                    showAlert('Please enter a valid expense total amount.', 'danger');
                    return;
                }

                const saveBtn = document.getElementById('expense-save-btn');
                if (saveBtn) saveBtn.disabled = true;

                await DataService.addExpense({
                    expenseDate: date,
                    businessCategory: cat,
                    particular,
                    quantity: q,
                    unitPrice: p,
                    totalAmount: amount,
                    notes
                });

                if (saveBtn) saveBtn.disabled = false;

                document.getElementById('expense-particular').value = '';
                expQty.value = '';
                expUnitPrice.value = '';
                expAmount.value = '';
                document.getElementById('expense-notes').value = '';

                expensesFilterDate = date;
                const expFilterInput = document.getElementById('expenses-filter-date');
                if (expFilterInput) expFilterInput.value = date;
                reportDate = date;
                const repDateInput = document.getElementById('reports-date-input');
                if (repDateInput) repDateInput.value = date;

                loadExpensesList();
                showAlert(`Saved expense "${particular}" (${formatPeso(amount)})`, 'success');
            });
        }

        const expFilterBtn = document.getElementById('expenses-filter-btn');
        const expTodayBtn = document.getElementById('expenses-today-btn');
        if (expFilterBtn) {
            expFilterBtn.addEventListener('click', () => {
                expensesFilterDate = document.getElementById('expenses-filter-date').value || getTodayString();
                expensesFilterCat = document.getElementById('expenses-filter-category').value || 'all';
                loadExpensesList();
            });
        }
        if (expTodayBtn) {
            expTodayBtn.addEventListener('click', () => {
                expensesFilterDate = getTodayString();
                expensesFilterCat = 'all';
                document.getElementById('expenses-filter-date').value = expensesFilterDate;
                document.getElementById('expenses-filter-category').value = 'all';
                loadExpensesList();
            });
        }

        // 5. Reports Controls
        const repLoadBtn = document.getElementById('reports-load-btn');
        const repTodayBtn = document.getElementById('reports-today-btn');
        const repCsvBtn = document.getElementById('reports-export-csv-btn');

        if (repLoadBtn) {
            repLoadBtn.addEventListener('click', () => {
                const val = document.getElementById('reports-date-input').value;
                if (val) {
                    reportDate = val;
                    renderReportsView();
                }
            });
        }
        if (repTodayBtn) {
            repTodayBtn.addEventListener('click', () => {
                reportDate = getTodayString();
                const dateInput = document.getElementById('reports-date-input');
                if (dateInput) dateInput.value = reportDate;
                renderReportsView();
            });
        }
        if (repCsvBtn) {
            repCsvBtn.addEventListener('click', () => {
                exportReportCsv();
            });
        }

        // 6. Rates Form & Modals (Owner only)
        const ratesForm = document.getElementById('rates-form');
        if (ratesForm) {
            ratesForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newRatesMap = {};
                document.querySelectorAll('.rate-input').forEach(inp => {
                    const srvId = inp.getAttribute('data-service-id');
                    const val = Number(inp.value) || 0;
                    if (srvId) {
                        newRatesMap[srvId] = val;
                    }
                });
                await DataService.saveRates(newRatesMap);
                showAlert('Service rates updated successfully.', 'success');
                renderRatesView();
                renderWaterFormFields();
                renderLaundryFormFields();
            });
        }

        // Add Service Modal Controls
        const btnOpenAddService = document.getElementById('btn-open-add-service');
        const addServiceModal = document.getElementById('add-service-modal');
        const closeAddServiceBtn = document.getElementById('close-add-service-btn');
        const cancelAddServiceBtn = document.getElementById('cancel-add-service-btn');
        const addServiceForm = document.getElementById('add-service-form');

        if (btnOpenAddService && addServiceModal) {
            btnOpenAddService.addEventListener('click', () => {
                addServiceModal.style.display = 'flex';
                const nameInput = document.getElementById('new-srv-name');
                if (nameInput) nameInput.focus();
            });
        }

        const closeAddModal = () => {
            if (addServiceModal) addServiceModal.style.display = 'none';
            if (addServiceForm) addServiceForm.reset();
        };

        if (closeAddServiceBtn) closeAddServiceBtn.addEventListener('click', closeAddModal);
        if (cancelAddServiceBtn) cancelAddServiceBtn.addEventListener('click', closeAddModal);

        if (addServiceForm) {
            addServiceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const category = document.getElementById('new-srv-category').value;
                const name = document.getElementById('new-srv-name').value.trim();
                const code = document.getElementById('new-srv-code').value.trim();
                const unit = document.getElementById('new-srv-unit').value.trim();
                const rate = Number(document.getElementById('new-srv-rate').value) || 0;

                try {
                    const created = await DataService.addService({
                        category,
                        serviceName: name,
                        serviceCode: code,
                        unitLabel: unit,
                        defaultRate: rate,
                        isActive: true
                    });
                    showAlert(`Service "${created.serviceName}" added successfully.`, 'success');
                    closeAddModal();
                    renderRatesView();
                    renderWaterFormFields();
                    renderLaundryFormFields();
                } catch (err) {
                    showAlert(err.message || 'Error adding new service.', 'danger');
                }
            });
        }

        // Edit Service Modal Controls
        const editServiceModal = document.getElementById('edit-service-modal');
        const closeEditServiceBtn = document.getElementById('close-edit-service-btn');
        const cancelEditServiceBtn = document.getElementById('cancel-edit-service-btn');
        const editServiceForm = document.getElementById('edit-service-form');

        const closeEditModal = () => {
            if (editServiceModal) editServiceModal.style.display = 'none';
            if (editServiceForm) editServiceForm.reset();
        };

        if (closeEditServiceBtn) closeEditServiceBtn.addEventListener('click', closeEditModal);
        if (cancelEditServiceBtn) cancelEditServiceBtn.addEventListener('click', closeEditModal);

        if (editServiceForm) {
            editServiceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-srv-id').value;
                const name = document.getElementById('edit-srv-name').value.trim();
                const rate = Number(document.getElementById('edit-srv-rate').value) || 0;
                const unit = document.getElementById('edit-srv-unit').value.trim();
                const status = document.getElementById('edit-srv-status').value === 'true';

                try {
                    const updated = await DataService.updateService(id, {
                        serviceName: name,
                        defaultRate: rate,
                        unitLabel: unit,
                        isActive: status
                    });
                    showAlert(`Service "${updated.serviceName}" updated successfully.`, 'success');
                    closeEditModal();
                    renderRatesView();
                    renderWaterFormFields();
                    renderLaundryFormFields();
                } catch (err) {
                    showAlert(err.message || 'Error updating service.', 'danger');
                }
            });
        }

        // 7. Staff Account Creation (Owner only)
        const newStaffForm = document.getElementById('create-staff-form');
        if (newStaffForm) {
            newStaffForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('new-staff-name').value.trim();
                const pin = document.getElementById('new-staff-pin').value.trim();
                const role = document.getElementById('new-staff-role').value;

                if (!/^\d{4}$/.test(pin)) {
                    showAlert('Enter a valid 4-digit PIN.', 'danger');
                    return;
                }

                try {
                    await DataService.createUser(name, pin, role);
                    showAlert(`Account for ${name} (${role}) created successfully.`, 'success');
                    newStaffForm.reset();
                    renderStaffView();
                } catch (err) {
                    showAlert(err.message || 'Error creating staff account.', 'danger');
                }
            });
        }

    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ============================================================
    // 6. Application Startup & Initialization
    // ============================================================

    async function refreshActiveView() {
        if (!AppState.currentUser || !AppState.deviceUnlocked || AppState.currentView === 'login') return;
        switch (AppState.currentView) {
            case 'dashboard':
                await renderDashboard();
                break;
            case 'water':
                await DataService.getServices();
                renderWaterFormFields();
                calculateWaterTotal();
                await loadWaterTransactions();
                break;
            case 'laundry':
                await DataService.getServices();
                renderLaundryFormFields();
                calculateLaundryTotal();
                await loadLaundryTransactions();
                break;
            case 'expenses':
                await loadExpensesList();
                break;
            case 'reports':
                await renderReportsView();
                break;
            case 'customers':
                await renderCustomersView();
                break;
            case 'rates':
                await renderRatesView();
                break;
            case 'staff':
                await renderStaffView();
                break;
        }
    }

    async function initializeAppEngine() {
        setupNavigation();
        setupFormHandlers();
        localStorage.removeItem('pazings_session_user');
        localStorage.removeItem('pazings_device_pin');
        localStorage.removeItem('pazings_device_pin_attempts');

        if (syncChannel) {
            syncChannel.onmessage = () => {
                refreshActiveView();
            };
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('storage', (e) => {
                if (e.key === 'pazings_sync_signal') {
                    refreshActiveView();
                }
            });
            window.addEventListener('focus', () => {
                refreshActiveView();
            });
        }

        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    refreshActiveView();
                }
            });
        }

        try {
            const user = await DataService.initAuth();
            if (user) {
                AppState.deviceUnlocked = true;
                resetAllDatesToToday();
                updateUserInfoHeader();
                await DataService.getRates();
                switchView('dashboard');
                return;
            }
            switchView('login');
        } catch (error) {
            switchView('login');
            showAlert(error.message || 'Unable to connect to the shared database.', 'danger', 8000);
        }
    }

    // Expose for testing and developer inspection
    if (typeof window !== 'undefined') {
        window.AppState = AppState;
        window.DataService = DataService;
    }

    // Handle DOM ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeAppEngine);
        } else {
            initializeAppEngine();
        }
    }
})();
