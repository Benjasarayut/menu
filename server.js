const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==========================================
// ⚠️ ใส่ Token ยาวๆ ของคุณที่นี่
const CHANNEL_ACCESS_TOKEN = '4FC23qwpo4NklMYi5W6dgDMU9I3hQexRs6T7A+hvkslOzzlwzpKzSfakAWZiFlFXylvI9HicAv9F/xLJoVLzGC11Xx3RRJihmimr43Zy2MXm3w6In4Vaa94czTR9KVDlcX9jviWRrqyQ9X605gxbtAdB04t89/1O/w1cDnyilFU='; 
const ADMIN_USER_ID = 'Uaee9c1eebc0f49f0190de36b4e3d0bdb';

// 🟢 ตัวแปรนับคิว (เริ่มที่ 1)
let dailyQueue = 1; 
// ==========================================

app.post('/api/order', async (req, res) => {
    try {
        const { name, phone, payment, items, total, type } = req.body;

        // 1. ✅ ตัดคิวปัจจุบัน และเตรียมคิวถัดไป
        const myQueue = dailyQueue;
        dailyQueue++; 

        // 2. จัดข้อความส่งไลน์ (ใส่เลขคิวลงไปด้วย)
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

        // 3. ส่งเข้า LINE
        await axios.post(
            'https://api.line.me/v2/bot/message/push',
            {
                to: ADMIN_USER_ID,
                messages: [{ type: 'text', text: message }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
                }
            }
        );

        console.log(`✅ ออเดอร์คิวที่ ${myQueue} ส่งสำเร็จ!`);

        // 4. ✅ ส่งเลขคิวกลับไปให้หน้าเว็บ (สำคัญมาก!)
        res.json({ status: 'success', queueNumber: myQueue });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ status: 'error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});