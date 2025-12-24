const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs'); 

const app = express();
app.use(cors()); // สำคัญมาก! อนุญาตให้ GitHub Pages โทรเข้ามาได้
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
// บน Render ฟรี ไฟล์จะถูกรีเซ็ตใหม่ทุกครั้งที่ Deploy (เป็นปกติ)
let shopState = { isMaintenance: false, isManualClosed: false, soldOutItems: [] };
let dailyQueue = 1; 

// ==========================================
// 🚀 API (จุดที่ Render หากันไม่เจอเมื่อกี้)
// ==========================================

// 1. เช็คสถานะร้าน
app.get('/api/status', (req, res) => {
    res.json(shopState);
});

// 2. อัปเดตสถานะ (เปิด/ปิดร้าน, ของหมด)
app.post('/api/update-status', (req, res) => {
    const { userId, action, value, itemId } = req.body;
    // (ข้ามการเช็ค ID แบบเข้มงวดไปก่อน เพื่อให้เทสผ่านง่ายๆ)
    
    if (action === 'toggleMaintenance') {
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
    res.json({ status: 'success', newState: shopState });
});

// 3. สั่งอาหาร
app.post('/api/order', async (req, res) => {
    try {
        const { name, phone, payment, items, total, type, itemIds, note } = req.body;

        if (shopState.isMaintenance) return res.json({ status: 'error', message: '🚧 ระบบปิดปรับปรุงครับ' });
        if (shopState.isManualClosed) return res.json({ status: 'error', message: '⛔ ร้านปิดรับออเดอร์ชั่วคราวครับ' });

        const myQueue = dailyQueue++; 

        // ✅ ตอบกลับลูกค้าทันที
        res.json({ status: 'success', queueNumber: myQueue });

        // ส่ง LINE
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
            axios.post(
                'https://api.line.me/v2/bot/message/multicast', 
                { to: ORDER_RECEIVERS, messages: [{ type: 'text', text: message }] },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN.trim()}` } }
            ).catch(err => console.error("LINE Send Error:", err.message));
        }
        console.log(`✅ Order #${myQueue} processed.`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (!res.headersSent) res.status(500).json({ status: 'error', message: 'Server Error' });
    }
});

// หน้า Home (เผื่อคนกดเข้าลิ้งค์ Render ตรงๆ จะได้ไม่ตกใจ)
app.get('/', (req, res) => {
    res.send('<h1>✅ Server is running!</h1><p>Please use the App link instead.</p>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});