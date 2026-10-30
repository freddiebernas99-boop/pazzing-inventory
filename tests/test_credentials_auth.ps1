Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TESTING SHARED SUPABASE AUTH AND DATA API" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$nodeScript = @'
const fs = require('fs');
const jsCode = fs.readFileSync('public/assets/js/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const schema = fs.readFileSync('supabase/setup.sql', 'utf8');
const values = {};
const localStorage = {
    getItem(key) { return values[key] || null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; }
};
const window = { scrollTo() {} };
const document = {
    readyState: 'loading',
    getElementById() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
};

const user = { id: 'user-1', email: 'owner@example.test', fullName: 'Owner', role: 'owner', status: 'active' };
const calls = [];
let transactions = [];
let expenses = [];
let failMeOnce = false;
global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, action: body.action, payload: body.payload, authorization: options.headers.Authorization });
    let result;
    switch (body.action) {
        case 'login':
            result = { accessToken: 'access-1', refreshToken: 'refresh-1', user };
            break;
        case 'setPin':
            result = { success: true };
            break;
        case 'loginPin':
            result = { accessToken: 'pin-access-1', refreshToken: 'refresh-1', user };
            break;
        case 'refresh':
            result = { accessToken: 'access-2', refreshToken: 'refresh-2', user };
            break;
        case 'me':
            if (failMeOnce) {
                failMeOnce = false;
                return { ok: false, status: 401, async json() { return { error: 'expired' }; } };
            }
            result = { user };
            break;
        case 'getServices':
            result = [{ id: 'srv_water_refill', category: 'water', serviceCode: 'refill', serviceName: 'Refill', defaultRate: 30, unitLabel: 'bottles', isActive: true, displayOrder: 1 }];
            break;
        case 'addTransaction':
            result = { id: 'tx-cloud-1', transactionCode: 'WTR-20261029-001', ...body.payload };
            transactions.unshift(result);
            break;
        case 'getTransactions':
            result = transactions.filter(item =>
                (!body.payload.filterDate || item.transactionDate === body.payload.filterDate) &&
                (!body.payload.category || body.payload.category === 'all' || item.businessCategory === body.payload.category)
            );
            break;
        case 'togglePaymentStatus': {
            const transaction = transactions.find(item => item.id === body.payload.id);
            transaction.paymentStatus = body.payload.currentStatus === 'paid' ? 'unpaid' : 'paid';
            result = transaction.paymentStatus;
            break;
        }
        case 'addExpense':
            result = { id: 'exp-cloud-1', ...body.payload };
            expenses.unshift(result);
            break;
        case 'getExpenses':
            result = expenses.filter(item =>
                (!body.payload.filterDate || item.expenseDate === body.payload.filterDate) &&
                (!body.payload.category || body.payload.category === 'all' || item.businessCategory === body.payload.category)
            );
            break;
        case 'deleteTransaction':
            transactions = transactions.filter(item => item.id !== body.payload.id);
            result = { success: true };
            break;
        case 'deleteExpense':
            expenses = expenses.filter(item => item.id !== body.payload.id);
            result = { success: true };
            break;
        case 'logout':
            result = { success: true };
            break;
        default:
            throw new Error('Unexpected API action: ' + body.action);
    }
    return { ok: true, status: 200, async json() { return result; } };
};

eval(jsCode);
const DataService = window.DataService;
const AppState = window.AppState;

async function run() {
    let passed = 0;
    let failed = 0;
    function assert(condition, description) {
        if (condition) {
            console.log('[PASS] ' + description);
            passed++;
        } else {
            console.error('[FAIL] ' + description);
            failed++;
        }
    }

    assert(!/firebase|firestore/i.test(jsCode) && !/firebase|firestore/i.test(html), 'No Firebase integration remains');
    assert(!/staff:\s*['"]1111['"].*owner:\s*['"]5555['"]/.test(jsCode), 'Hard-coded demo PIN authentication is removed');
    assert(/id="pin-role-select"/.test(html) && /id="btn-select-staff-pin"/.test(html) && /id="btn-select-admin-pin"/.test(html), 'Staff and Admin PIN roles are presented separately');
    assert(/id="staff-pin-login-form"/.test(html) && /id="admin-pin-login-form"/.test(html), 'Staff and Admin use separate PIN login forms');
    assert(!/id="staff-email"/.test(html) && !/id="admin-password"/.test(html) && !/First time or forgot PIN/i.test(html), 'Email/password login and reset PIN button are completely removed');
    assert(!/loginWithPassword/.test(jsCode) && !/setAccountPin/.test(jsCode), 'Email/password login and PIN setup functions are removed from client JS');
    assert(/pin_lookup text unique/.test(schema) && /pin_salt text/.test(schema) && /pin_hash text/.test(schema), 'Supabase schema stores a unique PIN lookup and salted hash');
    assert(/pazings_pin_login_allowed/.test(schema) && /interval '15 minutes'/.test(schema), 'PIN login lockout is persisted in Supabase');
    assert(!/SUPABASE_SERVICE_ROLE_KEY/.test(jsCode), 'Service-role credential is not exposed to browser code');
    assert(!(await DataService.initAuth()), 'Unauthenticated browser starts signed out');

    let invalidPinRejected = false;
    try {
        await DataService.loginWithPin('owner', '123');
    } catch (error) {
        invalidPinRejected = /4-digit PIN/.test(error.message);
    }
    assert(invalidPinRejected, 'PIN login validates 4-digit PIN format');
    const login = await DataService.loginWithPin('owner', '3141');
    assert(login && login.role === 'owner' && AppState.currentUser.role === 'owner', 'Owner session is established through PIN login');
    assert(JSON.parse(values.pazings_cloud_session).accessToken === 'pin-access-1', 'PIN sign-in creates a reusable authenticated session');
    assert(calls.some(call => call.action === 'loginPin' && call.payload.role === 'owner' && call.payload.pin === '3141'), 'Cross-device PIN login sends the selected account role');
    failMeOnce = true;
    const restoredUser = await DataService.initAuth();
    assert(restoredUser.role === 'owner', 'Expired access token refreshes and restores the session');
    assert(calls.some(call => call.action === 'refresh') && calls.some(call => call.authorization), 'Refreshed token is used for authorized API calls');

    await DataService.getServices();
    assert(AppState.services[0].serviceName === 'Refill', 'Service rates load from the shared API');

    const transaction = await DataService.addTransaction({
        businessCategory: 'water',
        transactionDate: '2026-10-29',
        customerName: 'Test Customer',
        totalAmount: 30,
        paymentStatus: 'paid',
        items: [{ itemName: 'Refill', quantity: 1 }]
    });
    assert(transaction.id === 'tx-cloud-1', 'New transaction is accepted from the shared API');
    assert((await DataService.getTransactions('2026-10-29', 'water')).length === 1, 'Transactions are filtered from shared API results');
    await DataService.togglePaymentStatus(transaction.id, 'paid');
    assert((await DataService.getTransactions())[0].paymentStatus === 'unpaid', 'Payment status changes are sent to the shared API');

    const expense = await DataService.addExpense({
        expenseDate: '2026-10-29',
        businessCategory: 'shared',
        particular: 'Test expense',
        totalAmount: 10
    });
    assert((await DataService.getExpenses('2026-10-29', 'shared'))[0].id === expense.id, 'Expenses save and filter through the shared API');
    await DataService.deleteTransaction(transaction.id);
    await DataService.deleteExpense(expense.id);
    assert((await DataService.getTransactions()).length === 0 && (await DataService.getExpenses()).length === 0, 'Record deletion is sent to the server API');

    await DataService.logout();
    assert(!values.pazings_cloud_session && !AppState.currentUser, 'Logout clears the cloud session');
    assert(calls.every(call => call.url === '/api'), 'All cloud operations use the same-origin Vercel API');

    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
    const apiHandler = require('./api/index.js');
    let databaseCalls = 0;
    let savedPinFields = null;
    let rateLimitCalls = 0;
    const crypto = require('node:crypto');
    const apiPin = '3141';
    const apiPinSalt = 'a1b2c3d4e5f6';
    const apiPinLookup = crypto.createHmac('sha256', 'test-server-key')
        .update(`pazings-pin:${apiPin}`).digest('hex');
    const apiPinHash = crypto.scryptSync(apiPin, apiPinSalt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
    let currentPinLookup = apiPinLookup;
    global.fetch = async (url, options) => {
        databaseCalls++;
        if (url.includes('/rest/v1/rpc/pazings_pin_login_allowed')) {
            rateLimitCalls++;
            return new Response('true', { status: 200 });
        }
        if (url.includes('/rest/v1/pazings_profiles?pin_lookup=eq.')) {
            const matchesPin = url.includes(currentPinLookup);
            return new Response(JSON.stringify(matchesPin ? [{
                id: 'owner-1',
                email: 'owner@example.test',
                full_name: 'Owner',
                role: 'owner',
                status: 'active',
                pin_lookup: currentPinLookup,
                pin_salt: apiPinSalt,
                pin_hash: apiPinHash
            }] : []), { status: 200 });
        }
        if (url.endsWith('/auth/v1/user')) {
            const id = options.headers.Authorization === 'Bearer staff-token' ? 'staff-1' : 'owner-1';
            return new Response(JSON.stringify({ id }), { status: 200 });
        }
        if (url.includes('/rest/v1/pazings_profiles?id=eq.') && options.method === 'PATCH') {
            savedPinFields = JSON.parse(options.body);
            currentPinLookup = savedPinFields.pin_lookup;
            return new Response(JSON.stringify([{ id: 'owner-1', pin_lookup: currentPinLookup }]), { status: 200 });
        }
        if (url.includes('/rest/v1/pazings_profiles?id=eq.')) {
            const isStaff = url.includes('staff-1');
            return new Response(JSON.stringify([{
                id: isStaff ? 'staff-1' : 'owner-1',
                email: isStaff ? 'staff@example.test' : 'owner@example.test',
                full_name: isStaff ? 'Staff' : 'Owner',
                role: isStaff ? 'staff' : 'owner',
                status: 'active',
                pin_lookup: isStaff ? null : currentPinLookup
            }]), { status: 200 });
        }
        if (url.includes('/rest/v1/pazings_profiles?select=')) {
            return new Response('[]', { status: 200 });
        }
        throw new Error('Unexpected mocked Supabase route: ' + url);
    };
    async function invokeApi(token, action, payload = {}) {
        const state = { statusCode: 200, body: null };
        const res = {
            status(code) { state.statusCode = code; return this; },
            setHeader() { return this; },
            json(body) { state.body = body; return this; }
        };
        await apiHandler({
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
            body: { action, payload }
        }, res);
        return state;
    }
    const deniedStaffAction = await invokeApi('staff-token', 'deleteExpense');
    assert(deniedStaffAction.statusCode === 403 && databaseCalls === 2, 'Server denies staff access to owner-only actions before modifying data');
    const ownerAction = await invokeApi('owner-token', 'getUsers');
    assert(ownerAction.statusCode === 200 && ownerAction.body.length === 0, 'Server allows owner account-management reads');
    const pinLogin = await invokeApi('', 'loginPin', { role: 'owner', pin: apiPin });
    assert(pinLogin.statusCode === 200 && pinLogin.body.user.id === 'owner-1', 'Server authenticates PINs against stored salted hashes');
    const wrongRolePinLogin = await invokeApi('', 'loginPin', { role: 'staff', pin: apiPin });
    assert(wrongRolePinLogin.statusCode === 401, 'Server rejects a valid PIN submitted for the wrong role');
    const pinSession = await invokeApi(pinLogin.body.accessToken, 'me');
    assert(pinSession.statusCode === 200 && pinSession.body.user.role === 'owner', 'PIN-issued session authorizes shared API access');
    const accountPinSet = await invokeApi('owner-token', 'setPin', { pin: '4321' });
    assert(accountPinSet.statusCode === 200 && savedPinFields?.pin_lookup && savedPinFields?.pin_hash !== '4321', 'Server stores only derived account PIN credentials');
    const revokedPinSession = await invokeApi(pinLogin.body.accessToken, 'me');
    assert(revokedPinSession.statusCode === 401, 'Changing an account PIN revokes existing PIN sessions');
    const invalidPinLogin = await invokeApi('', 'loginPin', { role: 'owner', pin: '0000' });
    assert(invalidPinLogin.statusCode === 401 && rateLimitCalls >= 5, 'Invalid PINs are rejected and attempts are recorded server-side');

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
'@

$nodeScript | node
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Shared Supabase authentication and API tests failed." -ForegroundColor Red
    exit 1
}

Write-Host "[PASS] Shared Supabase authentication and API tests passed." -ForegroundColor Green
