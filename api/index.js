require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const db = require('./config/db');
const cron = require('node-cron');
const { fetchAndProcessRSS } = require('./scraper');
const Parser = require('rss-parser');
const rssParser = new Parser({ timeout: 8000 });

const app = express();
// HTTP server not strictly needed for Vercel, but we keep it for local testing
const server = http.createServer(app);

// Middleware — explicit CORS headers for Vercel serverless reliability
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
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
        if (region) query = query.eq('region', region);
        
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

// 8. Dashboard Status (full status with category breakdowns for sidebar)
app.get('/api/v1/dashboard/status', async (req, res) => {
    try {
        const { data: incidents } = await db.from('incidents').select('*').eq('status', 'Aktif');
        const { data: osint } = await db.from('osint_feeds').select('ai_classification, category, sentiment_label');
        
        const active_issues = incidents ? incidents.length : 0;
        const high_threats = incidents ? incidents.filter(i => ['Merah', 'Oranye', 'Tinggi'].includes(i.severity_level)).length : 0;
        
        // Determine status dynamically
        let status = 'AMAN';
        let statusColor = 'emerald';
        if (high_threats >= 5) { status = 'SIAGA'; statusColor = 'red'; }
        else if (high_threats >= 2 || active_issues > 10) { status = 'WASPADA'; statusColor = 'amber'; }
        
        // Category breakdown from incidents
        let categoryMap = {};
        if (incidents) {
            incidents.forEach(i => {
                const cat = i.category || 'Lainnya';
                categoryMap[cat] = (categoryMap[cat] || 0) + 1;
            });
        }
        
        // Threat category percentages for sentiment bars
        const total = active_issues || 1;
        const provokasi = incidents ? incidents.filter(i => ['Kamtibmas'].includes(i.category)).length : 0;
        const hoaks = incidents ? incidents.filter(i => ['Siber/Teror'].includes(i.category)).length : 0;
        const kriminal = incidents ? incidents.filter(i => ['Kriminal'].includes(i.category)).length : 0;
        
        res.json({
            status,
            statusColor,
            active_issues,
            high_threats,
            total_articles: osint ? osint.length : 0,
            categories: categoryMap,
            threat_bars: {
                provokasi: Math.round((provokasi / total) * 100),
                hoaks: Math.round((hoaks / total) * 100),
                kriminal: Math.round((kriminal / total) * 100)
            }
        });
    } catch (err) {
        console.error("Status Error:", err);
        res.json({ status: 'AMAN', statusColor: 'emerald', active_issues: 0, high_threats: 0, total_articles: 0, categories: {}, threat_bars: { provokasi: 0, hoaks: 0, kriminal: 0 } });
    }
});

// 9. AI Recommendation Engine (generates recommendations from real data)
app.get('/api/v1/ai/recommendation', async (req, res) => {
    try {
        const { data: recentIncidents } = await db.from('incidents').select('*').eq('status', 'Aktif').order('created_at', { ascending: false }).limit(10);
        const { data: negativeOsint } = await db.from('osint_feeds').select('*').eq('sentiment_label', 'Negatif').order('created_at', { ascending: false }).limit(5);
        
        // Build recommendation based on actual data patterns
        let preventif = '';
        let intelijen = '';
        let pengamanan = '';
        let topKeywords = [];
        let topRegions = [];
        
        if (recentIncidents && recentIncidents.length > 0) {
            // Extract patterns
            let regionMap = {};
            let catMap = {};
            recentIncidents.forEach(i => {
                regionMap[i.region] = (regionMap[i.region] || 0) + 1;
                catMap[i.category] = (catMap[i.category] || 0) + 1;
            });
            topRegions = Object.entries(regionMap).sort((a,b) => b[1] - a[1]).slice(0, 3).map(r => r[0]);
            const topCats = Object.entries(catMap).sort((a,b) => b[1] - a[1]);
            
            // Generate contextual recommendations
            const topCat = topCats[0] ? topCats[0][0] : 'Sosial';
            const topRegion = topRegions[0] || 'Pasuruan';
            
            if (topCat === 'Kamtibmas') {
                preventif = `Tingkatkan patroli fisik dan monitoring CCTV di wilayah ${topRegion}. Koordinasi dengan Bhabinkamtibmas untuk pencegahan eskalasi konflik sosial.`;
                intelijen = `Lakukan pendalaman informasi terhadap ${recentIncidents.length} isu aktif di area ${topRegions.join(', ')}. Identifikasi aktor kunci dan jaringan provokator.`;
                pengamanan = `Siapkan personel pengamanan standby di titik-titik rawan ${topRegion}. Aktifkan jalur koordinasi lintas instansi.`;
            } else if (topCat === 'Siber/Teror') {
                preventif = `Intensifkan counter-narasi digital di media sosial untuk wilayah ${topRegion}. Monitor penyebaran konten hoaks melalui grup WhatsApp dan Telegram.`;
                intelijen = `Validasi ${recentIncidents.length} konten yang terdeteksi sebagai hoaks/provokasi. Lacak sumber penyebaran dan identifikasi akun-akun utama.`;
                pengamanan = `Koordinasi dengan Divisi Siber untuk takedown konten hoaks. Edukasi publik melalui kanal resmi pemerintah daerah.`;
            } else if (topCat === 'Kriminal') {
                preventif = `Tingkatkan patroli di jalur-jalur rawan kriminalitas area ${topRegion}. Optimalkan CCTV dan penerangan jalan.`;
                intelijen = `Analisis pola kejadian kriminal ${recentIncidents.length} kasus terakhir. Identifikasi modus operandi dan jam-jam rawan.`;
                pengamanan = `Tingkatkan visible police presence di area hotspot. Koordinasi dengan komunitas warga untuk sistem pelaporan cepat.`;
            } else {
                preventif = `Monitor perkembangan ${recentIncidents.length} isu aktif di wilayah ${topRegion}. Pastikan komunikasi publik tetap terbuka dan transparan.`;
                intelijen = `Lanjutkan pengumpulan data dari sumber OSINT untuk validasi informasi terkini di area ${topRegions.join(', ')}.`;
                pengamanan = `Pertahankan tingkat kesiapsiagaan normal dengan monitoring rutin terhadap dinamika wilayah.`;
            }
        } else {
            preventif = 'Situasi dalam kondisi aman dan terkendali. Lanjutkan monitoring rutin dan patroli preventif sesuai jadwal.';
            intelijen = 'Tidak ada isu strategis yang memerlukan pendalaman. Pertahankan operasi sapuan informasi dari sumber OSINT.';
            pengamanan = 'Pertahankan tingkat kesiapsiagaan normal. Pastikan koordinasi lintas instansi tetap aktif.';
        }
        
        // Extract keywords from negative content
        if (negativeOsint && negativeOsint.length > 0) {
            let kwMap = {};
            const stopwords = [
                'di','ke','dari','dan','atau','yang','untuk','dengan','ini','itu','pada','dalam',
                'akan','telah','bisa','ada','tidak','saat','the','is','of','in','hingga','sebagai',
                'kepada','bagi','karena','oleh','namun','juga','lalu','serta','bahwa','lebih',
                'menjadi','lagi','sudah','baru','hanya','tentang','setelah','secara','mereka',
                'kita','kami','saya','anda','dia','apa','siapa','mengapa','bagaimana','mana'
            ];
            negativeOsint.forEach(item => {
                if (item.content) {
                    item.content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).forEach(w => {
                        if (w.length > 3 && !stopwords.includes(w)) kwMap[w] = (kwMap[w] || 0) + 1;
                    });
                }
            });
            topKeywords = Object.entries(kwMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(k => k[0]);
        }
        
        res.json({
            preventif,
            intelijen,
            pengamanan,
            keywords: topKeywords,
            regions: topRegions,
            total_incidents: recentIncidents ? recentIncidents.length : 0,
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error("AI Recommendation Error:", err);
        res.json({
            preventif: 'Sistem AI sedang memproses data. Silakan coba beberapa saat lagi.',
            intelijen: '',
            pengamanan: '',
            keywords: [],
            regions: [],
            total_incidents: 0,
            generated_at: new Date().toISOString()
        });
    }
});

// 10. Live Threat Feed (for ticker marquee)
app.get('/api/v1/threat-feed', async (req, res) => {
    try {
        const { data, error } = await db.from('incidents').select('title, category, region, severity_level, created_at')
            .eq('status', 'Aktif')
            .in('severity_level', ['Merah', 'Oranye', 'Tinggi', 'Sedang'])
            .order('created_at', { ascending: false })
            .limit(10);
        if (error) throw error;
        
        const feeds = (data || []).map(item => {
            const time = new Date(item.created_at);
            const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
            const sentiment = item.severity_level === 'Merah' || item.severity_level === 'Tinggi' ? 'Sentimen Negatif Tinggi' : 'Waspada';
            return `[${timeStr}] ${item.title} - ${item.region} - ${sentiment}`;
        });
        
        res.json({ feeds });
    } catch (err) {
        res.json({ feeds: ['[ISAP] Sistem monitoring aktif - Tidak ada ancaman kritis terdeteksi'] });
    }
});

// 11. Media Statistics (replaces hardcoded Media Teraktif)
app.get('/api/v1/analytics/media-stats', async (req, res) => {
    try {
        const { data, error } = await db.from('osint_feeds').select('source_user');
        if (error) throw error;
        
        let sourceMap = {};
        (data || []).forEach(item => {
            const source = item.source_user || 'Unknown';
            sourceMap[source] = (sourceMap[source] || 0) + 1;
        });
        
        const sorted = Object.entries(sourceMap)
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        const maxCount = sorted.length > 0 ? sorted[0].count : 1;
        const stats = sorted.map(s => ({
            ...s,
            percentage: Math.round((s.count / maxCount) * 100)
        }));
        
        res.json({ stats, total: data ? data.length : 0 });
    } catch (err) {
        res.json({ stats: [], total: 0 });
    }
});

// 12. Map Markers from real incidents
app.get('/api/v1/incidents/map-markers', async (req, res) => {
    try {
        const { data, error } = await db.from('incidents').select('title, category, latitude, longitude, severity_level, region, status')
            .eq('status', 'Aktif')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        
        const markers = (data || []).map(item => ({
            title: item.title,
            category: item.category,
            lat: item.latitude,
            lng: item.longitude,
            severity: item.severity_level,
            region: item.region,
            type: ['Merah', 'Tinggi'].includes(item.severity_level) ? 'threat' :
                  ['Oranye', 'Kuning', 'Sedang'].includes(item.severity_level) ? 'warning' : 'info'
        }));
        
        res.json(markers);
    } catch (err) {
        res.json([]);
    }
});

// 13. Server-side RSS Proxy (eliminates need for third-party CORS proxies)
app.get('/api/v1/rss-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });
    
    try {
        const feed = await rssParser.parseURL(decodeURIComponent(url));
        const items = (feed.items || []).slice(0, 30).map(item => ({
            title: item.title || '',
            link: item.link || '',
            source: item.source || item.creator || 'Web News',
            pubDate: item.pubDate || '',
            contentSnippet: (item.contentSnippet || '').substring(0, 200)
        }));
        res.json({ success: true, items });
    } catch (error) {
        console.error('[ISAP] RSS Proxy error:', error.message);
        res.status(502).json({ success: false, error: 'Failed to fetch RSS feed: ' + error.message });
    }
});

// 9. VERCEL CRON ENDPOINT (Replaces background node-cron)
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
