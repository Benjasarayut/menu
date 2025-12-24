const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs'); // 📂 เพิ่มตัวช่วยอ่าน/เขียนไฟล์

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==========================================
// ⚠️ ใส่ Token และ User ID (ระบบจะช่วยลบช่องว่างให้เอง)
const CHANNEL_ACCESS_TOKEN = '4FC23qwpo4NklMYi5W6dgDMU9I3hQexRs6T7A+hvkslOzzlwzpKzSfakAWZiFlFXylvI9HicAv9F/xLJoVLzGC11Xx3RRJihmimr43Zy2MXm3w6In4Vaa94czTR9KVDlcX9jviWRrqyQ9X605gxbtAdB04t89/1O/w1cDnyilFU='; 

// 👑 ADMIN: ใส่ ID คุณเบน
const ADMIN_IDS = [
    'Uaee9c1eebc0f49f0190de36b4e3d0bdb' 
];

// 👨‍🍳 STAFF: ใส่ ID พนักงาน (ถ้าไม่มีให้เว้นว่าง [])
const STAFF_IDS = []; 

// 🧹 ฟังก์ชันทำความสะอาด ID (ลบช่องว่างหัวท้าย)
const cleanId = (id) => id.trim();

// 📢 รวมคนรับออเดอร์ (ลบช่องว่าง + กรองไอดีมั่วออกอัตโนมัติ)
const ORDER_RECEIVERS = [...ADMIN_IDS, ...STAFF_IDS]
    .map(cleanId)
    .filter(id => id.startsWith('U') && id.length > 20);

// ==========================================
// 💾 ระบบจำค่า (Save/Load) - ปิดคอมค่าไม่หาย
// ==========================================
const DATA_FILE = 'shop-state.json';

// ค่าเริ่มต้น
let shopState = {
    isMaintenance: false,
    isManualClosed: false,
    soldOutItems: [] 
};

// 📂 โหลดค่าเดิมมาใช้ (ถ้ามีไฟล์อยู่แล้ว)
if (fs.existsSync(DATA_FILE)) {
    try {
        const rawData = fs.readFileSync(DATA_FILE);
        shopState = JSON.parse(rawData);
        console.log("📂 โหลดการตั้งค่าเดิมเรียบร้อย:", shopState);
    } catch (error) {
        console.error("⚠️ อ่านไฟล์ตั้งค่าผิดพลาด เริ่มต้นใหม่");
    }
}

// 💾 ฟังก์ชันบันทึกค่าลงไฟล์
function saveState() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(shopState, null, 2));
    console.log("💾 บันทึกการตั้งค่าแล้ว");
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
    
    // เช็คสิทธิ์ (รองรับ ID ที่อาจมีช่องว่าง)
    const safeUserId = cleanId(userId);
    const isAdmin = ADMIN_IDS.map(cleanId).includes(safeUserId);
    const isStaff = STAFF_IDS.map(cleanId).includes(safeUserId);

    if (!isAdmin && !isStaff) return res.status(403).json({ status: 'error', message: '⛔ ไม่มีสิทธิ์' });

    // อัปเดตค่า
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

    saveState(); // 💾 กดปุ๊บ บันทึกปั๊บ (Restart ค่าก็ยังอยู่)
    res.json({ status: 'success', newState: shopState });
});

app.post('/api/order', async (req, res) => {
    try {
        const { name, phone, payment, items, total, type, itemIds } = req.body;

        // 🛡️ 1. เช็คปิดปรับปรุง
        if (shopState.isMaintenance) return res.json({ status: 'error', message: '🚧 ระบบปิดปรับปรุงครับ' });

        // 🛡️ 2. เช็คปิดร้าน
        if (shopState.isManualClosed) return res.json({ status: 'error', message: '⛔ ร้านปิดรับออเดอร์ชั่วคราวครับ' });

        // 🛡️ 3. เช็คของหมด (Double Check)
        if (itemIds && itemIds.length > 0) {
            const hasSoldOut = itemIds.some(id => shopState.soldOutItems.includes(id));
            if (hasSoldOut) return res.json({ status: 'error', message: '❌ มีรายการอาหารที่ "หมด" อยู่ในออเดอร์ครับ' });
        }

        // --- ผ่านทุกด่าน ---
        const myQueue = dailyQueue++; 

        const message = `
🔢 คิวที่: ${myQueue}
📌 แบบ: ${type}
------------------------
👤 ลูกค้า: ${name}
📞 โทร: ${phone}
💳 ชำระ: ${payment}
------------------------
${items}
------------------------
💰 ยอดรวม: ${total} บาท`;

        // ส่ง LINE
        if (ORDER_RECEIVERS.length > 0) {
            await axios.post(
                'https://api.line.me/v2/bot/message/multicast', 
                { to: ORDER_RECEIVERS, messages: [{ type: 'text', text: message }] },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN.trim()}` } }
            );
        } else {
            console.log("⚠️ ไม่มี ID ผู้รับออเดอร์ (ข้ามการส่ง LINE)");
        }

        console.log(`✅ ออเดอร์ ${myQueue} สำเร็จ!`);
        res.json({ status: 'success', queueNumber: myQueue });

    } catch (error) {
        console.error('❌ Error Details:', error.response ? error.response.data : error.message);
        let msg = 'Server Error';
        if (error.response && error.response.status === 400) {
             msg = 'Error 400: User ID ใน server.js ไม่ถูกต้อง (เช็คว่ามีช่องว่างหรือไอดีผิด)';
        }
        res.status(500).json({ status: 'error', message: msg });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
    console.log(`👥 คนรับออเดอร์: ${ORDER_RECEIVERS.length} คน (เช็คแล้ว: ${ORDER_RECEIVERS})`);
});