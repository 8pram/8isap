/**
 * ISAP Command Center - Main Application Logic
 * Prototype MVP (Mock Data & Frontend Interactions)
 */

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initMap();
    initCharts();
    // populateTopIssues();
    // populateOsintFeed();
    initRealtimeData();
});

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

    // Dummy Markers
    L.marker([-7.5986, 112.7845], {icon: threatIcon}).addTo(map).bindPopup('<b>Bangil</b><br>Potensi Provokasi Massa');
    L.marker([-7.6453, 112.8224], {icon: warningIcon}).addTo(map).bindPopup('<b>Pasuruan Kota</b><br>Sebaran Hoaks WA');
    L.marker([-7.7112, 112.6953], {icon: infoIcon}).addTo(map).bindPopup('<b>Pandaan</b><br>Pantauan Aktivitas Buruh');
    L.marker([-7.7371, 112.8711], {icon: warningIcon}).addTo(map).bindPopup('<b>Grati</b><br>Isu Tanah');
}

// --- 3. Charts (Chart.js) ---
function initCharts() {
    Chart.defaults.color = '#9CA3AF';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Sentiment Doughnut Chart
    const ctxSent = document.getElementById('sentimentChart').getContext('2d');
    new Chart(ctxSent, {
        type: 'doughnut',
        data: {
            labels: ['Negatif', 'Positif', 'Netral'],
            datasets: [{
                data: [68, 12, 20],
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

let wsConnection = null;

function initRealtimeData() {
    const regionSelect = document.getElementById('region-select');
    
    // Initial fetch from Node.js API
    fetchDashboardData(regionSelect.value);
    
    // Listen for changes
    regionSelect.addEventListener('change', (e) => {
        fetchDashboardData(e.target.value);
    });

    // Establish WebSocket Connection to Node.js Backend
    connectWebSocket();
}

function connectWebSocket() {
    // In production, change this to the real wss:// URL
    wsConnection = new WebSocket('ws://localhost:3000');
    
    wsConnection.onopen = () => {
        console.log('Connected to ISAP WebSocket Server');
    };
    
    wsConnection.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === 'NEW_OSINT') {
                // Update feed directly when new data arrives
                console.log('Received new OSINT data from backend:', message.data);
                // Trigger visual alert
                const osintFeed = document.getElementById('osint-feed');
                if (osintFeed) {
                    osintFeed.insertAdjacentHTML('afterbegin', renderOsintItem(message.data));
                    // Add pulse effect
                    osintFeed.firstElementChild.classList.add('pulse-red');
                    setTimeout(() => osintFeed.firstElementChild.classList.remove('pulse-red'), 3000);
                }
            }
        } catch (e) {
            console.error('Error parsing WS message:', e);
        }
    };
    
    wsConnection.onclose = () => {
        console.log('WebSocket disconnected. Attempting to reconnect in 5s...');
        setTimeout(connectWebSocket, 5000);
    };
}

async function fetchDashboardData(region) {
    const container = document.getElementById('top-issues-container');
    const osintContainer = document.getElementById('osint-feed');
    
    container.innerHTML = '<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-accent-blue text-2xl"></i><p class="text-xs text-gray-500 mt-2 font-mono">LOADING DATA DARI BACKEND...</p></div>';
    osintContainer.innerHTML = '<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-accent-emerald text-2xl"></i></div>';
    
    try {
        // Fetch Top Issues from Node.js API
        const topRes = await fetch(`http://localhost:3000/api/v1/incidents/top?region=${encodeURIComponent(region)}`);
        if (!topRes.ok) throw new Error("Server response not ok");
        const topIssues = await topRes.json();
        
        let htmlTop = '';
        topIssues.forEach(item => {
            const isUp = Math.random() > 0.3;
            const trendStr = (isUp ? '+' : '-') + (Math.floor(Math.random() * 50) + 1) + '%';
            
            const iconColor = item.severity_level === 'Tinggi' || item.alert === 'red' ? 'text-accent-red' : 
                              item.severity_level === 'Sedang' || item.alert === 'amber' ? 'text-accent-amber' : 'text-accent-blue';
            const bgIcon = item.severity_level === 'Tinggi' || item.alert === 'red' ? 'bg-accent-red/10' : 
                           item.severity_level === 'Sedang' || item.alert === 'amber' ? 'bg-accent-amber/10' : 'bg-accent-blue/10';
            
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
        const osintRes = await fetch(`http://localhost:3000/api/v1/osint`);
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
        console.warn("Lokal Node.js Backend tidak aktif. Mengaktifkan Mode Fallback (Public RSS Proxy)...");
        // FALLBACK TO PUBLIC RSS MODE (Phase 1 Logic)
        fetchFallbackRSS(region, container, osintContainer);
    }
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
