# 🛰️ INTELLIGENCE SITUATIONAL AWARENESS PLATFORM (ISAP)

**Master Architecture & Blueprint Document**

Sebagai *Software Architect* dan Spesialis Intelijen, dokumen ini disusun untuk memastikan ISAP beroperasi bukan sebagai simulasi, melainkan sebagai **sistem siap produksi (production-ready)** untuk akuisisi, pemrosesan, dan visualisasi data intelijen secara *real-time*.

---

## 1. Analisis Kebutuhan Sistem

ISAP dirancang untuk memantau 3 domain utama: Media Sosial, Portal Berita Nasional, dan Portal Berita Lokal.

* **Kebutuhan Fungsional:** Akuisisi data tanpa henti (24/7), klasifikasi teks otomatis berbasis AI (NLP), deteksi anomali/lonjakan isu, dan antarmuka visualisasi taktis (Peta Geospasial & Command Center).
* **Kebutuhan Non-Fungsional:** Waktu respons API < 200ms, ketersediaan sistem 99.9% (High Availability), dan kapabilitas penanganan volume data tinggi (*High Throughput*).

## 2. Arsitektur Aplikasi

Menggunakan pendekatan **Microservices Hybrid Cloud**:

* **Data Ingestion Layer:** Skrip Python *Scraper* berjalan sebagai *Background Worker* untuk menyedot data dari RSS dan API Eksternal.
* **Data Processing Layer:** Modul Python memproses raw data (Pembersihan, Analisis Sentimen TextBlob/IndoBERT, Klasifikasi Ancaman).
* **Data Storage Layer:** Supabase (PostgreSQL) digunakan untuk integritas data terstruktur (*incidents*) dan data semi-terstruktur (*osint_feeds*).
* **API Gateway:** Node.js Express melayani data dari DB ke Frontend dengan format agregasi siap konsumsi.
* **Presentation Layer:** HTML/Vanilla JS murni dengan Tailwind CSS untuk performa maksimal tanpa beban *framework* berat, berkomunikasi via REST/WebSockets.

## 3. Struktur Folder Project

```text
ISAP/
├── frontend/                # Presentation Layer (UI/UX)
│   ├── index.html           # Master Command Center View
│   ├── css/
│   │   └── tailwind.css     # Styling & Design Tokens
│   ├── js/
│   │   ├── main.js          # Core Logic & API Fetching
│   │   ├── charts.js        # Data Visualization Logic
│   │   └── map.js           # Geo-Spatial Leaflet Logic
├── backend-node/            # API Gateway Layer
│   ├── server.js            # Express Server & Routes
│   ├── scraper.js           # Cron Scheduler
│   ├── config/db.js         # Supabase Connection
│   ├── schema.sql           # Database Blueprint
├── backend-python/          # Intelligence AI Engine
│   ├── main.py              # NLP & Web Scraping Engine
│   ├── requirements.txt     # Python Dependencies
```

## 4. Database Schema

Skema *Relational Database* (PostgreSQL) didesain untuk *fast-read* agregasi intelijen:

* `incidents`: Menyimpan ancaman nyata. Kolom: `id`, `title`, `description`, `category`, `latitude`, `longitude`, `severity_level` (Hijau, Kuning, Oranye, Merah), `status`.
* `osint_feeds`: Menyimpan raw data sosial. Kolom: `id`, `platform`, `source_user`, `content`, `url`, `hashtags` (TEXT[]), `views_count`, `likes_count`, `shares_count`, `sentiment_label`, `sentiment_score`, `ai_classification`.

## 5. API Architecture

Node.js menyediakan antarmuka agregasi intelijen:

* `GET /api/v1/social/trending`: Ekstraksi hashtag teratas.
* `GET /api/v1/social/viral`: Menarik data `osint_feeds` dengan metrik *engagement* tertinggi.
* `GET /api/v1/news/latest`: *Feed* intelijen berita *real-time*.
* `GET /api/v1/alerts/active`: Mengambil `incidents` dengan `severity_level` Oranye/Merah untuk Early Warning System.

## 6. UI/UX Wireframe & 7. Dashboard Design Concept

* **Tema:** Cyber Intelligence Style, Dark Mode (Navy/Black background), Glassmorphism (Backdrop blur pada panel).
* **Aksen Warna:** Electric Blue (Rutin/Aman), Emerald (Positif/Pantauan), Kuning/Oranye (Siaga), Crimson Red (Kritis/Merah).
* **Navigasi:** Sidebar kiri dengan pergantian *view* DOM instan (Dashboard, Social, News, Threat Map) tanpa *reload*.

## 8. Teknologi yang Digunakan

* **Frontend:** HTML5, CSS3, Tailwind CSS, Vanilla JavaScript, Chart.js, LeafletJS + OpenStreetMap.
* **Backend API:** Node.js, Express.js.
* **AI & Ingestion:** Python, FastAPI, TextBlob (NLP), BeautifulSoup.
* **Database:** Supabase (PostgreSQL).

## 9-12. Source Code Strategy

Implementasi kode tidak menggunakan data statis/simulasi:

* **HTML/JS:** Menghapus data *dummy* dan menggantinya dengan logika `fetch()` yang mengikat (bind) data JSON dari backend secara asinkron ke elemen DOM.
* **Python:** Skrip wajib men-sintesis metrik *engagement* (likes/views) jika menggunakan sumber RSS, atau wajib terhubung dengan API *Scraper* pihak ketiga jika memantau sosial media secara riil. Mengklasifikasi tingkat ancaman (Hijau, Kuning, Oranye, Merah).

## 13. Integrasi AI dan Machine Learning

* **Siklus AI:** Teks mentah -> *Tokenization* -> Analisis Sentimen (Skor polaritas -1.0 hingga 1.0) -> Klasifikasi Ancaman (Deteksi kata kunci spesifik).
* **Rekomendasi Otomatis (Rule-based ML):** Algoritma *Decision Tree* yang memetakan jenis ancaman ke output "Langkah Intelijen", "Langkah Preventif", dan "Langkah Pengamanan" secara dinamis di *Dashboard*.

## 14. Roadmap Pengembangan

1. **Fase Produksi Data (Saat ini):** Refaktor antarmuka UI untuk membaca 100% dari Supabase DB, menghapus *mockup*.
2. **Fase Akselerasi OSINT:** Mengganti *scraper* RSS dengan API resmi/pihak ketiga (Apify/PhantomBuster) untuk akuisisi TikTok, X, dan Instagram secara *native*.
3. **Fase Prediktif:** Membangun model *Machine Learning* kustom untuk memprediksi probabilitas unjuk rasa berdasar pola *mention* historis.

## 15. Strategi Deployment

* **Frontend UI:** De-deploy ke CDN global (Netlify/Vercel) untuk latensi rendah.
* **Backend API (Node.js) & AI Engine (Python):** De-deploy ke VPS Linux (Ubuntu Server) atau platform spesialis (Render/Railway) agar mesin *Scraper* dapat berjalan tanpa batasan *timeout serverless*.
* **Database:** Supabase Managed Cloud (Region Singapore untuk latensi terdekat ke Indonesia).

## 16. Strategi Keamanan Aplikasi

Dari sudut pandang intelijen, data tidak boleh bocor:

* **Autentikasi:** Implementasi JSON Web Token (JWT) dengan *Role-Based Access Control* (RBAC).
* **Network:** Komunikasi antar *microservice* murni via HTTPS (TLS 1.3).
* **Obfuscation:** Penyembunyian URL target/endpoint Node.js di *Environment Variables*.

## 17. Optimasi Performa

* **Frontend:** *Debouncing* pada event WebSocket/Polling, rendering peta asinkron (*Lazy Load*).
* **Database:** Pembuatan `INDEX` pada kolom `created_at` dan `region` di PostgreSQL agar agregasi sentimen jutaan baris data dapat dieksekusi dalam hitungan milidetik.

## 18. Rencana Pengembangan Versi Enterprise

Sistem akan ditransformasi menjadi "Multi-Agency Platform":

* Sistem kliring informasi (*Clearance Level*) di mana pengguna level bawah hanya melihat statistik, sedangkan Command Center (Pimpinan) dapat melihat koordinat eksak dan identitas provokator.
* Integrasi *Secure Chat* antar analis lintas wilayah dalam satu platform.
