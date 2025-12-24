const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors()); // อนุญาตให้หน้าบ้านคุยกับหลังบ้านได้
app.use(bodyParser.json());

// ==========================================
// 💾 จำลอง Database (เก็บข้อมูล 8 โต๊ะ)
// ==========================================
let tables = {}; 
for (let i = 1; i <= 8; i++) {
    tables[i] = { status: 'empty', items: [], total: 0 };
}

// ==========================================
// 🚀 API (จุดเชื่อมต่อ)
// ==========================================

// 1. ดึงข้อมูลโต๊ะทั้งหมด (สำหรับ Admin) -> แก้ปัญหา Loading ค้าง
app.get('/api/admin/tables', (req, res) => {
    res.json(tables);
});

// 2. ลูกค้าสั่งอาหาร
app.post('/api/order', (req, res) => {
    const { tableNo, items, total } = req.body;
    if (!tables[tableNo]) return res.json({ status: 'error', message: 'Wrong Table' });

    tables[tableNo].status = 'occupied';
    tables[tableNo].items.push(...items);
    tables[tableNo].total += parseInt(total);
    
    console.log(`Table ${tableNo} Ordered!`);
    res.json({ status: 'success' });
});

// 3. เคลียร์โต๊ะ (เก็บเงิน)
app.post('/api/admin/clear-table', (req, res) => {
    const { tableNo } = req.body;
    if (tables[tableNo]) {
        tables[tableNo] = { status: 'empty', items: [], total: 0 };
        res.json({ status: 'success' });
    } else {
        res.json({ status: 'error' });
    }
});

// หน้าแรก (กัน Error 404)
app.get('/', (req, res) => res.send('<h1>✅ Server is Running (Table System)</h1>'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));