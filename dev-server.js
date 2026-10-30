const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const apiHandler = require('./api/index.js');

function loadEnvFile(filename) {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = val;
        }
    }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const PUBLIC_DIR = path.join(__dirname, 'public');
const LOCAL_DB_PATH = path.join(__dirname, '.local-db.json');

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

function getDefaultLocalDb() {
    return {
        users: [
            {
                id: 'local-owner-1',
                fullName: 'Business Owner',
                role: 'owner',
                status: 'active',
                pin: '5555',
                hasPin: true
            },
            {
                id: 'local-staff-1',
                fullName: 'Store Staff',
                role: 'staff',
                status: 'active',
                pin: '1111',
                hasPin: true
            }
        ],
        sessions: {},
        services: JSON.parse(JSON.stringify(DEFAULT_SERVICES)),
        transactions: [],
        expenses: [],
        customers: []
    };
}

function readLocalDb() {
    try {
        if (fs.existsSync(LOCAL_DB_PATH)) {
            const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
            if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.services)) {
                let cleaned = false;
                parsed.users.forEach(u => {
                    if ('email' in u || 'password' in u) {
                        delete u.email;
                        delete u.password;
                        cleaned = true;
                    }
                });
                if (cleaned) writeLocalDb(parsed);
                return parsed;
            }
        }
    } catch (e) {
        // Fallback to default local DB
    }
    const initial = getDefaultLocalDb();
    writeLocalDb(initial);
    return initial;
}

function writeLocalDb(db) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function recalculateCustomers(db) {
    const map = new Map();
    for (const c of (db.customers || [])) {
        map.set(c.name.toLowerCase(), {
            ...c,
            totalOrders: 0,
            lifetimeSpend: 0,
            lastOrderDate: null
        });
    }

    for (const tx of (db.transactions || [])) {
        const name = String(tx.customerName || '').trim();
        if (!name || name.toLowerCase() === 'walk-in customer' || name.toLowerCase() === 'walk-in') {
            continue;
        }
        const key = name.toLowerCase();
        const existing = map.get(key) || {
            id: 'cust_' + crypto.randomUUID(),
            name,
            contactNumber: '',
            address: '',
            totalOrders: 0,
            lifetimeSpend: 0,
            lastOrderDate: null
        };
        existing.name = name;
        existing.totalOrders += 1;
        existing.lifetimeSpend += Number(tx.totalAmount) || 0;
        if (!existing.lastOrderDate || tx.transactionDate > existing.lastOrderDate) {
            existing.lastOrderDate = tx.transactionDate;
        }
        map.set(key, existing);
    }

    db.customers = Array.from(map.values())
        .filter(c => c.totalOrders > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
}

function hasSupabaseEnv() {
    return Boolean(
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

function handleLocalApi(req, res, body) {
    const db = readLocalDb();
    const action = body?.action;
    const payload = body?.payload || {};
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const sendJson = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    };

    const getAuthenticatedUser = () => {
        const userId = db.sessions[token];
        if (!userId) return null;
        return db.users.find(u => u.id === userId && u.status === 'active') || null;
    };

    const sanitizeUser = (u) => ({
        id: u.id,
        fullName: u.fullName,
        role: u.role,
        status: u.status,
        hasPin: Boolean(u.pin)
    });

    if (action === 'loginPin') {
        const pin = String(payload.pin || '').trim();
        const expectedRole = payload.role === 'owner' ? 'owner' : 'staff';
        if (!/^\d{4}$/.test(pin)) {
            return sendJson(400, { error: 'Enter a valid 4-digit PIN.' });
        }
        const user = db.users.find(u => u.role === expectedRole && u.pin === pin && u.status === 'active');
        if (!user) {
            const roleUser = db.users.find(u => u.role === expectedRole);
            const hint = roleUser ? ` (Default local ${expectedRole === 'owner' ? 'Admin' : 'Staff'} PIN is ${roleUser.pin})` : '';
            return sendJson(401, { error: `Invalid ${expectedRole === 'owner' ? 'Admin' : 'Staff'} PIN.${hint}` });
        }
        const accessToken = 'local_pin_' + crypto.randomUUID();
        db.sessions[accessToken] = user.id;
        writeLocalDb(db);
        return sendJson(200, {
            accessToken,
            refreshToken: null,
            user: sanitizeUser(user)
        });
    }

    if (action === 'refresh') {
        const refreshToken = String(payload.refreshToken || '');
        const userId = db.sessions[refreshToken];
        const user = db.users.find(u => u.id === userId && u.status === 'active');
        if (!user) {
            return sendJson(401, { error: 'Session expired. Please sign in again.' });
        }
        return sendJson(200, {
            accessToken: refreshToken,
            refreshToken,
            user: sanitizeUser(user)
        });
    }

    if (action === 'logout') {
        if (token && db.sessions[token]) {
            delete db.sessions[token];
            writeLocalDb(db);
        }
        return sendJson(200, { success: true });
    }

    const currentUser = getAuthenticatedUser();
    if (!currentUser) {
        return sendJson(401, { error: 'Authentication required. Please sign in.' });
    }

    if (action === 'me') {
        return sendJson(200, { user: sanitizeUser(currentUser) });
    }

    if (action === 'setPin') {
        const pin = String(payload.pin || '').trim();
        if (!/^\d{4}$/.test(pin)) {
            return sendJson(400, { error: 'Account PIN must be exactly four digits.' });
        }
        const conflict = db.users.find(u => u.id !== currentUser.id && u.pin === pin);
        if (conflict) {
            return sendJson(409, { error: 'Choose a different four-digit PIN.' });
        }
        currentUser.pin = pin;
        currentUser.hasPin = true;
        writeLocalDb(db);
        return sendJson(200, { success: true, hasPin: true });
    }

    if (action === 'getServices') {
        const sorted = [...db.services].sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return (a.displayOrder || 0) - (b.displayOrder || 0);
        });
        return sendJson(200, sorted);
    }

    if (action === 'getTransactions') {
        const filterDate = payload.filterDate || null;
        const category = payload.category || null;
        const list = (db.transactions || []).filter(t => {
            if (filterDate && t.transactionDate !== filterDate) return false;
            if (category && category !== 'all' && t.businessCategory !== category) return false;
            return true;
        });
        return sendJson(200, list);
    }

    if (action === 'addTransaction') {
        const date = String(payload.transactionDate || '').trim();
        const cat = payload.businessCategory === 'laundry' ? 'laundry' : 'water';
        const prefix = cat === 'water' ? 'WTR' : 'LND';
        const datePart = date.replace(/-/g, '');
        const existingSameDay = (db.transactions || []).filter(
            t => t.businessCategory === cat && t.transactionDate === date
        );
        const seq = String(existingSameDay.length + 1).padStart(3, '0');
        const transaction = {
            id: 'tx_' + crypto.randomUUID(),
            transactionCode: `${prefix}-${datePart}-${seq}`,
            businessCategory: cat,
            transactionDate: date,
            transactionTime: payload.transactionTime || new Date().toLocaleTimeString('en-US', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            customerName: String(payload.customerName || 'Walk-in Customer').trim() || 'Walk-in Customer',
            totalAmount: Number(payload.totalAmount) || 0,
            paymentMethod: payload.paymentMethod || 'Cash',
            paymentStatus: payload.paymentStatus === 'unpaid' ? 'unpaid' : 'paid',
            notes: String(payload.notes || '').trim(),
            items: Array.isArray(payload.items) ? payload.items : [],
            createdAt: new Date().toISOString()
        };
        db.transactions.unshift(transaction);
        recalculateCustomers(db);
        writeLocalDb(db);
        return sendJson(200, transaction);
    }

    if (action === 'togglePaymentStatus') {
        const tx = (db.transactions || []).find(t => t.id === payload.id);
        if (!tx) return sendJson(404, { error: 'Transaction not found.' });
        tx.paymentStatus = payload.currentStatus === 'paid' ? 'unpaid' : 'paid';
        writeLocalDb(db);
        return sendJson(200, tx.paymentStatus);
    }

    if (action === 'getExpenses') {
        const filterDate = payload.filterDate || null;
        const category = payload.category || null;
        const list = (db.expenses || []).filter(e => {
            if (filterDate && e.expenseDate !== filterDate) return false;
            if (category && category !== 'all' && e.businessCategory !== category) return false;
            return true;
        });
        return sendJson(200, list);
    }

    if (action === 'addExpense') {
        const expense = {
            id: 'exp_' + crypto.randomUUID(),
            expenseDate: payload.expenseDate,
            businessCategory: payload.businessCategory || 'shared',
            particular: String(payload.particular || '').trim(),
            quantity: payload.quantity !== null && payload.quantity !== undefined ? Number(payload.quantity) : null,
            unitPrice: payload.unitPrice !== null && payload.unitPrice !== undefined ? Number(payload.unitPrice) : null,
            totalAmount: Number(payload.totalAmount) || 0,
            notes: String(payload.notes || '').trim(),
            createdAt: new Date().toISOString()
        };
        db.expenses.unshift(expense);
        writeLocalDb(db);
        return sendJson(200, expense);
    }

    // Owner-only actions
    if (currentUser.role !== 'owner') {
        return sendJson(403, { error: 'Owner authorization required.' });
    }

    if (action === 'deleteTransaction') {
        db.transactions = (db.transactions || []).filter(t => t.id !== payload.id);
        recalculateCustomers(db);
        writeLocalDb(db);
        return sendJson(200, { success: true });
    }

    if (action === 'deleteExpense') {
        db.expenses = (db.expenses || []).filter(e => e.id !== payload.id);
        writeLocalDb(db);
        return sendJson(200, { success: true });
    }

    if (action === 'saveRates') {
        const newRatesMap = payload.newRatesMap || {};
        db.services.forEach(s => {
            if (newRatesMap[s.id] !== undefined) {
                s.defaultRate = Number(newRatesMap[s.id]) || 0;
            }
        });
        writeLocalDb(db);
        return sendJson(200, db.services);
    }

    if (action === 'addService') {
        const created = {
            id: 'srv_' + crypto.randomUUID(),
            category: payload.category === 'laundry' ? 'laundry' : 'water',
            serviceCode: String(payload.serviceCode || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            serviceName: String(payload.serviceName || '').trim(),
            defaultRate: Number(payload.defaultRate) || 0,
            unitLabel: String(payload.unitLabel || 'unit').trim(),
            isActive: payload.isActive !== false,
            displayOrder: db.services.length + 1
        };
        db.services.push(created);
        writeLocalDb(db);
        return sendJson(200, created);
    }

    if (action === 'updateService') {
        const srv = db.services.find(s => s.id === payload.id);
        if (!srv) return sendJson(404, { error: 'Service not found.' });
        const updates = payload.updates || {};
        if (updates.serviceName !== undefined) srv.serviceName = String(updates.serviceName).trim();
        if (updates.defaultRate !== undefined) srv.defaultRate = Number(updates.defaultRate) || 0;
        if (updates.unitLabel !== undefined) srv.unitLabel = String(updates.unitLabel).trim();
        if (updates.isActive !== undefined) srv.isActive = Boolean(updates.isActive);
        writeLocalDb(db);
        return sendJson(200, srv);
    }

    if (action === 'toggleServiceActive') {
        const srv = db.services.find(s => s.id === payload.id);
        if (!srv) return sendJson(404, { error: 'Service not found.' });
        srv.isActive = srv.isActive === false;
        writeLocalDb(db);
        return sendJson(200, srv);
    }

    if (action === 'deleteService') {
        const srv = db.services.find(s => s.id === payload.id);
        if (!srv) return sendJson(404, { error: 'Service not found.' });
        const usedInTx = (db.transactions || []).some(t =>
            (t.items || []).some(it => it.serviceId === srv.id || it.itemName === srv.serviceName)
        );
        if (usedInTx) {
            srv.isActive = false;
            writeLocalDb(db);
            return sendJson(200, {
                deleted: false,
                deactivated: true,
                message: `Service "${srv.serviceName}" has historical transactions and was marked Inactive.`
            });
        }
        db.services = db.services.filter(s => s.id !== srv.id);
        writeLocalDb(db);
        return sendJson(200, {
            deleted: true,
            deactivated: false,
            message: `Service "${srv.serviceName}" deleted.`
        });
    }

    if (action === 'getCustomers') {
        recalculateCustomers(db);
        writeLocalDb(db);
        return sendJson(200, db.customers || []);
    }

    if (action === 'getUsers') {
        return sendJson(200, db.users.map(sanitizeUser));
    }

    if (action === 'createUser') {
        const fullName = String(payload.fullName || '').trim();
        const pin = String(payload.pin || '').trim();
        if (!fullName || !/^\d{4}$/.test(pin)) {
            return sendJson(400, { error: 'Enter a full name and a 4-digit PIN.' });
        }
        if (db.users.some(u => u.pin === pin)) {
            return sendJson(409, { error: 'That 4-digit PIN is already assigned. Choose a different PIN.' });
        }
        const newUser = {
            id: 'local_user_' + crypto.randomUUID(),
            fullName,
            role: payload.role === 'owner' ? 'owner' : 'staff',
            status: 'active',
            pin,
            hasPin: true
        };
        db.users.push(newUser);
        writeLocalDb(db);
        return sendJson(200, sanitizeUser(newUser));
    }

    return sendJson(400, { error: `Unsupported action: ${action}` });
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api' || pathname.startsWith('/api/')) {
        let rawBody = '';
        req.on('data', chunk => {
            rawBody += chunk;
        });
        req.on('end', async () => {
            let parsedBody = {};
            try {
                parsedBody = rawBody ? JSON.parse(rawBody) : {};
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
                return;
            }

            if (hasSupabaseEnv()) {
                req.body = parsedBody;
                const vercelRes = {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    status(code) {
                        this.statusCode = code;
                        return this;
                    },
                    setHeader(k, v) {
                        this.headers[k] = v;
                        return this;
                    },
                    json(payload) {
                        res.writeHead(this.statusCode, this.headers);
                        res.end(JSON.stringify(payload));
                        return this;
                    }
                };
                await apiHandler(req, vercelRes);
            } else {
                handleLocalApi(req, res, parsedBody);
            }
        });
        return;
    }

    let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let filePath = path.join(PUBLIC_DIR, relativePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    try {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
    }
});

const DEFAULT_PORT = Number(process.env.PORT) || 3000;

function startServer(port) {
    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            startServer(port + 1);
        } else {
            console.error(err);
            process.exit(1);
        }
    });

    server.listen(port, () => {
        const mode = hasSupabaseEnv()
            ? 'Supabase Cloud Backend (.env configured)'
            : 'Local Shared Database (.local-db.json)';
        console.log('========================================================');
        console.log('  PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM');
        console.log(`  Server running at: http://localhost:${port}`);
        console.log(`  API Mode: ${mode}`);
        if (!hasSupabaseEnv()) {
            console.log('  Local Staff PIN: 1111  |  Local Admin PIN: 5555');
        }
        console.log('========================================================');
    });
}

startServer(DEFAULT_PORT);

