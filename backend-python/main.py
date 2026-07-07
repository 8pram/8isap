import os
import sys
# pyrefly: ignore [missing-import]
import requests
import xml.etree.ElementTree as ET
# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from textblob import TextBlob
# pyrefly: ignore [missing-import]
from apscheduler.schedulers.background import BackgroundScheduler
# pyrefly: ignore [missing-import]
from apscheduler.triggers.interval import IntervalTrigger
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from supabase import create_client, Client
import random

# Load .env dari folder backend-node (agar satu pintu)
dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'backend-node', '.env')
load_dotenv(dotenv_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("WARNING: Supabase URL/KEY not found. Scraping will not save to DB.")

app = FastAPI()

# ==========================================
# KONFIGURASI KEYWORDS & RSS
# ==========================================

THREAT_KEYWORDS = {
    'red': ['demo', 'unjuk rasa', 'bentrok', 'ricuh', 'tawuran', 'carok', 'kerusuhan', 'kebakaran'],
    'amber': ['hoaks', 'provokasi', 'radikal', 'teroris', 'pembunuhan', 'begal', 'narkoba', 'konflik', 'kriminal', 'pencurian', 'korupsi', 'penipuan', 'kecelakaan', 'laka lantas'],
    'strategic': ['sembako', 'bbm', 'lpg', 'mbg', 'sekolah rakyat', 'kdmp', 'program pemerintah', 'kebijakan', 'pemerintah', 'bansos', 'bantuan', 'peraturan', 'perjanjian', 'pilpres', 'pilkada', 'pilkades', 'pemilu'],
    'geopolitik': ['perang', 'geopolitik', 'pelemahan mata uang', 'nilai tukar', 'penutupan akses', 'hormuz', 'hormus', 'krisis global']
}

RSS_SOURCES = [
    ('Kab. Pasuruan', 'https://news.google.com/rss/search?q=(pasuruan+OR+bangil+OR+pandaan)+AND+(site:meri.co.id+OR+site:pojokkiripasuruannews.com+OR+site:smnnews.co.id+OR+site:radarjatim.id+OR+site:pasuruannews.com+OR+site:pasuruan.times.co.id+OR+site:pantura7.com+OR+site:wartabromo.com+OR+site:kabarnusa.id)+when:1d&hl=id&gl=ID&ceid=ID:id'),
    ('Jawa Timur', 'https://news.google.com/rss/search?q=(jawa+timur+OR+jatim)+AND+(site:kabarjawatimur.com+OR+site:beritajatim.com+OR+site:jurnaljatim.com+OR+site:jatimnow.com+OR+site:infojatim.com+OR+site:jatimtimes.com+OR+site:jatim.antaranews.com+OR+site:jawapos.com+OR+site:jatimpos.co+OR+site:detik.com+OR+site:jatimnet.com+OR+site:bangsaonline.com+OR+site:surabaya.tribunnews.com+OR+site:jatimmedia.com+OR+site:jatimupdate.id+OR+site:mediajatim.com)+when:1d&hl=id&gl=ID&ceid=ID:id'),
    ('Nasional', 'https://news.google.com/rss/search?q=(indonesia)+AND+(site:inews.id+OR+site:tvrinews.com+OR+site:rri.co.id+OR+site:jpnn.com+OR+site:jurnas.com+OR+site:beritasatu.com+OR+site:suarapembaharuan.com+OR+site:rm.id+OR+site:ipol.id+OR+site:kompas.com+OR+site:kumparan.com+OR+site:nusantaratv.com)+when:1d&hl=id&gl=ID&ceid=ID:id'),
    ('Nasional', 'https://news.google.com/rss/search?q=(indonesia)+AND+(site:aktual.com+OR+site:idntimes.com+OR+site:antvklik.com+OR+site:elshinta.com+OR+site:inilah.com+OR+site:neraca.co.id+OR+site:koran-jakarta.com+OR+site:tribunnews.com+OR+site:mediaindonesia.com+OR+site:wartaekonomi.co.id+OR+site:detik.com+OR+site:sindonews.com)+when:1d&hl=id&gl=ID&ceid=ID:id'),
    ('Nasional', 'https://news.google.com/rss/search?q=(indonesia)+AND+(site:harianterbit.com+OR+site:viva.co.id+OR+site:idxchannel.com+OR+site:suarakarya.id+OR+site:poskota.co+OR+site:suara.com+OR+site:akurat.co+OR+site:sinarharapan.id+OR+site:jakarta.suaramerdeka.com+OR+site:jawapos.com+OR+site:genpi.co)+when:1d&hl=id&gl=ID&ceid=ID:id'),
    ('Nasional', 'https://news.google.com/rss/search?q=(indonesia)+AND+(site:cnbcindonesia.com+OR+site:swa.co.id+OR+site:wartakota.tribunnews.com+OR+site:balipost.com+OR+site:liputan6.com+OR+site:okezone.com+OR+site:investor.id+OR+site:antaranews.com+OR+site:tirto.id+OR+site:medcom.id+OR+site:galapos.id)+when:1d&hl=id&gl=ID&ceid=ID:id'),
    ('Radar Darurat', 'https://news.google.com/rss/search?q=(narkoba+OR+teroris+OR+pembunuhan+OR+korupsi+OR+demo+OR+unjuk+rasa+OR+bentrok+OR+begal)+when:1d&hl=id&gl=ID&ceid=ID:id'),
    ('Global', 'https://news.google.com/rss/search?q=(internasional+OR+dunia)+AND+(site:inews.id+OR+site:tvrinews.com+OR+site:kompas.com+OR+site:detik.com+OR+site:tribunnews.com+OR+site:cnbcindonesia.com+OR+site:cnnindonesia.com+OR+site:antaranews.com)+when:1d&hl=id&gl=ID&ceid=ID:id')
]

# ==========================================
# FUNGSI ANALISIS NLP SEDERHANA
# ==========================================

def analyze_text(text: str):
    lower_text = text.lower()
    threat_level = 'blue'
    category = 'Sosial/Lainnya'

    for word in THREAT_KEYWORDS['red']:
        if word in lower_text:
            threat_level = 'red'
            category = 'Kamtibmas'
            break
            
    if threat_level == 'blue':
        for word in THREAT_KEYWORDS['amber']:
            if word in lower_text:
                threat_level = 'amber'
                if word in ['hoaks', 'provokasi', 'radikal', 'teroris']:
                    category = 'Siber/Teror'
                else:
                    category = 'Kriminal'
                break

    if threat_level == 'blue':
        for word in THREAT_KEYWORDS['strategic']:
            if word in lower_text:
                category = 'Kebijakan/Program'
                break

    if threat_level == 'blue':
        for word in THREAT_KEYWORDS['geopolitik']:
            if word in lower_text:
                category = 'Geopolitik'
                break

    # TextBlob
    blob = TextBlob(text)
    score = blob.sentiment.polarity

    sentiment = 'Netral'
    if threat_level != 'blue' or score < -0.1:
        sentiment = 'Negatif'
    elif score > 0.1:
        sentiment = 'Positif'
        
    severity = 'Hijau'
    if threat_level == 'red': severity = 'Merah'
    elif threat_level == 'amber' and sentiment == 'Negatif': severity = 'Oranye'
    elif threat_level == 'amber': severity = 'Kuning'

    # Ekstraksi Hashtag sederhana
    words = lower_text.split()
    hashtags = [f"#{w}" for w in words if w in ['pilkada', 'demo', 'polisi', 'korupsi', 'hoaks', 'provokasi', 'pasuruan', 'jatim', 'kriminal']]
    if not hashtags:
        # Berikan hashtag default jika kosong berdasarkan kategori
        if category == 'Kamtibmas': hashtags = ['#Aman', '#Kamtibmas']
        elif category == 'Siber/Teror': hashtags = ['#Siber', '#AntiHoaks']
        else: hashtags = ['#InfoTerkini']

    return {
        "threat_level": threat_level,
        "category": category,
        "sentiment": sentiment,
        "polarity_score": score,
        "severity": severity,
        "hashtags": hashtags
    }

# ==========================================
# MESIN SCRAPER 24 JAM
# ==========================================

def fetch_and_process_rss():
    print("[ISAP Scraper] Memulai operasi sapuan jaringan...")
    if not supabase:
        print("Database belum terhubung. Operasi dibatalkan.")
        return

    for region, url in RSS_SOURCES:
        try:
            print(f"Menyadap region: {region}...")
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                continue

            root = ET.fromstring(response.text)
            items = root.findall('./channel/item')
            
            # Ambil 5 berita terbaru per region untuk menghindari spam
            for item in items[:5]:
                title = item.find('title').text if item.find('title') is not None else ""
                link = item.find('link').text if item.find('link') is not None else ""
                source = item.find('source').text if item.find('source') is not None else "Web News"
                
                # Bersihkan title dari nama sumber (biasanya format "Judul Berita - Nama Sumber")
                clean_title = title.split(' - ')[0] if ' - ' in title else title
                
                analysis = analyze_text(clean_title)
                
                # Hanya simpan ke 'incidents' jika ada ancaman/krusial ATAU isu strategis
                if analysis['threat_level'] in ['red', 'amber'] or analysis['category'] in ['Geopolitik', 'Kebijakan/Program']:
                    # Cek apakah sudah ada untuk menghindari duplikat (cek berdasarkan judul)
                    existing = supabase.table('incidents').select('id').eq('title', clean_title).execute()
                    if not existing.data:
                        # Simulasi koordinat acak di wilayah Pasuruan untuk contoh visualisasi peta
                        # (Dalam versi pro, gunakan Geocoding API)
                        lat = -7.6453 + random.uniform(-0.1, 0.1)
                        lng = 112.8224 + random.uniform(-0.1, 0.1)
                        
                        incident_data = {
                            "title": clean_title,
                            "description": "Deteksi otomatis dari OSINT: " + link,
                            "category": analysis['category'],
                            "latitude": lat,
                            "longitude": lng,
                            "region": region,
                            "severity_level": analysis['severity'],
                            "status": "Aktif"
                        }
                        supabase.table('incidents').insert(incident_data).execute()

                # Simpan RAW OSINT
                existing_osint = supabase.table('osint_feeds').select('id').eq('content', clean_title).execute()
                if not existing_osint.data:
                    # Simulasi metrik interaksi (Karena RSS tidak punya likes/views asli)
                    # Dalam versi koneksi API Native (Twitter/TikTok API), ini akan diganti dengan data asli.
                    base_views = random.randint(100, 50000)
                    if analysis['severity'] in ['Merah', 'Oranye']:
                        base_views = random.randint(50000, 1000000)
                    
                    likes = int(base_views * random.uniform(0.01, 0.1))
                    shares = int(likes * random.uniform(0.05, 0.3))

                    osint_data = {
                        "platform": "News",
                        "source_user": source,
                        "content": clean_title,
                        "url": link,
                        "hashtags": analysis['hashtags'],
                        "views_count": base_views,
                        "likes_count": likes,
                        "shares_count": shares,
                        "sentiment_label": analysis['sentiment'],
                        "sentiment_score": analysis['polarity_score'],
                        "ai_classification": "Aman" if analysis['threat_level'] == 'blue' else "Peringatan"
                    }
                    supabase.table('osint_feeds').insert(osint_data).execute()

        except Exception as e:
            print(f"Error scraping {region}: {e}")

    print("[ISAP Scraper] Sapuan selesai.")

# Inisialisasi scheduler secara global
scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup_event():
    # Eksekusi setiap 15 menit
    scheduler.add_job(fetch_and_process_rss, IntervalTrigger(minutes=15))
    scheduler.start()

# Saat aplikasi dimatikan, matikan juga scheduler
@app.on_event("shutdown")
def shutdown_event():
    try:
        scheduler.shutdown()
    except:
        pass

# ==========================================
# API ENDPOINTS
# ==========================================

class TextData(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"message": "ISAP Python Intelligence Engine is running."}

@app.post("/analyze")
def analyze(data: TextData):
    return analyze_text(data.text)

@app.post("/trigger-scrape")
def trigger_scrape(region: str = "Semua"):
    # Memaksa scheduler jalan sekarang juga
    fetch_and_process_rss()
    return {"status": "scraping_started", "region": region}

if __name__ == "__main__":
    import sys
    
    # Jika dipanggil dengan argumen --scrape-only (oleh GitHub Actions),
    # cukup jalankan scraping 1x lalu keluar.
    if len(sys.argv) > 1 and sys.argv[1] == "--scrape-only":
        print("[GitHub Actions] Memulai OSINT Scrape Otomatis...")
        fetch_and_process_rss()
        sys.exit(0)
        
    # Jika dijalankan normal, jalankan server
    try:
        print("[ISAP Scraper] Memulai inisialisasi mesin OSINT...")
        fetch_and_process_rss()
    except Exception as e:
        print(f"Error saat scrape awal: {e}")

    # pyrefly: ignore [missing-import]
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
