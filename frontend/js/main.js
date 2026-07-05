/**
 * ISAP Command Center - Main Application Logic
 * Prototype MVP (Mock Data & Frontend Interactions)
 */

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initMap();
    initCharts();
    // populateTopIssues();
    // populateOsintFeed();
    initRealtimeData();
});

// --- Navigation Logic ---
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view-section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            navBtns.forEach(b => {
                b.classList.remove('bg-accent-blue/20', 'text-accent-blue', 'border-accent-blue/50', 'shadow-[0_0_15px_rgba(59,130,246,0.3)]');
                b.classList.add('text-gray-400', 'border-transparent');
                b.querySelector('i')?.classList.remove('text-accent-blue');
            });

            // Add active class to clicked
            btn.classList.remove('text-gray-400', 'border-transparent');
            btn.classList.add('bg-accent-blue/20', 'text-accent-blue', 'border-accent-blue/50', 'shadow-[0_0_15px_rgba(59,130,246,0.3)]');
            btn.querySelector('i')?.classList.add('text-accent-blue');

            // Hide all views
            const views = document.querySelectorAll('.view-section');
            views.forEach(v => {
                v.classList.add('hidden');
            });
            
            // Show target view
            const targetId = btn.getAttribute('data-target');
            if(targetId) {
                const targetView = document.getElementById(targetId);
                if (targetView) targetView.classList.remove('hidden');
            }
            
            // Trigger resize for maps/charts to re-render properly when unhidden
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        });
    });
}

// --- 1. Live Clock & Date ---
function initClock() {
    const timeEl = document.getElementById('live-time');
    const dateEl = document.getElementById('live-date');
    
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
        const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        
        timeEl.textContent = timeStr;
        dateEl.textContent = dateStr;
    }, 1000);
}

// --- 2. Geo-Intelligence Map (Leaflet) ---
function initMap() {
    // Koordinat tengah Kabupaten Pasuruan
    const pasuruanCoords = [-7.6453, 112.8224];
    
    const map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(pasuruanCoords, 10);

    // Gunakan basemap gelap (CartoDB Dark Matter style, atau OpenStreetMap yg di-invert via CSS)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
    }).addTo(map);

    // Custom Icon (Red Pulse)
    const threatIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="position:relative; width:20px; height:20px;">
                <div style="position:absolute; width:100%; height:100%; background:#EF4444; border-radius:50%; opacity:0.8; z-index:2;"></div>
                <div style="position:absolute; width:100%; height:100%; background:#EF4444; border-radius:50%; animation: pulse-red 2s infinite; z-index:1;"></div>
               </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const warningIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="width:12px; height:12px; background:#F59E0B; border-radius:50%; border:1px solid #0B1120;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    const infoIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="width:12px; height:12px; background:#3B82F6; border-radius:50%; border:1px solid #0B1120;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    // Dummy Markers for Main Map
    L.marker([-7.5986, 112.7845], {icon: threatIcon}).addTo(map).bindPopup('<b>Bangil</b><br>Potensi Provokasi Massa');
    L.marker([-7.6453, 112.8224], {icon: warningIcon}).addTo(map).bindPopup('<b>Pasuruan Kota</b><br>Sebaran Hoaks WA');
    L.marker([-7.7112, 112.6953], {icon: infoIcon}).addTo(map).bindPopup('<b>Pandaan</b><br>Pantauan Aktivitas Buruh');
    L.marker([-7.7371, 112.8711], {icon: warningIcon}).addTo(map).bindPopup('<b>Grati</b><br>Isu Tanah');

    // Init Threat Map (Large)
    const threatMapEl = document.getElementById('threat-map-large');
    if (threatMapEl) {
        const threatMap = L.map('threat-map-large', {
            zoomControl: true,
            attributionControl: false
        }).setView(pasuruanCoords, 11);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
        }).addTo(threatMap);
        
        L.marker([-7.5986, 112.7845], {icon: threatIcon}).addTo(threatMap).bindPopup('<b>Bangil</b><br>Potensi Provokasi Massa');
        L.marker([-7.6453, 112.8224], {icon: warningIcon}).addTo(threatMap).bindPopup('<b>Pasuruan Kota</b><br>Sebaran Hoaks WA');
    }
}

// --- 3. Charts (Chart.js) ---
function initCharts() {
    Chart.defaults.color = '#9CA3AF';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Sentiment Doughnut Chart
    const ctxSent = document.getElementById('sentimentChart').getContext('2d');
    window.sentimentChartInstance = new Chart(ctxSent, {
        type: 'doughnut',
        data: {
            labels: ['Negatif', 'Positif', 'Netral'],
            datasets: [{
                data: [0, 0, 100],
                backgroundColor: ['#EF4444', '#10B981', '#3B82F6'],
                borderWidth: 0,
                cutout: '80%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true } }
        }
    });

    // Timeline Line Chart
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    
    // Gradient fill
    const gradient = ctxTrend.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Sekarang'],
            datasets: [{
                label: 'Volume Percakapan',
                data: [120, 80, 450, 950, 1200, 1800, 2100],
                borderColor: '#3B82F6',
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0B1120',
                pointBorderColor: '#3B82F6',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(75, 85, 99, 0.2)' }, border: { display: false } },
                x: { grid: { display: false }, border: { display: false } }
            }
        }
    });

    // News Sentiment Chart
    const ctxNewsSent = document.getElementById('newsSentimentChart');
    if (ctxNewsSent) {
        window.newsSentimentChartInstance = new Chart(ctxNewsSent.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Negatif', 'Positif', 'Netral'],
                datasets: [{
                    data: [0, 0, 100],
                    backgroundColor: ['#EF4444', '#10B981', '#3B82F6'],
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } }
            }
        });
    }
}

// --- 4. Real-Time OSINT Data (Google News RSS Proxy) ---

const CORS_PROXIES = [
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest=",
    "https://api.allorigins.win/get?url="
];
const RSS_FEEDS = {
    'Kab. Pasuruan': 'https://news.google.com/rss/search?q=pasuruan+OR+bangil+OR+pandaan+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Jawa Timur': 'https://news.google.com/rss/search?q=jawa+timur+OR+jatim+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Nasional': 'https://news.google.com/rss/search?q=indonesia+kriminal+OR+politik+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Global': 'https://news.google.com/rss/search?q=internasional+when:1d&hl=id&gl=ID&ceid=ID:id'
};

const THREAT_KEYWORDS = ['demo', 'unjuk rasa', 'bentrok', 'tawuran', 'hoaks', 'provokasi', 'ricuh', 'korupsi', 'pembunuhan', 'carok', 'kriminal', 'pencurian', 'begal', 'narkoba', 'kerusuhan', 'penipuan', 'teroris', 'radikal', 'kecelakaan', 'kebakaran'];

function analyzeThreat(text) {
    const lower = text.toLowerCase();
    let threatLevel = 'blue'; // Normal/Pantauan
    let category = 'Sosial';
    
    for (const kw of THREAT_KEYWORDS) {
        if (lower.includes(kw)) {
            if (['demo', 'unjuk rasa', 'bentrok', 'ricuh', 'tawuran', 'carok', 'kerusuhan', 'kebakaran'].includes(kw)) {
                threatLevel = 'red';
                category = 'Kamtibmas';
            } else if (['hoaks', 'provokasi', 'radikal', 'teroris'].includes(kw)) {
                threatLevel = 'amber';
                category = 'Siber/Teror';
            } else {
                threatLevel = 'amber';
                category = 'Kriminal';
            }
            break;
        }
    }
    return { threatLevel, category };
}

let pollingInterval = null;
const API_BASE = "";

function initRealtimeData() {
    const regionSelect = document.getElementById('region-select');
    
    // Initial fetch
    fetchDashboardData(regionSelect.value, false);
    fetchSocialData();
    fetchNewsData();
    fetchThreatAlerts();
    
    // Listen for changes
    regionSelect.addEventListener('change', (e) => {
        fetchDashboardData(e.target.value, false);
    });

    // Start Polling
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        fetchDashboardData(regionSelect.value, true);
        fetchSocialData();
        fetchNewsData();
        fetchThreatAlerts();
    }, 10000); // Poll every 10 seconds
}

async function fetchDashboardData(region, isSilent = false) {
    const container = document.getElementById('top-issues-container');
    const osintContainer = document.getElementById('osint-feed');
    
    if (!isSilent) {
        container.innerHTML = '<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-accent-blue text-2xl"></i><p class="text-xs text-gray-500 mt-2 font-mono">LOADING DATA...</p></div>';
        osintContainer.innerHTML = '<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-accent-emerald text-2xl"></i></div>';
    }
    
    try {
        // Fetch Top Issues from Node.js API
        const topRes = await fetch(`${API_BASE}/api/v1/incidents/top?region=${encodeURIComponent(region)}`);
        if (!topRes.ok) throw new Error("Server response not ok");
        const topIssues = await topRes.json();
        
        // Fetch Summary
        const sumRes = await fetch(`${API_BASE}/api/v1/dashboard/summary`);
        const summary = await sumRes.json();
        
        // Update main dashboard metrics
        const statActive = document.getElementById('stat-active-issues');
        if (statActive) statActive.innerText = summary.active_issues || 0;
        
        const statThreat = document.getElementById('stat-threat-level');
        if (statThreat) statThreat.innerText = summary.status || 'AMAN';
        
        const statOsint = document.getElementById('stat-total-osint');
        if (statOsint) statOsint.innerText = summary.total_articles || 0;
        
        // Update Dashboard Main Status
        document.getElementById('status-aman').classList.replace('bg-accent-emerald', 'bg-gray-800');
        document.getElementById('status-waspada').classList.replace('bg-accent-amber', 'bg-gray-800');
        document.getElementById('status-siaga').classList.replace('bg-accent-red', 'bg-gray-800');
        
        if (summary.status === 'AMAN') document.getElementById('status-aman').classList.replace('bg-gray-800', 'bg-accent-emerald');
        else if (summary.status === 'WASPADA') document.getElementById('status-waspada').classList.replace('bg-gray-800', 'bg-accent-amber');
        else if (summary.status === 'SIAGA') document.getElementById('status-siaga').classList.replace('bg-gray-800', 'bg-accent-red');

        // Update Sentiment Chart
        if (window.sentimentChartInstance) {
            window.sentimentChartInstance.data.datasets[0].data = [
                summary.sentiment.negative || 0,
                summary.sentiment.positive || 0,
                summary.sentiment.neutral || 100
            ];
            window.sentimentChartInstance.update();
        }
        if (window.newsSentimentChartInstance) {
            window.newsSentimentChartInstance.data.datasets[0].data = [
                summary.sentiment.negative || 0,
                summary.sentiment.positive || 0,
                summary.sentiment.neutral || 100
            ];
            window.newsSentimentChartInstance.update();
        }
        
        let htmlTop = '';
        topIssues.forEach(item => {
            const isUp = Math.random() > 0.3;
            const trendStr = (isUp ? '+' : '-') + (Math.floor(Math.random() * 50) + 1) + '%';
            
            let iconColor = 'text-accent-blue';
            let bgIcon = 'bg-accent-blue/10';
            if(item.severity_level === 'Merah') { iconColor = 'text-accent-red'; bgIcon = 'bg-accent-red/10'; }
            else if(item.severity_level === 'Oranye') { iconColor = 'text-accent-amber pulse-red'; bgIcon = 'bg-accent-red/10'; }
            else if(item.severity_level === 'Kuning') { iconColor = 'text-accent-amber'; bgIcon = 'bg-accent-amber/10'; }
            else if(item.severity_level === 'Tinggi') { iconColor = 'text-accent-red'; bgIcon = 'bg-accent-red/10'; } // fallback old schema
            
            htmlTop += `
            <div class="flex items-center justify-between p-2 rounded bg-dark-900 border border-gray-700/50 hover:border-gray-500 transition-colors cursor-pointer">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded ${bgIcon} flex items-center justify-center shrink-0">
                        <i class="ph-fill ph-hash ${iconColor}"></i>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-white leading-tight line-clamp-2">${item.title}</p>
                        <p class="text-[9px] text-gray-500 font-mono mt-0.5">${item.category}</p>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-[10px] ${isUp ? 'text-accent-red' : 'text-accent-emerald'} font-mono">${trendStr}</p>
                </div>
            </div>`;
        });
        
        // Fetch Recent OSINT
        const osintRes = await fetch(`${API_BASE}/api/v1/osint`);
        const osintData = await osintRes.json();
        
        let htmlOsint = '';
        if (osintData && osintData.length > 0) {
            osintData.forEach(item => {
                htmlOsint += renderOsintItem(item);
            });
        } else {
            // Fallback mock if db is empty
            htmlOsint = `
            <div class="p-2.5 rounded bg-dark-900 border border-gray-700/50 hover:border-gray-600 transition-colors">
                <p class="text-[11px] text-gray-300 italic mb-2">Belum ada data OSINT di database.</p>
            </div>`;
        }
        
        container.innerHTML = htmlTop || '<p class="text-xs text-gray-500 text-center py-4">Tidak ada data ditemukan.</p>';
        osintContainer.innerHTML = htmlOsint;
        
    } catch (error) {
        console.warn("Lokal Node.js Backend tidak aktif. Mengaktifkan Mode Fallback...");
        // FALLBACK TO PUBLIC RSS MODE (Phase 1 Logic)
        fetchFallbackRSS(region, container, osintContainer);
    }
}

// --- DYNAMIC DATA FETCHERS (PHASE 3) ---

async function fetchSocialData() {
    try {
        const [kwdRes, srcRes, critRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/analytics/keywords`),
            fetch(`${API_BASE}/api/v1/analytics/sources`),
            fetch(`${API_BASE}/api/v1/analytics/critical`)
        ]);
        
        const keywords = await kwdRes.json();
        const sources = await srcRes.json();
        const criticals = await critRes.json();
        
        // Render Keywords
        const kwdList = document.getElementById('analytics-keywords-list');
        if (kwdList && keywords.length > 0) {
            kwdList.innerHTML = keywords.map(k => `
                <div class="p-2 rounded bg-dark-900 border border-gray-700 flex justify-between items-center hover:border-gray-500 transition-colors">
                    <span class="text-xs font-bold text-accent-emerald">${k.word.toUpperCase()}</span>
                    <span class="text-[10px] text-gray-400 font-mono">${(k.count).toLocaleString()} occurances</span>
                </div>
            `).join('');
        }
        
        // Render Sources
        const srcList = document.getElementById('analytics-sources-list');
        if (srcList && sources.length > 0) {
            srcList.innerHTML = sources.map(s => `
                <div class="flex items-center gap-2 p-1.5 rounded hover:bg-dark-900 border border-transparent hover:border-gray-700 transition-colors cursor-pointer">
                    <div class="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                        <i class="ph-fill ph-newspaper text-accent-blue text-[10px]"></i></div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-bold text-white truncate">${s.source}</p>
                        <p class="text-[9px] text-gray-500 truncate">${s.count} articles processed</p>
                    </div>
                </div>
            `).join('');
        }

        // Render Critical Articles
        const critList = document.getElementById('analytics-critical-list');
        if (critList && criticals.length > 0) {
            critList.innerHTML = criticals.map(c => `
                <div class="bg-dark-900 border border-gray-700 p-3 rounded flex gap-3 hover:border-gray-500 transition-colors cursor-pointer" onclick="window.open('${c.url}', '_blank')">
                    <div class="w-10 h-10 rounded bg-gray-800 flex items-center justify-center shrink-0 text-white"><i class="ph-fill ph-article text-xl text-accent-amber"></i></div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <p class="text-xs font-bold text-white mb-1 line-clamp-1">${c.content}</p>
                            <span class="text-[9px] px-1.5 py-0.5 rounded ${c.ai_classification === 'Peringatan' ? 'bg-accent-red/20 text-accent-red border-accent-red/50' : 'bg-accent-amber/20 text-accent-amber border-accent-amber/50'} border whitespace-nowrap">${c.ai_classification}</span>
                        </div>
                        <p class="text-[10px] text-gray-400 line-clamp-1 mb-2">${c.source_user}</p>
                        <div class="flex gap-4 text-[9px] text-gray-500 font-mono">
                            <span><i class="ph-fill ph-trend-down text-accent-red"></i> Negative Sentiment</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error("Analytics fetch error:", e);
    }
}

async function fetchNewsData() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/osint`);
        const news = await res.json();
        
        const newsList = document.getElementById('news-list');
        if (newsList && news.length > 0) {
            newsList.innerHTML = news.map(n => {
                const borderClass = n.sentiment_label === 'Negatif' ? 'border-accent-red' : (n.sentiment_label === 'Positif' ? 'border-accent-emerald' : 'border-accent-blue');
                return `
                <div class="bg-dark-900 border-l-2 ${borderClass} p-3 rounded border border-gray-700/50 hover:bg-gray-800 transition-colors flex gap-3 cursor-pointer">
                    <div class="flex-1">
                        <div class="flex gap-2 items-center mb-1">
                            <span class="text-[9px] font-bold text-gray-300 uppercase">${n.source_user || 'News'}</span>
                            <span class="text-[8px] text-gray-500 font-mono">&bull; Baru Saja</span>
                            <span class="text-[8px] border border-gray-600 px-1 rounded text-gray-400 ml-auto">${n.sentiment_label}</span>
                        </div>
                        <p class="text-sm font-bold text-white mb-1 line-clamp-1">${n.content}</p>
                        <a href="${n.url}" target="_blank" class="text-[9px] text-accent-blue hover:underline">Baca Selengkapnya <i class="ph ph-arrow-up-right"></i></a>
                    </div>
                </div>
            `}).join('');
        }
    } catch (e) {}
}

async function fetchThreatAlerts() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/alerts/active`);
        const alerts = await res.json();
        
        // Asumsi HTML struktur untuk alert list ada di #view-threat .flex-1.overflow-y-auto...
        const alertContainers = document.querySelectorAll('#view-threat .flex-1.overflow-y-auto.space-y-3.pr-1');
        if (alertContainers.length > 0 && alerts.length > 0) {
            const container = alertContainers[0]; // Active Threat Alerts div
            container.innerHTML = alerts.map(a => `
                <div class="${a.severity_level === 'Merah' ? 'bg-accent-red/10 border-accent-red/50' : 'bg-accent-amber/10 border-accent-amber/50'} border p-2.5 rounded hover:bg-gray-800 transition-colors cursor-pointer">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[9px] font-bold ${a.severity_level === 'Merah' ? 'text-accent-red bg-accent-red/20' : 'text-accent-amber bg-accent-amber/20'} px-1 rounded uppercase">${a.category}</span>
                        <span class="text-[8px] text-gray-400 font-mono">Real-time</span>
                    </div>
                    <p class="text-xs font-bold text-white mb-1">${a.title}</p>
                    <p class="text-[10px] text-gray-300 line-clamp-2">${a.description}</p>
                    <div class="mt-2 text-[8px] font-mono flex gap-2">
                        <span class="text-gray-400"><i class="ph-fill ph-crosshair"></i> ${a.region}</span>
                        <span class="${a.severity_level === 'Merah' ? 'text-accent-red' : 'text-accent-amber'}">Level: ${a.severity_level}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {}
}

async function fetchFallbackRSS(region, container, osintContainer) {
    const CORS_PROXIES = [
        "https://corsproxy.io/?",
        "https://api.codetabs.com/v1/proxy?quest=",
        "https://api.allorigins.win/get?url="
    ];
    
    const RSS_FEEDS = {
        'Kab. Pasuruan': 'https://news.google.com/rss/search?q=pasuruan+OR+bangil+OR+pandaan+when:1d&hl=id&gl=ID&ceid=ID:id',
        'Jawa Timur': 'https://news.google.com/rss/search?q=jawa+timur+OR+jatim+when:1d&hl=id&gl=ID&ceid=ID:id',
        'Nasional': 'https://news.google.com/rss/search?q=indonesia+kriminal+OR+politik+when:1d&hl=id&gl=ID&ceid=ID:id',
        'Global': 'https://news.google.com/rss/search?q=internasional+when:1d&hl=id&gl=ID&ceid=ID:id'
    };
    
    const url = RSS_FEEDS[region];
    try {
        let xmlString = null;
        for (const proxy of CORS_PROXIES) {
            try {
                const response = await fetch(proxy + encodeURIComponent(url));
                if (!response.ok) continue;
                
                const textData = await response.text();
                xmlString = proxy.includes('allorigins') ? JSON.parse(textData).contents : textData;
                if (xmlString) break;
            } catch (e) {}
        }

        if (!xmlString) throw new Error("All CORS proxies failed.");

        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlString, "text/xml");
        const items = Array.from(xml.querySelectorAll("item"));
        
        let htmlTop = '';
        let htmlOsint = '';
        
        const topIssues = items.slice(0, 8);
        const osintFeeds = items.slice(0, 15);
        
        topIssues.forEach(item => {
            let title = item.querySelector("title")?.textContent || "";
            title = title.replace(/ - .*/, '');
            const analysis = analyzeThreat(title);
            const isUp = Math.random() > 0.3;
            const trendStr = (isUp ? '+' : '-') + (Math.floor(Math.random() * 50) + 1) + '%';
            
            const iconColor = analysis.threatLevel === 'red' ? 'text-accent-red' : analysis.threatLevel === 'amber' ? 'text-accent-amber' : 'text-accent-blue';
            const bgIcon = analysis.threatLevel === 'red' ? 'bg-accent-red/10' : analysis.threatLevel === 'amber' ? 'bg-accent-amber/10' : 'bg-accent-blue/10';
            
            htmlTop += `
            <div class="flex items-center justify-between p-2 rounded bg-dark-900 border border-gray-700/50 hover:border-gray-500 transition-colors cursor-pointer relative overflow-hidden">
                <div class="absolute top-0 right-0 w-1.5 h-full ${analysis.threatLevel === 'red' ? 'bg-accent-red' : 'bg-transparent'}"></div>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded ${bgIcon} flex items-center justify-center shrink-0">
                        <i class="ph-fill ph-hash ${iconColor}"></i>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-white leading-tight line-clamp-2">${title}</p>
                        <p class="text-[9px] text-gray-500 font-mono mt-0.5">${analysis.category} <span class="text-accent-amber text-[8px] border border-accent-amber/30 px-1 rounded ml-1">FALLBACK</span></p>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-[10px] ${isUp ? 'text-accent-red' : 'text-accent-emerald'} font-mono">${trendStr}</p>
                </div>
            </div>`;
        });
        
        osintFeeds.forEach((item, index) => {
            let title = item.querySelector("title")?.textContent || "";
            const source = title.split(' - ').pop() || "Internet";
            title = title.replace(/ - .*/, '');
            const analysis = analyzeThreat(title);
            let sentiment = 'Netral';
            let sentimentColor = 'text-gray-400 border-gray-600 bg-gray-800';
            
            if (analysis.threatLevel === 'red') { sentiment = 'Kritis'; sentimentColor = 'text-accent-red border-accent-red/30 bg-accent-red/10'; }
            else if (analysis.threatLevel === 'amber') { sentiment = 'Waspada'; sentimentColor = 'text-accent-amber border-accent-amber/30 bg-accent-amber/10'; }
            
            htmlOsint += `
            <div class="p-2.5 rounded bg-dark-900 border border-gray-700/50 hover:border-gray-600 transition-colors mb-2">
                <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1.5">
                        <i class="ph-fill ph-globe text-accent-emerald text-sm"></i>
                        <span class="text-[9px] text-gray-500 uppercase font-mono">WEB NEWS (FALLBACK)</span>
                    </div>
                    <span class="text-[9px] text-gray-600 font-mono">Baru saja</span>
                </div>
                <p class="text-[11px] text-gray-300 italic mb-2 line-clamp-2">" ${title} "</p>
                <div class="flex justify-between items-center mt-2 border-t border-gray-800 pt-2">
                     <span class="text-[9px] text-gray-500 font-mono truncate w-32">SRC: ${source}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded border ${sentimentColor} font-mono tracking-wider">${sentiment}</span>
                </div>
            </div>`;
        });
        
        container.innerHTML = htmlTop || '<p class="text-xs text-gray-500 text-center py-4">Tidak ada data ditemukan.</p>';
        osintContainer.innerHTML = htmlOsint || '<p class="text-xs text-gray-500 text-center py-4">Tidak ada data ditemukan.</p>';
        
    } catch (error) {
        console.error("Fallback RSS Error:", error);
        container.innerHTML = '<p class="text-xs text-accent-red text-center py-4">Sistem Backend Offline & Proxy Diblokir.</p>';
        osintContainer.innerHTML = '<p class="text-xs text-accent-red text-center py-4">Silakan install Node.js dan jalankan run.bat</p>';
    }
}

function renderOsintItem(item) {
    const platforms = {
        'Twitter': { icon: 'ph-twitter-logo', color: 'text-sky-400' },
        'Facebook': { icon: 'ph-facebook-logo', color: 'text-blue-500' },
        'TikTok': { icon: 'ph-tiktok-logo', color: 'text-white' },
        'News': { icon: 'ph-globe', color: 'text-accent-emerald' }
    };
    
    const platform = platforms[item.platform] || platforms['News'];
    const timeAgo = "Baru saja";
    const title = item.content || item.title || "No content";
    
    let sentimentColor = 'text-gray-400 border-gray-600 bg-gray-800';
    if (item.sentiment_label === 'Negatif') sentimentColor = 'text-accent-red border-accent-red/30 bg-accent-red/10';
    else if (item.sentiment_label === 'Positif') sentimentColor = 'text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10';
    
    return `
    <div class="p-2.5 rounded bg-dark-900 border border-gray-700/50 hover:border-gray-600 transition-colors mb-2">
        <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
                <i class="ph-fill ${platform.icon} ${platform.color} text-sm"></i>
                <span class="text-[9px] text-gray-500 uppercase font-mono">${item.platform || 'System'}</span>
            </div>
            <span class="text-[9px] text-gray-600 font-mono">${timeAgo}</span>
        </div>
        <p class="text-[11px] text-gray-300 italic mb-2 line-clamp-2">" ${title} "</p>
        <div class="flex justify-between items-center mt-2 border-t border-gray-800 pt-2">
             <span class="text-[9px] text-gray-500 font-mono truncate w-32">SRC: ${item.source_user || 'Internet'}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded border ${sentimentColor} font-mono tracking-wider">${item.sentiment_label || 'Netral'}</span>
        </div>
    </div>`;
}
