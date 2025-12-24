const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs'); 

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==========================================
// ⚠️ ใส่ Token และ User ID
const CHANNEL_ACCESS_TOKEN = '4FC23qwpo4NklMYi5W6dgDMU9I3hQexRs6T7A+hvkslOzzlwzpKzSfakAWZiFlFXylvI9HicAv9F/xLJoVLzGC11Xx3RRJihmimr43Zy2MXm3w6In4Vaa94czTR9KVDlcX9jviWRrqyQ9X605gxbtAdB04t89/1O/w1cDnyilFU='; 

// 👑 ADMIN
const ADMIN_IDS = [
    'Uaee9c1eebc0f49f0190de36b4e3d0bdb' 
];

// 👨‍🍳 STAFF
const STAFF_IDS = []; 

const cleanId = (id) => id.trim();
const ORDER_RECEIVERS = [...ADMIN_IDS, ...STAFF_IDS]
    .map(cleanId)
    .filter(id => id.startsWith('U') && id.length > 20);

// ==========================================
// 💾 ระบบจำค่า
// ==========================================
const DATA_FILE = 'shop-state.json';
let shopState = { isMaintenance: false, isManualClosed: false, soldOutItems: [] };

if (fs.existsSync(DATA_FILE)) {
    try {
        shopState = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (error) { console.error("Load state failed"); }
}

function saveState() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(shopState, null, 2));
}

let dailyQueue = 1; 

// ==========================================
// 🚀 API
// ==========================================

app.get('/api/status', (req, res) => {
    res.json(shopState);
});

app.post('/api/update-status', (req, res) => {
    const { userId, action, value, itemId } = req.body;
    const safeUserId = cleanId(userId);
    const isAdmin = ADMIN_IDS.map(cleanId).includes(safeUserId);
    const isStaff = STAFF_IDS.map(cleanId).includes(safeUserId);

    if (!isAdmin && !isStaff) return res.status(403).json({ status: 'error', message: '⛔ ไม่มีสิทธิ์' });

    if (action === 'toggleMaintenance') {
        if (!isAdmin) return res.status(403).json({ message: 'Admin Only' });
        shopState.isMaintenance = value;
    } else if (action === 'toggleShop') {
        shopState.isManualClosed = value;
    } else if (action === 'toggleStock') {
        if (value) {
            if (!shopState.soldOutItems.includes(itemId)) shopState.soldOutItems.push(itemId);
        } else {
            shopState.soldOutItems = shopState.soldOutItems.filter(id => id !== itemId);
        }
    }
    saveState(); 
    res.json({ status: 'success', newState: shopState });
});

app.post('/api/order', async (req, res) => {
    try {
        const { name, phone, payment, items, total, type, itemIds, note } = req.body;

        // เช็คสถานะร้านก่อน
        if (shopState.isMaintenance) return res.json({ status: 'error', message: '🚧 ระบบปิดปรับปรุงครับ' });
        if (shopState.isManualClosed) return res.json({ status: 'error', message: '⛔ ร้านปิดรับออเดอร์ชั่วคราวครับ' });
        if (itemIds && itemIds.length > 0) {
            const hasSoldOut = itemIds.some(id => shopState.soldOutItems.includes(id));
            if (hasSoldOut) return res.json({ status: 'error', message: '❌ มีรายการอาหารที่ "หมด" อยู่ในออเดอร์ครับ' });
        }

        // รันคิว
        const myQueue = dailyQueue++; 

        // ✅ ตอบกลับลูกค้า "ทันที" (ไม่ต้องรอ LINE) เพื่อความรวดเร็ว
        res.json({ status: 'success', queueNumber: myQueue });

        // --- ส่วนส่ง LINE ทำงานทีหลัง (Background Process) ---
        const message = `
🔢 คิวที่: ${myQueue}
📌 แบบ: ${type}
------------------------
👤 ลูกค้า: ${name}
📞 โทร: ${phone || '-'}
💳 ชำระ: ${payment}
------------------------
${items}
------------------------
📝 หมายเหตุ: ${note || '-'}
------------------------
💰 ยอดรวม: ${total} บาท`;

        if (ORDER_RECEIVERS.length > 0) {
            // ไม่ต้องใส่ await (Fire and Forget)
            axios.post(
                'https://api.line.me/v2/bot/message/multicast', 
                { to: ORDER_RECEIVERS, messages: [{ type: 'text', text: message }] },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN.trim()}` } }
            ).catch(err => console.error("LINE Send Error:", err.message));
        }

        console.log(`✅ Order #${myQueue} processed instantly.`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        // ถ้า error ก่อนที่จะส่ง res.json ให้แจ้งกลับไป
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Server Error' });
        }
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});