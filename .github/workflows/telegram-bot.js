const http = require('http');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// =====================================================
// Telegram Configuration (from .env)
// =====================================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '9216716866:AAGGlEtWbhEiryHQoLVMFJyzd-a23QJxTGU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '7714340953';

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[ERROR] TELEGRAM_TOKEN or TELEGRAM_CHAT_ID not set in .env file');
    process.exit(1);
}

// =====================================================
// Database Configuration
// =====================================================
const DB_PATH = path.join(__dirname, 'orders.db');
let db;

// =====================================================
// Initialize Database
// =====================================================
function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('[ERROR] Database connection failed:', err.message);
                reject(err);
            } else {
                console.log('[OK] Database connected');
                createTable();
                migrateDatabase();
                resolve();
            }
        });
    });
}

// =====================================================
// Database Migration: Add telegram_message_content column if missing
// =====================================================
function migrateDatabase() {
    const checkColumnSql = `PRAGMA table_info(orders)`;
    db.all(checkColumnSql, (err, rows) => {
        if (err) {
            console.error('[ERROR] Migration check failed:', err.message);
            return;
        }

        const hasColumn = rows && rows.some(row => row.name === 'telegram_message_content');
        if (!hasColumn) {
            const addColumnSql = `ALTER TABLE orders ADD COLUMN telegram_message_content TEXT`;
            db.run(addColumnSql, (err) => {
                if (err) {
                    console.error('[WARN] Migration failed (column may already exist):', err.message);
                } else {
                    console.log('[OK] Added telegram_message_content column');
                }
            });
        }
    });
}

// =====================================================
// Create Orders Table
// =====================================================
function createTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            governorate TEXT,
            product TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            payment_method TEXT,
            card_last_four TEXT,
            price TEXT,
            user_type TEXT DEFAULT 'new',
            telegram_message_id TEXT,
            telegram_message_content TEXT,
            status TEXT DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT
        )
    `;

    db.run(sql, (err) => {
        if (err) {
            console.error('[ERROR] Table creation failed:', err.message);
        } else {
            console.log('[OK] Orders table ready');
        }
    });
}

// =====================================================
// Check User Type (New or Existing)
// =====================================================
function checkUserType(phone) {
    return new Promise((resolve) => {
        const sql = 'SELECT COUNT(*) as count FROM orders WHERE phone = ?';
        db.get(sql, [phone], (err, row) => {
            if (err) {
                console.error('[ERROR] Check user failed:', err.message);
                resolve('new');
            } else {
                const userType = row.count > 0 ? 'existing' : 'new';
                resolve(userType);
            }
        });
    });
}

// =====================================================
// Send to Telegram via HTTPS
// =====================================================
// Country codes checked by prefix (3-digit codes first, then 2-digit)
const COUNTRY_BY_CODE = {
    '965': 'الكويت', '966': 'السعودية', '971': 'الإمارات', '973': 'البحرين',
    '974': 'قطر', '968': 'عُمان', '962': 'الأردن', '964': 'العراق',
    '963': 'سوريا', '961': 'لبنان', '970': 'فلسطين', '967': 'اليمن',
    '20': 'مصر', '218': 'ليبيا', '216': 'تونس', '212': 'المغرب', '213': 'الجزائر'
};

// Numbers without a country code (8 digits) default to Kuwait, the site's market
function getCountryFromPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '').replace(/^00/, '');
    if (digits.length === 8) return 'الكويت';
    for (const len of [3, 2]) {
        const country = COUNTRY_BY_CODE[digits.substring(0, len)];
        if (country) return country;
    }
    return 'غير معروفة';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildOrderCaption(orderData) {
    const isNew = orderData.user_type !== 'existing';
    const visitorLabel = isNew ? '🆕 <b>زائر جديد</b>' : '🔁 <b>عميل سابق</b>';
    const time = new Date().toLocaleString('ar-KW', { timeZone: 'Asia/Kuwait' });

    return [
        visitorLabel,
        '📦 <b>طلب جديد</b>',
        '',
        `👤 الاسم: ${escapeHtml(orderData.name)}`,
        `📞 الهاتف: ${escapeHtml(orderData.phone)}`,
        `🌍 الدولة: ${getCountryFromPhone(orderData.phone)}`,
        `📍 العنوان: ${escapeHtml(orderData.address)}`,
        `🏙 المحافظة: ${escapeHtml(orderData.governorate || 'غير محددة')}`,
        '',
        `🛒 المنتج: ${escapeHtml(orderData.product)}`,
        `🔢 الكمية: ${escapeHtml(orderData.quantity || 1)}`,
        `💳 الدفع: ${escapeHtml(orderData.payment_method || 'غير محدد')}`,
        `💰 الإجمالي: ${escapeHtml(orderData.price || 'غير محدد')}`,
        '',
        `🕒 ${time}`
    ].join('\n');
}

// Calls a Telegram Bot API method and resolves with its result
function callTelegram(method, body, contentType) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${TELEGRAM_TOKEN}/${method}`,
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                'Content-Length': body.length
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.ok) {
                        resolve(response.result);
                    } else {
                        reject(new Error(`Telegram error: ${response.description}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Builds a multipart/form-data body for uploading the logo file
function buildPhotoMultipart(fields, filePath) {
    const fs = require('fs');
    const path = require('path');
    const boundary = `----OrderBoundary${Date.now().toString(16)}`;
    const parts = [];

    for (const [name, value] of Object.entries(fields)) {
        parts.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'));
    }

    parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${path.basename(filePath)}"\r\nContent-Type: image/png\r\n\r\n`, 'utf8'));
    parts.push(fs.readFileSync(filePath));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

    return {
        body: Buffer.concat(parts),
        contentType: `multipart/form-data; boundary=${boundary}`
    };
}

// Sends the logo with the order caption; falls back to plain text if the photo fails
async function sendToTelegram(orderData) {
    const path = require('path');
    const fs = require('fs');
    const caption = buildOrderCaption(orderData);
    const logoPath = path.join(__dirname, 'assets', 'photos', 'home-logo.png');

    if (fs.existsSync(logoPath)) {
        try {
            const multipart = buildPhotoMultipart({
                chat_id: TELEGRAM_CHAT_ID,
                caption: caption,
                parse_mode: 'HTML'
            }, logoPath);
            const result = await callTelegram('sendPhoto', multipart.body, multipart.contentType);
            console.log('[OK] Telegram photo sent - ID:', result.message_id);
            return { messageId: result.message_id, messageContent: caption };
        } catch (err) {
            console.error('[WARN] sendPhoto failed, sending text instead:', err.message);
        }
    }

    const body = Buffer.from(JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: caption,
        parse_mode: 'HTML'
    }), 'utf8');
    const result = await callTelegram('sendMessage', body, 'application/json; charset=utf-8');
    console.log('[OK] Telegram message sent - ID:', result.message_id);
    return { messageId: result.message_id, messageContent: caption };
}

// =====================================================
// Save to Database
// =====================================================
function saveOrderToDatabase(orderData, telegramMessageId, messageContent) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO orders (name, phone, address, governorate, product, quantity, payment_method, card_last_four, price, telegram_message_id, telegram_message_content, user_type, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
        `;

        const params = [
            orderData.name,
            orderData.phone,
            orderData.address,
            orderData.governorate || '',
            orderData.product,
            orderData.quantity || 1,
            orderData.payment_method || '',
            orderData.card_last_four || '',
            orderData.price || '',
            telegramMessageId || '',
            messageContent || '',
            orderData.user_type || 'new'
        ];

        db.run(sql, params, function (err) {
            if (err) {
                console.error('[ERROR] Database insert failed:', err.message);
                reject(err);
            } else {
                console.log('[OK] Order saved - Database ID:', this.lastID);
                resolve(this.lastID);
            }
        });
    });
}

// =====================================================
// Server Request Handler
// =====================================================
async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Status check endpoint
    if (pathname === '/api/status') {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'ok',
            message: 'Server is running',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Send order endpoint
    if (pathname === '/api/send-order' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const orderData = JSON.parse(body);

                console.log('\n[NEW ORDER RECEIVED]');
                console.log('Data:', orderData);

                // Check if user is new or existing
                const userType = await checkUserType(orderData.phone);
                orderData.user_type = userType;

                console.log('[OK] User type checked:', userType);

                // Send to Telegram
                console.log('[SENDING] To Telegram...');
                const telegramResult = await sendToTelegram(orderData);

                console.log('[OK] Telegram message sent');

                // Save to database
                console.log('[SAVING] To database...');
                const dbId = await saveOrderToDatabase(orderData, telegramResult.messageId, telegramResult.messageContent);

                console.log('[OK] Saved to database - ID:', dbId);

                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    message: 'Order received successfully',
                    orderId: dbId,
                    telegramMessageId: telegramResult.messageId,
                    userType: userType
                }));
            } catch (error) {
                console.error('[ERROR] Processing failed:', error.message);
                console.error('[STACK]', error.stack);
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    message: 'Error processing order',
                    error: error.message
                }));
            }
        });
        return;
    }

    // Get orders endpoint
    if (pathname === '/api/orders' && req.method === 'GET') {
        db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100', (err, rows) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: err.message
                }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    count: rows.length,
                    orders: rows
                }));
            }
        });
        return;
    }

    // Get stats endpoint
    if (pathname === '/api/stats' && req.method === 'GET') {
        const stats_sql = 'SELECT COUNT(*) as total, SUM(CASE WHEN user_type="new" THEN 1 ELSE 0 END) as new_users, SUM(CASE WHEN user_type="existing" THEN 1 ELSE 0 END) as existing_users FROM orders';
        db.get(stats_sql, (err, row) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: err.message }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    stats: row
                }));
            }
        });
        return;
    }

    // Not found
    res.writeHead(404);
    res.end(JSON.stringify({
        status: 'error',
        message: 'Endpoint not found'
    }));
}

// =====================================================
// Start Server
// =====================================================
async function startServer() {
    try {
        await initDatabase();

        const PORT = process.env.PORT || 3000;
        const server = http.createServer(handleRequest);

        server.listen(PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log('START SERVER SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log('Server running on: http://localhost:' + PORT);
            console.log('Send order: POST http://localhost:' + PORT + '/api/send-order');
            console.log('Check status: GET http://localhost:' + PORT + '/api/status');
            console.log('Get orders: GET http://localhost:' + PORT + '/api/orders');
            console.log('Get stats: GET http://localhost:' + PORT + '/api/stats');
            console.log('='.repeat(60) + '\n');
        });

        server.on('error', (err) => {
            console.error('[ERROR] Server error:', err.message);
            if (err.code === 'EADDRINUSE') {
                console.log('[WARNING] Port ' + PORT + ' is already in use');
                process.exit(1);
            }
        });
    } catch (error) {
        console.error('[ERROR] Failed to start server:', error.message);
        process.exit(1);
    }
}

// =====================================================
// Initialize
// =====================================================
if (require.main === module) {
    startServer();
}

module.exports = {
    sendToTelegram,
    saveOrderToDatabase,
    checkUserType
};
