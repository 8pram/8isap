require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const db = require('./config/db');
const cron = require('node-cron');
const { fetchAndProcessRSS } = require('./scraper');

const app = express();
// HTTP server not strictly needed for Vercel, but we keep it for local testing
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// --- REST API ENDPOINTS ---

// 1. Get Summary (Status & Counts)
app.get('/api/v1/dashboard/summary', async (req, res) => {
    try {
        const { data: incidents, error: err1 } = await db.from('incidents').select('*');
        const { data: osint, error: err2 } = await db.from('osint_feeds').select('sentiment_label');
        
        if (err1) throw err1;
        
        // Calculate dynamic summary
        const active_issues = incidents ? incidents.filter(i => i.status === 'Aktif').length : 0;
        const high_threats = incidents ? incidents.filter(i => i.severity_level === 'Tinggi' && i.status === 'Aktif').length : 0;
        let status = 'AMAN';
        if (high_threats >= 3) status = 'SIAGA';
        else if (high_threats > 0 || active_issues > 5) status = 'WASPADA';

        // Calculate true sentiment
        let neg = 0, pos = 0, neu = 0;
        if (osint && osint.length > 0) {
            osint.forEach(item => {
                if(item.sentiment_label === 'Negatif') neg++;
                else if(item.sentiment_label === 'Positif') pos++;
                else neu++;
            });
            const total = neg + pos + neu;
            neg = Math.round((neg/total)*100);
            pos = Math.round((pos/total)*100);
            neu = Math.round((neu/total)*100);
        } else {
            neu = 100; // default
        }

        res.json({
            status: status,
            active_issues: active_issues,
            high_threats: high_threats,
            total_articles: osint ? osint.length : 0,
            sentiment: { negative: neg, neutral: neu, positive: pos }
        });
    } catch (err) {
        console.error("DB Error:", err);
        res.json({ status: 'AMAN', active_issues: 0, high_threats: 0, total_articles: 0, sentiment: { negative: 0, neutral: 100, positive: 0 } });
    }
});

// 2. Get Top Issues
app.get('/api/v1/incidents/top', async (req, res) => {
    const { region } = req.query;
    try {
        let query = db.from('incidents').select('*').order('created_at', { ascending: false }).limit(10);
        if (region && region !== 'Nasional') query = query.eq('region', region);
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) return res.json(data);
        res.json([]);
    } catch (err) {
        res.json([]);
    }
});

// 3. Get Recent OSINT
app.get('/api/v1/osint', async (req, res) => {
    try {
        const { data, error } = await db.from('osint_feeds').select('*').order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

// 4. Get Trending Keywords (Extracted from news titles)
app.get('/api/v1/analytics/keywords', async (req, res) => {
    try {
        const { data, error } = await db.from('osint_feeds').select('content');
        if (error) throw error;
        
        let wordMap = {};
        const stopwords = ['di','ke','dari','dan','atau','yang','untuk','dengan','ini','itu','pada','dalam','akan','telah','bisa','ada','tidak','saat'];
        data.forEach(item => {
            if(item.content) {
                const words = item.content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
                words.forEach(w => {
                    if (w.length > 3 && !stopwords.includes(w)) {
                        wordMap[w] = (wordMap[w] || 0) + 1;
                    }
                });
            }
        });
        
        const sortedWords = Object.entries(wordMap).map(([word, count]) => ({word, count})).sort((a,b) => b.count - a.count).slice(0, 15);
        res.json(sortedWords);
    } catch (err) {
        res.json([]);
    }
});

// 5. Get Top News Sources
app.get('/api/v1/analytics/sources', async (req, res) => {
    try {
        const { data, error } = await db.from('osint_feeds').select('source_user');
        if (error) throw error;
        
        let sourceMap = {};
        data.forEach(item => {
            const source = item.source_user || 'Unknown Source';
            sourceMap[source] = (sourceMap[source] || 0) + 1;
        });
        
        const sortedSources = Object.entries(sourceMap).map(([source, count]) => ({source, count})).sort((a,b) => b.count - a.count).slice(0, 5);
        res.json(sortedSources);
    } catch (err) {
        res.json([]);
    }
});

// 6. Get Top Relevant/Critical News
app.get('/api/v1/analytics/critical', async (req, res) => {
    try {
        const { data, error } = await db.from('osint_feeds').select('*').in('sentiment_label', ['Negatif']).order('created_at', { ascending: false }).limit(5);
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

// 7. Get EWS Alerts (Active Incidents Merah/Oranye)
app.get('/api/v1/alerts/active', async (req, res) => {
    try {
        const { data, error } = await db.from('incidents').select('*').in('severity_level', ['Merah', 'Oranye']).eq('status', 'Aktif').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

// 4. VERCEL CRON ENDPOINT (Replaces background node-cron)
app.get('/api/v1/cron/scrape', async (req, res) => {
    // Vercel Cron will hit this URL every 15 minutes
    console.log("[ISAP] Menerima trigger Vercel Cron untuk Scraping...");
    try {
        // Execute scraper
        const logs = await fetchAndProcessRSS(db);
        res.status(200).json({ success: true, message: "Scraping cycle completed", logs: logs });
    } catch (error) {
        console.error("[ISAP] Scraper error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// --- SERVER START (For Local Testing Only) ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`[ISAP] Local Serverless Dev Server running on port ${PORT}`);
        
        // Local Cron (Hanya aktif jika dijalankan di laptop, bukan di Vercel)
        console.log(`[ISAP] Memulai Local Scraper Scheduler...`);
        cron.schedule('*/15 * * * *', () => {
            fetchAndProcessRSS(db);
        });
        setTimeout(() => fetchAndProcessRSS(db), 5000);
    });
}

// Export for Vercel Serverless
module.exports = app;
