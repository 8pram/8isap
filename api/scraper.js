const Parser = require('rss-parser');
const parser = new Parser({ timeout: 5000 });
const Sentiment = require('sentiment');
const sentimentAnalyzer = new Sentiment();

const THREAT_KEYWORDS = {
    red: ['demo', 'unjuk rasa', 'bentrok', 'ricuh', 'tawuran', 'carok', 'kerusuhan', 'kebakaran'],
    amber: ['hoaks', 'provokasi', 'radikal', 'teroris', 'pembunuhan', 'begal', 'narkoba', 'konflik']
};

const RSS_SOURCES = {
    'Kab. Pasuruan': 'https://news.google.com/rss/search?q=pasuruan+OR+bangil+OR+pandaan+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Jawa Timur': 'https://news.google.com/rss/search?q=jawa+timur+OR+jatim+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Nasional': 'https://news.google.com/rss/search?q=indonesia+kriminal+OR+politik+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Global': 'https://news.google.com/rss/search?q=internasional+OR+geopolitik+OR+perang+when:1d&hl=id&gl=ID&ceid=ID:id'
};

function analyzeText(text) {
    const lowerText = text.toLowerCase();
    let threatLevel = 'blue';
    let category = 'Sosial/Lainnya';

    for (const word of THREAT_KEYWORDS.red) {
        if (lowerText.includes(word)) {
            threatLevel = 'red';
            category = 'Kamtibmas';
            break;
        }
    }

    if (threatLevel === 'blue') {
        for (const word of THREAT_KEYWORDS.amber) {
            if (lowerText.includes(word)) {
                threatLevel = 'amber';
                if (['hoaks', 'provokasi', 'radikal', 'teroris'].includes(word)) {
                    category = 'Siber/Teror';
                } else {
                    category = 'Kriminal';
                }
                break;
            }
        }
    }

    if (threatLevel === 'blue' && ['perang', 'konflik', 'geopolitik', 'pemerintah'].some(w => lowerText.includes(w))) {
        category = 'Geopolitik';
    }

    let score = sentimentAnalyzer.analyze(text).score;
    let sentimentStr = 'Netral';

    if (threatLevel !== 'blue' || score < 0) {
        sentimentStr = 'Negatif';
        score = -0.8;
    } else if (score > 0) {
        sentimentStr = 'Positif';
        score = 0.5;
    } else {
        score = 0;
    }

    let severity = 'Rendah';
    if (threatLevel === 'red') severity = 'Tinggi';
    else if (threatLevel === 'amber') severity = 'Sedang';

    return {
        threatLevel,
        category,
        sentiment: sentimentStr,
        polarityScore: score,
        severity
    };
}

async function fetchAndProcessRSS(supabase) {
    let logs = [];
    logs.push("[ISAP Scraper Node] Memulai operasi sapuan jaringan 24/7...");
    if (!supabase) {
        logs.push("Database belum terhubung. Operasi dibatalkan.");
        return logs;
    }

    const SOCIAL_PLATFORMS = ['Twitter', 'TikTok', 'Facebook'];
    const HASHTAGS = ['#Viral', '#Trending', '#BeritaTerkini', '#Kawal', '#PantauTerus'];

    for (const [region, url] of Object.entries(RSS_SOURCES)) {
        try {
            logs.push(`Menyadap region: ${region}...`);
            let feed;
            try {
                // Try direct fetch with 5s timeout
                feed = await parser.parseURL(url);
            } catch (err) {
                logs.push(`Direct fetch failed (${err.message}). Mencoba proxy...`);
                feed = await parser.parseURL('https://api.allorigins.win/raw?url=' + encodeURIComponent(url));
            }
            
            // INCREASE DATA VOLUME: Ambil 25 berita riil per region (total 100 berita murni)
            const items = feed.items.slice(0, 25);

            for (const item of items) {
                const title = item.title || "";
                const link = item.link || "";
                const source = item.source || "Web News";
                
                const cleanTitle = title.split(' - ')[0] || title;
                const analysis = analyzeText(cleanTitle);

                // 1. Insert to incidents if critical
                if (['red', 'amber'].includes(analysis.threatLevel) || analysis.category === 'Geopolitik') {
                    const { data: existing } = await supabase.from('incidents').select('id').eq('title', cleanTitle);

                    if (!existing || existing.length === 0) {
                        const lat = -7.6453 + (Math.random() * 0.2 - 0.1);
                        const lng = 112.8224 + (Math.random() * 0.2 - 0.1);

                        const { error: err1 } = await supabase.from('incidents').insert({
                            title: cleanTitle,
                            description: "Deteksi otomatis dari OSINT Node: " + link.substring(0, 500),
                            category: analysis.category,
                            latitude: lat,
                            longitude: lng,
                            region: region,
                            severity_level: analysis.severity,
                            status: "Aktif"
                        });
                        if (err1) logs.push(`[Error Incident] ${err1.message}`);
                    }
                }

                // 2. Insert Official News to OSINT Feeds
                const { data: existingOsint } = await supabase.from('osint_feeds').select('id').eq('content', cleanTitle);

                if (!existingOsint || existingOsint.length === 0) {
                    const { error: err2 } = await supabase.from('osint_feeds').insert({
                        platform: "News",
                        source_user: source,
                        content: cleanTitle,
                        url: link.substring(0, 500), // Truncate to prevent Supabase 'value too long' error
                        sentiment_label: analysis.sentiment,
                        sentiment_score: analysis.polarityScore,
                        ai_classification: analysis.threatLevel === 'blue' ? "Aman" : "Peringatan"
                    });
                    if (err2) logs.push(`[Error OSINT] ${err2.message}`);
                }
            }
        } catch (error) {
            logs.push(`Error scraping ${region}: ${error.message}`);
        }
    }
    logs.push("[ISAP Scraper Node] Sapuan riil 100% selesai.");
    return logs;
}

module.exports = { fetchAndProcessRSS };
