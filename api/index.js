const {
    createHmac,
    randomBytes,
    randomUUID,
    scryptSync,
    timingSafeEqual
} = require('node:crypto');

const TABLES = {
    customers: 'pazings_customers',
    expenses: 'pazings_expenses',
    services: 'pazings_services',
    transactions: 'pazings_transactions',
    users: 'pazings_profiles'
};

function getConfig() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
        throw new Error('Supabase server environment is not configured.');
    }
    return { url: url.replace(/\/+$/, ''), anonKey, serviceKey };
}

async function supabaseRequest(config, path, { method = 'GET', body, token, admin = false, prefer } = {}) {
    const headers = {
        apikey: admin ? config.serviceKey : config.anonKey,
        Authorization: `Bearer ${admin ? config.serviceKey : token || config.anonKey}`,
        'Content-Type': 'application/json'
    };
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(`${config.url}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const error = new Error(data?.msg || data?.message || data?.error_description || 'Supabase request failed.');
        error.status = response.status;
        throw error;
    }
    return data;
}

function response(res, status, data) {
    res.status(status).setHeader('Cache-Control', 'no-store').json(data);
}

function requireMethod(req, res) {
    if (req.method !== 'POST') {
        response(res, 405, { error: 'Method not allowed.' });
        return false;
    }
    return true;
}

async function authenticate(req, config) {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!match) {
        const error = new Error('Please sign in again.');
        error.status = 401;
        throw error;
    }
    const token = match[1];
    const appToken = verifyAppToken(token, config.serviceKey);
    if (appToken) {
        const profileRows = await supabaseRequest(
            config,
            `/rest/v1/pazings_profiles?id=eq.${encodeURIComponent(appToken.sub)}&select=id,email,full_name,role,status,pin_lookup`,
            { admin: true }
        );
        const profile = profileRows?.[0];
        if (!profile || profile.status !== 'active' || profile.pin_lookup !== appToken.pin) {
            const error = new Error('This account session is no longer valid. Sign in again.');
            error.status = 401;
            throw error;
        }
        return { token, user: userFromProfile(profile), appToken: true };
    }

    const authUser = await supabaseRequest(config, '/auth/v1/user', { token });
    const profileRows = await supabaseRequest(
        config,
    `/rest/v1/pazings_profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,email,full_name,role,status,pin_lookup`,
        { admin: true }
    );
    const profile = profileRows?.[0];
    if (!profile || profile.status !== 'active') {
        const error = new Error('This account is inactive or is not configured.');
        error.status = 403;
        throw error;
    }
    return { token, user: userFromProfile(profile), appToken: false };
}

function userFromProfile(profile) {
    return {
        id: profile.id,
        fullName: profile.full_name,
        role: profile.role,
        status: profile.status,
        hasPin: Boolean(profile.pin_lookup)
    };
}

function pinLookup(pin, secret) {
    return createHmac('sha256', secret).update(`pazings-pin:${pin}`).digest('hex');
}

function pinPasswordHash(pin, salt) {
    return scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
}

function createAppToken(profile, secret) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
        iss: 'pazings-inventory',
        sub: profile.id,
        pin: profile.pin_lookup,
        iat: issuedAt,
        exp: issuedAt + 12 * 60 * 60
    })).toString('base64url');
    const unsigned = `${header}.${payload}`;
    const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
    return `${unsigned}.${signature}`;
}

function verifyAppToken(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (header.alg !== 'HS256' || payload.iss !== 'pazings-inventory'
            || typeof payload.sub !== 'string' || payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }
        const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
        const received = Buffer.from(parts[2], 'base64url');
        return received.length === expected.length && timingSafeEqual(received, expected) ? payload : null;
    } catch (error) {
        return null;
    }
}

function clientPinRateLimitKey(req, secret) {
    const headers = req.headers || {};
    const forwarded = headers['x-forwarded-for'];
    const address = String(headers['x-real-ip'] || (forwarded ? forwarded.split(',')[0].trim() : '') || 'unknown');
    return createHmac('sha256', secret).update(`pazings-pin-ip:${address}`).digest('hex');
}

async function updatePinRateLimit(config, key, success = null) {
    return supabaseRequest(config, '/rest/v1/rpc/pazings_pin_login_allowed', {
        method: 'POST',
        admin: true,
        body: { p_client_key: key, p_success: success }
    });
}

function requireOwner(user) {
    if (user.role !== 'owner') {
        const error = new Error('Only the owner can perform this action.');
        error.status = 403;
        throw error;
    }
}

async function tableRequest(config, table, query, options = {}) {
    const qs = new URLSearchParams(query || {}).toString();
    return supabaseRequest(config, `/rest/v1/${table}${qs ? `?${qs}` : ''}`, {
        ...options,
        admin: true
    });
}

function transactionFromDb(row) {
    return {
        id: row.id,
        transactionCode: row.transaction_code,
        businessCategory: row.business_category,
        transactionDate: row.transaction_date,
        transactionTime: row.transaction_time,
        customerName: row.customer_name,
        totalAmount: Number(row.total_amount),
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        items: row.items || [],
        notes: row.notes || '',
        createdBy: row.created_by,
        createdAt: row.created_at
    };
}

function expenseFromDb(row) {
    return {
        id: row.id,
        expenseDate: row.expense_date,
        businessCategory: row.business_category,
        particular: row.particular,
        quantity: row.quantity === null ? null : Number(row.quantity),
        unitPrice: row.unit_price === null ? null : Number(row.unit_price),
        totalAmount: Number(row.total_amount),
        notes: row.notes || '',
        createdBy: row.created_by,
        createdAt: row.created_at
    };
}

function serviceFromDb(row) {
    return {
        id: row.id,
        category: row.category,
        serviceCode: row.service_code,
        serviceName: row.service_name,
        defaultRate: Number(row.default_rate),
        unitLabel: row.unit_label,
        isActive: row.is_active,
        displayOrder: row.display_order
    };
}

async function handleAction(req, config) {
    const { action, payload = {} } = req.body || {};
    if (action === 'loginPin') {
        const pin = String(payload.pin || '');
        const role = payload.role;
        if (!/^\d{4}$/.test(pin) || !['owner', 'staff'].includes(role)) {
            const error = new Error('Select a role and enter its four-digit account PIN.');
            error.status = 400;
            throw error;
        }
        const rateLimitKey = clientPinRateLimitKey(req, config.serviceKey);
        const allowed = await updatePinRateLimit(config, rateLimitKey);
        if (!allowed) {
            const error = new Error('Too many PIN attempts. Please try again later.');
            error.status = 429;
            throw error;
        }
        const lookup = pinLookup(pin, config.serviceKey);
        const rows = await supabaseRequest(
            config,
            `/rest/v1/pazings_profiles?pin_lookup=eq.${lookup}&select=id,email,full_name,role,status,pin_salt,pin_hash`,
            { admin: true }
        );
        const profile = rows?.[0];
        let valid = false;
        if (profile?.status === 'active' && profile.role === role && profile.pin_salt && profile.pin_hash) {
            const expected = Buffer.from(profile.pin_hash, 'hex');
            const candidate = Buffer.from(pinPasswordHash(pin, profile.pin_salt), 'hex');
            valid = expected.length === candidate.length && timingSafeEqual(expected, candidate);
        }
        await updatePinRateLimit(config, rateLimitKey, valid);
        if (!valid) {
            const error = new Error('Incorrect PIN or account is not active.');
            error.status = 401;
            throw error;
        }
        return {
            accessToken: createAppToken(profile, config.serviceKey),
            user: userFromProfile(profile)
        };
    }

    if (action === 'refresh') {
        const refreshToken = String(payload.refreshToken || '');
        if (!refreshToken) {
            const error = new Error('Please sign in again.');
            error.status = 401;
            throw error;
        }
        const session = await supabaseRequest(config, '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            body: { refresh_token: refreshToken }
        });
        const profileRows = await supabaseRequest(
            config,
            `/rest/v1/pazings_profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,full_name,role,status,pin_lookup`,
            { admin: true }
        );
        const profile = profileRows?.[0];
        if (!profile || profile.status !== 'active') {
            const error = new Error('This account is inactive.');
            error.status = 403;
            throw error;
        }
        return {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            user: userFromProfile(profile)
        };
    }

    const { token, user, appToken } = await authenticate(req, config);
    if (action === 'me') return { user };
    if (action === 'logout') {
        if (appToken) return { success: true };
        await supabaseRequest(config, '/auth/v1/logout', { method: 'POST', token });
        return { success: true };
    }
    if (action === 'setPin') {
        const pin = String(payload.pin || '');
        if (!/^\d{4}$/.test(pin)) {
            throw Object.assign(new Error('Choose exactly four digits for the account PIN.'), { status: 400 });
        }
        const salt = randomBytes(16).toString('hex');
        let rows;
        try {
            rows = await tableRequest(config, TABLES.users, { id: `eq.${user.id}` }, {
                method: 'PATCH',
                body: {
                    pin_lookup: pinLookup(pin, config.serviceKey),
                    pin_salt: salt,
                    pin_hash: pinPasswordHash(pin, salt)
                },
                prefer: 'return=representation'
            });
        } catch (error) {
            if (error.status === 409) {
                throw Object.assign(new Error('That PIN is already assigned. Choose a different PIN.'), { status: 409 });
            }
            throw error;
        }
        if (!rows[0]) throw Object.assign(new Error('User account not found.'), { status: 404 });
        return { success: true };
    }

    const ownerOnly = new Set([
        'deleteTransaction', 'deleteExpense', 'getUsers',
        'addService', 'updateService', 'deleteService', 'saveRates', 'createUser'
    ]);
    if (ownerOnly.has(action)) requireOwner(user);

    switch (action) {
        case 'getServices': {
            const rows = await tableRequest(config, TABLES.services, {
                select: '*',
                order: 'display_order.asc,service_name.asc'
            });
            return rows.map(serviceFromDb);
        }
        case 'addService': {
            const row = {
                id: payload.id,
                category: payload.category,
                service_code: payload.serviceCode,
                service_name: payload.serviceName,
                default_rate: payload.defaultRate,
                unit_label: payload.unitLabel,
                is_active: payload.isActive,
                display_order: payload.displayOrder
            };
            const rows = await tableRequest(config, TABLES.services, { on_conflict: 'id' }, {
                method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=representation'
            });
            return serviceFromDb(rows[0]);
        }
        case 'updateService': {
            const row = {};
            if (payload.serviceName !== undefined) row.service_name = payload.serviceName;
            if (payload.defaultRate !== undefined) row.default_rate = payload.defaultRate;
            if (payload.unitLabel !== undefined) row.unit_label = payload.unitLabel;
            if (payload.isActive !== undefined) row.is_active = payload.isActive;
            const rows = await tableRequest(config, TABLES.services, { id: `eq.${payload.id}` }, {
                method: 'PATCH', body: row, prefer: 'return=representation'
            });
            if (!rows[0]) throw Object.assign(new Error('Service not found.'), { status: 404 });
            return serviceFromDb(rows[0]);
        }
        case 'deleteService': {
            const rows = await tableRequest(config, TABLES.services, { id: `eq.${payload.id}`, select: '*' });
            const service = rows[0];
            if (!service) throw Object.assign(new Error('Service not found.'), { status: 404 });
            const isReferenced = await supabaseRequest(config, '/rest/v1/rpc/pazings_service_is_referenced', {
                method: 'POST',
                admin: true,
                body: { p_service_id: payload.id }
            });
            if (isReferenced) {
                await tableRequest(config, TABLES.services, { id: `eq.${payload.id}` }, {
                    method: 'PATCH', body: { is_active: false }, prefer: 'return=minimal'
                });
                return { deleted: false, deactivated: true, message: `Service "${service.service_name}" has existing sales records. It has been deactivated to preserve transaction history.` };
            }
            await tableRequest(config, TABLES.services, { id: `eq.${payload.id}` }, { method: 'DELETE', prefer: 'return=minimal' });
            return { deleted: true, message: `Service "${service.service_name}" was deleted successfully.` };
        }
        case 'saveRates': {
            const updated = await supabaseRequest(config, '/rest/v1/rpc/pazings_save_rates', {
                method: 'POST',
                admin: true,
                body: { p_rates: payload.rates || {} }
            });
            return { success: true, updated };
        }
        case 'getTransactions': {
            const query = { select: '*', order: 'transaction_date.desc,created_at.desc' };
            if (payload.filterDate) query.transaction_date = `eq.${payload.filterDate}`;
            if (payload.category && payload.category !== 'all') query.business_category = `eq.${payload.category}`;
            return (await tableRequest(config, TABLES.transactions, query)).map(transactionFromDb);
        }
        case 'addTransaction': {
            const transactionDate = payload.transactionDate;
            const codeRows = await supabaseRequest(config, '/rest/v1/rpc/pazings_next_transaction_code', {
                method: 'POST',
                admin: true,
                body: { p_category: payload.businessCategory, p_date: transactionDate }
            });
            const record = {
                id: `tx_${randomUUID()}`,
                transaction_code: codeRows,
                business_category: payload.businessCategory,
                transaction_date: transactionDate,
                transaction_time: payload.transactionTime,
                customer_name: payload.customerName || 'Walk-in Customer',
                total_amount: payload.totalAmount,
                payment_method: payload.paymentMethod,
                payment_status: payload.paymentStatus,
                items: payload.items || [],
                notes: payload.notes || '',
                created_by: user.id
            };
            const rows = await tableRequest(config, TABLES.transactions, {}, {
                method: 'POST', body: record, prefer: 'return=representation'
            });
            return transactionFromDb(rows[0]);
        }
        case 'deleteTransaction':
            await tableRequest(config, TABLES.transactions, { id: `eq.${payload.id}` }, { method: 'DELETE', prefer: 'return=minimal' });
            return { success: true };
        case 'togglePaymentStatus': {
            const status = payload.currentStatus === 'paid' ? 'unpaid' : 'paid';
            const rows = await tableRequest(config, TABLES.transactions, { id: `eq.${payload.id}` }, {
                method: 'PATCH', body: { payment_status: status }, prefer: 'return=representation'
            });
            if (!rows[0]) throw Object.assign(new Error('Transaction not found.'), { status: 404 });
            return rows[0].payment_status;
        }
        case 'addExpense': {
            const record = {
                id: `exp_${randomUUID()}`,
                expense_date: payload.expenseDate,
                business_category: payload.businessCategory || 'shared',
                particular: payload.particular || '',
                quantity: payload.quantity,
                unit_price: payload.unitPrice,
                total_amount: payload.totalAmount,
                notes: payload.notes || '',
                created_by: user.id
            };
            const rows = await tableRequest(config, TABLES.expenses, {}, {
                method: 'POST', body: record, prefer: 'return=representation'
            });
            return expenseFromDb(rows[0]);
        }
        case 'getExpenses': {
            const query = { select: '*', order: 'expense_date.desc,created_at.desc' };
            if (payload.filterDate) query.expense_date = `eq.${payload.filterDate}`;
            if (payload.category && payload.category !== 'all') query.business_category = `eq.${payload.category}`;
            return (await tableRequest(config, TABLES.expenses, query)).map(expenseFromDb);
        }
        case 'deleteExpense':
            await tableRequest(config, TABLES.expenses, { id: `eq.${payload.id}` }, { method: 'DELETE', prefer: 'return=minimal' });
            return { success: true };
        case 'getCustomers': {
            const columns = user.role === 'owner'
                ? '*'
                : 'id,name,total_orders,lifetime_spend,last_order_date,created_at';
            return tableRequest(config, TABLES.customers, { select: columns, order: 'name.asc' }).then(rows => rows.map(row => ({
                id: row.id, name: row.name, contactNumber: row.contact_number || '',
                address: row.address || '', notes: row.notes || '', totalOrders: Number(row.total_orders),
                lifetimeSpend: Number(row.lifetime_spend), lastOrderDate: row.last_order_date, createdAt: row.created_at
            })));
        }
        case 'getUsers':
            return tableRequest(config, TABLES.users, { select: 'id,full_name,role,status', order: 'created_at.asc' }).then(rows => rows.map(row => ({
                id: row.id, fullName: row.full_name, role: row.role, status: row.status
            })));
        case 'createUser': {
            const fullName = String(payload.fullName || '').trim();
            const pin = String(payload.pin || '').trim();
            const role = payload.role === 'owner' ? 'owner' : 'staff';
            if (!fullName || !/^\d{4}$/.test(pin)) {
                throw Object.assign(new Error('Enter a full name and a 4-digit PIN.'), { status: 400 });
            }
            const salt = randomBytes(16).toString('hex');
            const generatedEmail = `pin-${randomUUID()}@pazings.local`;
            const generatedPassword = randomBytes(24).toString('hex');
            const created = await supabaseRequest(config, '/auth/v1/admin/users', {
                method: 'POST', admin: true,
                body: { email: generatedEmail, password: generatedPassword, email_confirm: true, user_metadata: { full_name: fullName } }
            });
            const rows = await tableRequest(config, TABLES.users, { id: `eq.${created.id}` }, {
                method: 'PATCH',
                body: {
                    full_name: fullName,
                    role,
                    status: 'active',
                    pin_lookup: pinLookup(pin, config.serviceKey),
                    pin_salt: salt,
                    pin_hash: pinPasswordHash(pin, salt)
                },
                prefer: 'return=representation'
            });
            return {
                id: created.id,
                fullName: rows[0]?.full_name || fullName,
                role: rows[0]?.role || role,
                status: 'active'
            };
        }
        default:
            throw Object.assign(new Error('Unknown API action.'), { status: 400 });
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!requireMethod(req, res)) return;
    try {
        const config = getConfig();
        const result = await handleAction(req, config);
        response(res, 200, result);
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        if (status >= 500) console.error('Pazings API error:', error);
        response(res, status, {
            error: status >= 500
                ? 'The shared database request failed. Check the server configuration and try again.'
                : error.message
        });
    }
};
