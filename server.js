const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==========================================
// ⚠️ ใส่ Token และ User ID ของคุณที่นี่
const CHANNEL_ACCESS_TOKEN = '4FC23qwpo4NklMYi5W6dgDMU9I3hQexRs6T7A+hvkslOzzlwzpKzSfakAWZiFlFXylvI9HicAv9F/xLJoVLzGC11Xx3RRJihmimr43Zy2MXm3w6In4Vaa94czTR9KVDlcX9jviWRrqyQ9X605gxbtAdB04t89/1O/w1cDnyilFU='; 

// 👥 จัดการสิทธิ์ (Role)
// -------------------------------------------------------
// 👑 Admin (คุณเบน): กดปิดปรับปรุงได้ + ทำหน้าที่ Staff ได้ทุกอย่าง
const ADMIN_IDS = [
    'Uaee9c1eebc0f49f0190de36b4e3d0bdb', 
];

// 👨‍🍳 Staff (พนักงาน): กดเปิด/ปิดร้าน + ตัดสต็อกของหมด
const STAFF_IDS = [
    // 'U...ไอดีพนักงาน (ถ้ามี)...', 
];

// 📢 คนรับออเดอร์ (Admin + Staff)
const ORDER_RECEIVERS = [...ADMIN_IDS, ...STAFF_IDS]; 

// ==========================================
// ⚙️ STATE (สถานะร้าน - เก็บไว้ใน Ram Server)
// ==========================================
let shopState = {
    isMaintenance: false, // 🚧 ปิดปรับปรุงระบบ (Admin เท่านั้น)
    isManualClosed: false, // ⛔ กดปิดร้านชั่วคราว (Staff กดได้)
    soldOutItems: []       // 🍗 รายการอาหารที่หมด (เก็บ ID อาหาร)
};

let dailyQueue = 1; 
// ==========================================

// 🔄 API 1: ดึงสถานะร้าน (Frontend จะยิงมาถามก่อนโหลดหน้าเว็บ)
app.get('/api/status', (req, res) => {
    res.json(shopState);
});

// 🔄 API 2: อัปเดตสถานะร้าน (Admin/Staff กดปุ่ม)
app.post('/api/update-status', (req, res) => {
    // ✅ รับ adminPassword เพิ่มเข้ามา
    const { userId, action, value, itemId, adminPassword } = req.body;
    
    // ✅ เช็คสิทธิ์: 1.เป็น Admin ID หรือ 2.รู้รหัสลับ "Admin2007"
    const isAdmin = ADMIN_IDS.includes(userId) || adminPassword === 'Admin2007';
    const isStaff = STAFF_IDS.includes(userId);

    // เช็คสิทธิ์ก่อนทำรายการ (ถ้าไม่ใช่ Admin และไม่ใช่ Staff -> ดีดออก)
    if (!isAdmin && !isStaff) {
        return res.status(403).json({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึง (รหัสผิด)' });
    }

    // 1. 🚧 สลับโหมดปิดปรับปรุง (Admin เท่านั้น)
    if (action === 'toggleMaintenance') {
        if (!isAdmin) return res.status(403).json({ message: 'Admin เท่านั้น' });
        shopState.isMaintenance = value;
    }
    
    // 2. ⛔ สลับโหมดเปิด/ปิดร้าน (Staff/Admin)
    else if (action === 'toggleShop') {
        shopState.isManualClosed = value;
    }

    // 3. 🍗 ตัดสต็อกของหมด (Staff/Admin)
    else if (action === 'toggleStock') {
        if (value === true) { // ของหมด -> เพิ่ม ID เข้า list
            if (!shopState.soldOutItems.includes(itemId)) shopState.soldOutItems.push(itemId);
        } else { // มีของ -> เอา ID ออกจาก list
            shopState.soldOutItems = shopState.soldOutItems.filter(id => id !== itemId);
        }
    }

    console.log("⚙️ Shop State Updated:", shopState);
    res.json({ status: 'success', newState: shopState });
});

// 🔄 API 3: รับออเดอร์
app.post('/api/order', async (req, res) => {
    try {
        const { name, phone, payment, items, total, type, itemIds } = req.body;

        // เช็คความปลอดภัย 1: ร้านปิดปรับปรุงไหม?
        if (shopState.isMaintenance) return res.json({ status: 'error', message: 'ขออภัย ระบบปิดปรับปรุงอยู่ครับ' });
        
        // รันคิว
        const myQueue = dailyQueue;
        dailyQueue++; 

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

        // ส่ง LINE (Multicast)
        if (ORDER_RECEIVERS.length > 0) {
            await axios.post(
                'https://api.line.me/v2/bot/message/multicast', 
                {
                    to: ORDER_RECEIVERS, 
                    messages: [{ type: 'text', text: message }]
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
                    }
                }
            );
        }

        console.log(`✅ ออเดอร์คิวที่ ${myQueue} สำเร็จ!`);
        res.json({ status: 'success', queueNumber: myQueue });

    } catch (error) {
        console.error('❌ Error:', error.message);
        // ส่งข้อความ Error กลับไปบอกหน้าเว็บ ไม่ให้ขึ้น undefined
        res.status(500).json({ 
            status: 'error', 
            message: 'เกิดข้อผิดพลาดที่ Server: ' + error.message 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});