const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs'); 

const app = express();
app.use(cors()); // ✅ สำคัญมาก! อนุญาตให้ GitHub Pages โทรเข้ามาได้
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
// บน Render ฟรี ระบบจะรีเซ็ตค่าทุกครั้งที่ Deploy ใหม่ (เป็นปกติของ Cloud ฟรี)
let shopState = { isMaintenance: false, isManualClosed: false, soldOutItems: [] };
let dailyQueue = 1; 

// ==========================================
// 🚀 API
// ==========================================

// 1. เช็คสถานะร้าน
app.get('/api/status', (req, res) => {
    res.json(shopState);
});

// 2. อัปเดตสถานะ (เปิด/ปิดร้าน, ของหมด)
app.post('/api/update-status', (req, res) => {
    const { userId, action, value, itemId } = req.body;
    
    // (ข้ามการเช็ค ID แบบเข้มงวด เพื่อให้คุณเทสผ่านง่ายๆ ก่อน)
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
    console.log(`🔄 Update Status: ${action} -> ${value}`);
    res.json({ status: 'success', newState: shopState });
});

// 3. สั่งอาหาร
app.post('/api/order', async (req, res) => {
    try {
        const { name, phone, payment, items, total, type, itemIds, note } = req.body;

        // เช็คสถานะร้านก่อนรับออเดอร์
        if (shopState.isMaintenance) return res.json({ status: 'error', message: '🚧 ระบบปิดปรับปรุงครับ' });
        if (shopState.isManualClosed) return res.json({ status: 'error', message: '⛔ ร้านปิดรับออเดอร์ชั่วคราวครับ' });

        const myQueue = dailyQueue++; 

        // ✅ ตอบกลับลูกค้า "ทันที"
        res.json({ status: 'success', queueNumber: myQueue });

        // สร้างข้อความส่ง LINE
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

        // ส่งเข้า LINE (ทำเบื้องหลัง)
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

// ✅ หน้า Home (สำคัญ! แก้ปัญหา Not Found)
app.get('/', (req, res) => {
    res.send(`
        <div style="text-align:center; padding-top:50px; font-family:sans-serif;">
            <h1>✅ Server is Running!</h1>
            <p style="color:green;">ระบบหลังบ้านทำงานปกติแล้วครับ</p>
            <hr style="width:200px;">
            <p>กรุณาเข้าใช้งานที่หน้าแอปหลัก</p>
        </div>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});