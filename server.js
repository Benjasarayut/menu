const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==========================================
// 💾 จำลอง Database (เก็บข้อมูล 8 โต๊ะ)
// ==========================================
// สร้างตัวแปรเก็บข้อมูลโต๊ะ 1-8 (เริ่มต้นเป็นว่าง null)
let tables = {}; 
for (let i = 1; i <= 8; i++) {
    tables[i] = { status: 'empty', items: [], total: 0 };
}

// ==========================================
// 🚀 API ใหม่สำหรับระบบโต๊ะ
// ==========================================

// 1. ลูกค้าสั่งอาหาร (ระบุเบอร์โต๊ะ)
app.post('/api/order', (req, res) => {
    const { tableNo, items, total } = req.body;

    // เช็คว่าเบอร์โต๊ะถูกต้องไหม (1-8)
    if (!tables[tableNo]) return res.json({ status: 'error', message: 'เบอร์โต๊ะไม่ถูกต้อง' });

    // อัปเดตข้อมูลลงโต๊ะนั้น
    tables[tableNo].status = 'occupied'; // เปลี่ยนสถานะเป็น "ไม่ว่าง"
    tables[tableNo].items.push(...items); // เพิ่มรายการอาหารเข้าไปต่อท้าย
    tables[tableNo].total += parseInt(total); // บวกยอดเงินเพิ่ม

    console.log(`✅ Table ${tableNo} Ordered! Total: ${tables[tableNo].total}`);
    res.json({ status: 'success' });
});

// 2. พนักงานดึงข้อมูลโต๊ะทั้งหมด (ดู Dashboard)
app.get('/api/admin/tables', (req, res) => {
    res.json(tables);
});

// 3. พนักงานกด "เก็บเงินแล้ว" (เคลียร์โต๊ะ)
app.post('/api/admin/clear-table', (req, res) => {
    const { tableNo } = req.body;
    
    if (tables[tableNo]) {
        // ล้างข้อมูลกลับเป็นค่าเริ่มต้น
        tables[tableNo] = { status: 'empty', items: [], total: 0 };
        console.log(`💰 Table ${tableNo} Cleared (Paid)`);
        res.json({ status: 'success' });
    } else {
        res.json({ status: 'error' });
    }
});

// 4. หน้าแรก (กัน Error 404)
app.get('/', (req, res) => {
    res.send('<h1>✅ Server OK (Table System)</h1>');
});

// (API เช็คสถานะเดิม เผื่อใช้)
app.get('/api/status', (req, res) => res.json({ status: 'online' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});