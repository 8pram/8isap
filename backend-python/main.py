import os
import requests
import xml.etree.ElementTree as ET
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from textblob import TextBlob
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv
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
    'amber': ['hoaks', 'provokasi', 'radikal', 'teroris', 'pembunuhan', 'begal', 'narkoba', 'konflik']
}

RSS_SOURCES = {
    'Kab. Pasuruan': 'https://news.google.com/rss/search?q=pasuruan+OR+bangil+OR+pandaan+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Jawa Timur': 'https://news.google.com/rss/search?q=jawa+timur+OR+jatim+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Berita Nasional (Targeted)': 'https://news.google.com/rss/search?q=(indonesia)+AND+(cnn+OR+detik+OR+kompas+OR+tempo+OR+liputan6+OR+inews+OR+tvone+OR+jawa+pos+OR+tribun+OR+antara)+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Berita Lokal (Targeted)': 'https://news.google.com/rss/search?q=(pasuruan)+AND+(warta+bromo+OR+radar+bromo+OR+memorandum+OR+kabar+pasuruan)+when:1d&hl=id&gl=ID&ceid=ID:id'
}

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

    # Jika tidak ada keyword ancaman, tapi tentang Global/Geopolitik
    if threat_level == 'blue' and any(w in lower_text for w in ['perang', 'konflik', 'geopolitik', 'pemerintah']):
        category = 'Geopolitik'

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

    for region, url in RSS_SOURCES.items():
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
                
                # Hanya simpan ke 'incidents' jika ada ancaman/krusial
                if analysis['threat_level'] in ['red', 'amber'] or analysis['category'] == 'Geopolitik':
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

# Jalankan Scheduler
scheduler = BackgroundScheduler()
# Eksekusi setiap 15 menit
scheduler.add_job(fetch_and_process_rss, IntervalTrigger(minutes=15))
scheduler.start()

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

# Saat aplikasi dimatikan, matikan juga scheduler
@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()
