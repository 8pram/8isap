require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const db = require('./config/db');
const cron = require('node-cron');
const { fetchAndProcessRSS } = require('./scraper');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// --- REST API ENDPOINTS ---

// 1. Get Summary (Status & Counts)
app.get('/api/v1/dashboard/summary', async (req, res) => {
    try {
        const { data: incidents, error } = await db.from('incidents').select('*');
        
        if (error) throw error;
        
        // Calculate dynamic summary
        const active_issues = incidents ? incidents.length : 0;
        const high_threats = incidents ? incidents.filter(i => i.severity_level === 'Tinggi').length : 0;
        let status = 'AMAN';
        if (high_threats > 5) status = 'SIAGA';
        else if (high_threats > 0) status = 'WASPADA';

        res.json({
            status: status,
            active_issues: active_issues > 0 ? active_issues : 124, // Fallback mock if 0 for demo
            high_threats: high_threats > 0 ? high_threats : 7,
            sentiment: { negative: 68, neutral: 20, positive: 12 } // Can be queried from sentiment_analytics later
        });
    } catch (err) {
        console.error("DB Error:", err);
        // Fallback to mock if db not configured
        res.json({
            status: 'SIAGA',
            active_issues: 124,
            high_threats: 7,
            sentiment: { negative: 68, neutral: 20, positive: 12 }
        });
    }
});

// 2. Get Top Issues
app.get('/api/v1/incidents/top', async (req, res) => {
    const { region } = req.query; // Pasuruan, Jatim, Nasional
    try {
        let query = db.from('incidents').select('*').order('created_at', { ascending: false }).limit(10);
        if (region && region !== 'Nasional') {
            query = query.eq('region', region);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
            return res.json(data);
        }
        
        // Fallback mock
        res.json([
            { id: 1, title: 'Potensi Unjuk Rasa Buruh PIER', category: 'Kamtibmas', severity_level: 'Tinggi' },
            { id: 2, title: 'Hoaks Penculikan Anak', category: 'Siber', severity_level: 'Sedang' }
        ]);
    } catch (err) {
        res.json([
            { id: 1, title: 'Potensi Unjuk Rasa Buruh PIER', category: 'Kamtibmas', severity_level: 'Tinggi' },
            { id: 2, title: 'Hoaks Penculikan Anak', category: 'Siber', severity_level: 'Sedang' }
        ]);
    }
});

// 3. Get Recent OSINT
app.get('/api/v1/osint', async (req, res) => {
    try {
        const { data, error } = await db.from('osint_feeds').select('*').order('created_at', { ascending: false }).limit(15);
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

// --- WEBSOCKET FOR REAL-TIME FEED ---

// Menyimpan semua client yang terhubung
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('New Intel Client Connected');
    clients.add(ws);

    // Kirim pesan selamat datang
    ws.send(JSON.stringify({ type: 'SYSTEM', message: 'Connected to ISAP Command Center' }));

    ws.on('close', () => {
        console.log('Client Disconnected');
        clients.delete(ws);
    });
});

// Fungsi untuk mengirim OSINT feed baru ke semua client (dipanggil oleh Python Scraper nantinya via Webhook)
app.post('/internal/webhook/osint', (req, res) => {
    const newData = req.body; // Data dari Python (contoh: hasil sentimen twitter)
    
    // Broadcast ke semua frontend yang terkoneksi
    const payload = JSON.stringify({
        type: 'NEW_OSINT',
        data: newData
    });

    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });

    res.status(200).json({ success: true, message: 'Broadcasted to UI' });
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[ISAP] API Gateway & WebSocket Server running on port ${PORT}`);
    
    // Mulai Background Scraper 24/7 (Berjalan setiap 15 Menit)
    console.log(`[ISAP] Memulai Node.js Scraper Scheduler...`);
    cron.schedule('*/15 * * * *', () => {
        fetchAndProcessRSS(db);
    });
    
    // Jalankan sekali saat server pertama kali menyala (opsional, untuk memastikan langsung ada data)
    setTimeout(() => {
        fetchAndProcessRSS(db);
    }, 5000);
});
