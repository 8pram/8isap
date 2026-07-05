const Parser = require('rss-parser');
const parser = new Parser();
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

    // Basic sentiment analysis using sentiment npm package (English based, but we can rely on heuristic polarity if needed)
    // For indonesian, we just assign manually based on threat for prototype
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
    console.log("[ISAP Scraper Node] Memulai operasi sapuan jaringan 24/7...");
    if (!supabase) {
        console.log("Database belum terhubung. Operasi dibatalkan.");
        return;
    }

    for (const [region, url] of Object.entries(RSS_SOURCES)) {
        try {
            console.log(`Menyadap region: ${region}...`);
            const feed = await parser.parseURL(url);
            
            // Limit to top 5 recent items per region to avoid spam
            const items = feed.items.slice(0, 5);

            for (const item of items) {
                const title = item.title || "";
                const link = item.link || "";
                const source = item.source || "Web News";
                
                const cleanTitle = title.split(' - ')[0] || title;
                const analysis = analyzeText(cleanTitle);

                // Insert to incidents if critical
                if (['red', 'amber'].includes(analysis.threatLevel) || analysis.category === 'Geopolitik') {
                    const { data: existing } = await supabase
                        .from('incidents')
                        .select('id')
                        .eq('title', cleanTitle);

                    if (!existing || existing.length === 0) {
                        const lat = -7.6453 + (Math.random() * 0.2 - 0.1);
                        const lng = 112.8224 + (Math.random() * 0.2 - 0.1);

                        await supabase.from('incidents').insert({
                            title: cleanTitle,
                            description: "Deteksi otomatis dari OSINT Node: " + link,
                            category: analysis.category,
                            latitude: lat,
                            longitude: lng,
                            region: region,
                            severity_level: analysis.severity,
                            status: "Aktif"
                        });
                    }
                }

                // Insert to OSINT Feeds
                const { data: existingOsint } = await supabase
                    .from('osint_feeds')
                    .select('id')
                    .eq('content', cleanTitle);

                if (!existingOsint || existingOsint.length === 0) {
                    await supabase.from('osint_feeds').insert({
                        platform: "News",
                        source_user: source,
                        content: cleanTitle,
                        url: link,
                        sentiment_label: analysis.sentiment,
                        sentiment_score: analysis.polarityScore,
                        ai_classification: analysis.threatLevel === 'blue' ? "Aman" : "Peringatan"
                    });
                }
            }
        } catch (error) {
            console.error(`Error scraping ${region}:`, error.message);
        }
    }
    console.log("[ISAP Scraper Node] Sapuan selesai. Menunggu siklus berikutnya.");
}

module.exports = { fetchAndProcessRSS };
