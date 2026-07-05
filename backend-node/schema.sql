-- ==========================================
-- ISAP - INTELLIGENCE SITUATIONAL AWARENESS PLATFORM
-- PostgreSQL Schema untuk Supabase
-- ==========================================

-- 1. Tabel Insiden Utama (Menyimpan titik kejadian)
CREATE TABLE public.incidents (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- e.g., 'Kamtibmas', 'Siber', 'Sosial'
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    region VARCHAR(100), -- 'Kab. Pasuruan', 'Jatim'
    severity_level VARCHAR(20), -- 'Hijau', 'Kuning', 'Oranye', 'Merah'
    status VARCHAR(50) DEFAULT 'Aktif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Scraping OSINT (Raw Data dari Sosial Media / Berita)
CREATE TABLE public.osint_feeds (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    platform VARCHAR(50) NOT NULL, -- 'Twitter', 'Facebook', 'TikTok', 'News'
    source_user VARCHAR(255),
    content TEXT NOT NULL,
    url VARCHAR(500),
    hashtags TEXT[], -- Menampung daftar hashtag
    views_count INT DEFAULT 0, -- Metrik engagement nyata
    likes_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    sentiment_label VARCHAR(20), -- 'Positif', 'Negatif', 'Netral' (Diisi oleh AI)
    sentiment_score DECIMAL(5, 4), -- e.g., -0.85
    ai_classification VARCHAR(50), -- 'Provokasi', 'Hoaks', 'SARA', 'Aman'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Ringkasan Sentimen (Diupdate harian/per jam untuk grafik)
CREATE TABLE public.sentiment_analytics (
    id SERIAL PRIMARY KEY,
    record_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_mentions INT DEFAULT 0,
    negative_count INT DEFAULT 0,
    positive_count INT DEFAULT 0,
    neutral_count INT DEFAULT 0,
    top_keywords TEXT[] -- Array keyword yang paling sering muncul
);

-- INDEXING untuk performa Dashboard yang cepat
CREATE INDEX idx_incidents_region ON public.incidents(region);
CREATE INDEX idx_osint_created_at ON public.osint_feeds(created_at);
CREATE INDEX idx_osint_sentiment ON public.osint_feeds(sentiment_label);

-- ==========================================
-- CONTOH INSERT DATA DUMMY UNTUK TESTING
-- ==========================================
INSERT INTO public.incidents (title, description, category, latitude, longitude, region, severity_level)
VALUES 
('Potensi Provokasi Massa', 'Konsentrasi massa terdeteksi dari percakapan sosmed', 'Kamtibmas', -7.5986, 112.7845, 'Kab. Pasuruan', 'Tinggi'),
('Hoaks Penculikan Anak', 'Beredar luas di WA warga timur', 'Siber', -7.6453, 112.8224, 'Kab. Pasuruan', 'Sedang');
