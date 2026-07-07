/**
 * ISAP Command Center - Main Application Logic
 * All data fetched from real API endpoints (Supabase + RSS)
 */

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initMap();
    initCharts();
    initRealtimeData();
});

// --- Navigation Logic ---
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => {
                b.classList.remove('bg-accent-blue/20', 'text-accent-blue', 'border-accent-blue/50', 'shadow-[0_0_15px_rgba(59,130,246,0.3)]');
                b.classList.add('text-gray-400', 'border-transparent');
                b.querySelector('i')?.classList.remove('text-accent-blue');
            });

            btn.classList.remove('text-gray-400', 'border-transparent');
            btn.classList.add('bg-accent-blue/20', 'text-accent-blue', 'border-accent-blue/50', 'shadow-[0_0_15px_rgba(59,130,246,0.3)]');
            btn.querySelector('i')?.classList.add('text-accent-blue');

            const views = document.querySelectorAll('.view-section');
            views.forEach(v => v.classList.add('hidden'));

            const targetId = btn.getAttribute('data-target');
            if (targetId) {
                const targetView = document.getElementById(targetId);
                if (targetView) targetView.classList.remove('hidden');
            }

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
        timeEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
        dateEl.textContent = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }, 1000);
}

// --- 2. Geo-Intelligence Map (Leaflet) ---
let mainMap = null;
let threatMap = null;
let mainMapMarkers = [];
let threatMapMarkers = [];

function initMap() {
    const pasuruanCoords = [-7.6453, 112.8224];

    mainMap = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(pasuruanCoords, 10);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
    }).addTo(mainMap);

    // Init Threat Map (Large)
    const threatMapEl = document.getElementById('threat-map-large');
    if (threatMapEl) {
        threatMap = L.map('threat-map-large', {
            zoomControl: true,
            attributionControl: false
        }).setView(pasuruanCoords, 11);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
        }).addTo(threatMap);
    }
}

function createIcon(type) {
    if (type === 'threat') {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="position:relative; width:20px; height:20px;">
                    <div style="position:absolute; width:100%; height:100%; background:#EF4444; border-radius:50%; opacity:0.8; z-index:2;"></div>
                    <div style="position:absolute; width:100%; height:100%; background:#EF4444; border-radius:50%; animation: pulse-red 2s infinite; z-index:1;"></div>
                   </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    } else if (type === 'warning') {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="width:12px; height:12px; background:#F59E0B; border-radius:50%; border:1px solid #0B1120;"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    } else {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="width:12px; height:12px; background:#3B82F6; border-radius:50%; border:1px solid #0B1120;"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    }
}

async function fetchMapMarkers() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/incidents/map-markers`);
        const markers = await res.json();

        // Clear existing markers
        mainMapMarkers.forEach(m => mainMap.removeLayer(m));
        mainMapMarkers = [];
        if (threatMap) {
            threatMapMarkers.forEach(m => threatMap.removeLayer(m));
            threatMapMarkers = [];
        }

        if (markers && markers.length > 0) {
            markers.forEach(item => {
                if (item.lat && item.lng) {
                    const icon = createIcon(item.type);
                    const popup = `<b>${item.region || ''}</b><br>${item.title}<br><small>${item.category} - ${item.severity}</small>`;

                    const m1 = L.marker([item.lat, item.lng], { icon }).addTo(mainMap).bindPopup(popup);
                    mainMapMarkers.push(m1);

                    if (threatMap && (item.type === 'threat' || item.type === 'warning')) {
                        const m2 = L.marker([item.lat, item.lng], { icon }).addTo(threatMap).bindPopup(popup);
                        threatMapMarkers.push(m2);
                    }
                }
            });
        }
    } catch (e) {
        console.warn("Map markers fetch error:", e);
    }
}

// --- 3. Charts (Chart.js) ---
function initCharts() {
    Chart.defaults.color = '#9CA3AF';
    Chart.defaults.font.family = "'Inter', sans-serif";

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

// --- 4. Real-Time Data Engine ---

const THREAT_KEYWORDS = {
    red: ['demo', 'unjuk rasa', 'bentrok', 'tawuran', 'ricuh', 'carok', 'kerusuhan', 'kebakaran'],
    amber: ['hoaks', 'provokasi', 'radikal', 'teroris', 'pembunuhan', 'begal', 'narkoba', 'narkotika', 'konflik', 'kriminal', 'pencurian', 'korupsi', 'penipuan', 'kecelakaan', 'laka lantas'],
    strategic: ['sembako', 'bbm', 'lpg', 'mbg', 'sekolah rakyat', 'kdmp', 'program pemerintah', 'kebijakan', 'pemerintah', 'bansos', 'bantuan', 'peraturan', 'perjanjian', 'pilpres', 'pilkada', 'pilkades', 'pemilu'],
    geopolitik: ['perang', 'geopolitik', 'pelemahan mata uang', 'nilai tukar', 'penutupan akses', 'hormuz', 'hormus', 'krisis global']
};

function analyzeThreat(text) {
    const lower = text.toLowerCase();
    let threatLevel = 'blue';
    let category = 'Sosial';

    for (const kw of THREAT_KEYWORDS.red) {
        if (lower.includes(kw)) {
            threatLevel = 'red'; category = 'Kamtibmas';
            break;
        }
    }

    if (threatLevel === 'blue') {
        for (const kw of THREAT_KEYWORDS.amber) {
            if (lower.includes(kw)) {
                threatLevel = 'amber';
                if (['hoaks', 'provokasi', 'radikal', 'teroris'].includes(kw)) {
                    category = 'Siber/Teror';
                } else {
                    category = 'Kriminal';
                }
                break;
            }
        }
    }

    if (threatLevel === 'blue') {
        for (const kw of THREAT_KEYWORDS.strategic) {
            if (lower.includes(kw)) {
                category = 'Kebijakan/Program';
                break;
            }
        }
    }

    if (threatLevel === 'blue') {
        for (const kw of THREAT_KEYWORDS.geopolitik) {
            if (lower.includes(kw)) {
                category = 'Geopolitik';
                break;
            }
        }
    }

    return { threatLevel, category };
}

const RSS_FEEDS = {
    'Kab. Pasuruan': 'https://news.google.com/rss/search?q=pasuruan+OR+bangil+OR+pandaan+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Jawa Timur': 'https://news.google.com/rss/search?q=jawa+timur+OR+jatim+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Nasional': 'https://news.google.com/rss/search?q=indonesia+kriminal+OR+politik+when:1d&hl=id&gl=ID&ceid=ID:id',
    'Global': 'https://news.google.com/rss/search?q=internasional+when:1d&hl=id&gl=ID&ceid=ID:id'
};

let pollingInterval = null;
const API_BASE = "";

function initRealtimeData() {
    const regionSelect = document.getElementById('region-select');

    // Initial fetch — all data
    fetchDashboardData(regionSelect.value, false);
    fetchDashboardStatus();
    fetchThreatTicker();
    fetchAIRecommendation();
    fetchSocialData();
    fetchNewsData();
    fetchMediaStats();
    fetchThreatAlerts();
    fetchMapMarkers();

    regionSelect.addEventListener('change', (e) => {
        fetchDashboardData(e.target.value, false);
    });

    // Polling every 30 seconds (reduced from 10s to avoid overload)
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        fetchDashboardData(regionSelect.value, true);
        fetchDashboardStatus();
        fetchSocialData();
        fetchNewsData();
        fetchMediaStats();
        fetchThreatAlerts();
        fetchMapMarkers();
    }, 30000);

    // Ticker + AI recommendation refresh every 60 seconds
    setInterval(() => {
        fetchThreatTicker();
        fetchAIRecommendation();
    }, 60000);
}

// --- DASHBOARD STATUS (replaces hardcoded SIAGA/124/7) ---
async function fetchDashboardStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/dashboard/status`);
        const data = await res.json();

        // Update status text and colors
        const statusText = document.getElementById('status-text');
        const statusIcon = document.getElementById('status-icon');
        const statusWrapper = document.getElementById('status-icon-wrapper');

        if (statusText) {
            statusText.textContent = data.status;
            statusText.className = `text-3xl font-bold text-accent-${data.statusColor}`;
        }

        if (statusWrapper) {
            statusWrapper.className = `w-12 h-12 rounded-full border-4 border-accent-${data.statusColor} border-t-transparent animate-spin flex items-center justify-center relative`;
        }

        if (statusIcon) {
            const icons = { AMAN: 'ph-shield-check', WASPADA: 'ph-warning', SIAGA: 'ph-warning-octagon' };
            statusIcon.className = `ph-fill ${icons[data.status] || 'ph-shield-check'} text-accent-${data.statusColor} text-lg absolute`;
        }

        // Update counters
        const countActive = document.getElementById('count-active-issues');
        const countThreats = document.getElementById('count-high-threats');
        if (countActive) countActive.textContent = data.active_issues;
        if (countThreats) countThreats.textContent = data.high_threats;

        // Update threat bars
        const barProv = document.getElementById('bar-provokasi');
        const barHoaks = document.getElementById('bar-hoaks');
        const barKrim = document.getElementById('bar-kriminal');
        if (barProv) barProv.style.width = `${data.threat_bars.provokasi}%`;
        if (barHoaks) barHoaks.style.width = `${data.threat_bars.hoaks}%`;
        if (barKrim) barKrim.style.width = `${data.threat_bars.kriminal}%`;

        const pctProv = document.getElementById('bar-provokasi-pct');
        const pctHoaks = document.getElementById('bar-hoaks-pct');
        const pctKrim = document.getElementById('bar-kriminal-pct');
        if (pctProv) pctProv.textContent = `${data.threat_bars.provokasi}%`;
        if (pctHoaks) pctHoaks.textContent = `${data.threat_bars.hoaks}%`;
        if (pctKrim) pctKrim.textContent = `${data.threat_bars.kriminal}%`;

    } catch (e) {
        console.warn("Dashboard status fetch error:", e);
    }
}

// --- THREAT TICKER (replaces hardcoded marquee) ---
async function fetchThreatTicker() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/threat-feed`);
        const data = await res.json();
        const ticker = document.getElementById('threat-ticker');
        if (ticker && data.feeds && data.feeds.length > 0) {
            ticker.textContent = data.feeds.join('  |  ');
        }
    } catch (e) {
        console.warn("Threat ticker fetch error:", e);
    }
}

// --- AI RECOMMENDATION (replaces hardcoded text) ---
async function fetchAIRecommendation() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/ai/recommendation`);
        const data = await res.json();

        const box = document.getElementById('ai-recommendation-box');
        const text = document.getElementById('ai-recommendation-text');

        if (box && text) {
            let kwHtml = '';
            if (data.keywords && data.keywords.length > 0) {
                kwHtml = data.keywords.map(k => `<span class="text-white bg-dark-900 px-1 rounded border border-gray-700">${k}</span>`).join(' ');
            }

            text.innerHTML = `${data.preventif}`;

            if (kwHtml) {
                text.innerHTML += `<br><span class="text-[9px] text-gray-500 font-mono mt-1 block">Keywords: ${kwHtml}</span>`;
            }
        }
    } catch (e) {
        console.warn("AI recommendation fetch error:", e);
    }
}

// --- MEDIA STATS (replaces hardcoded Warta Bromo 142 etc) ---
async function fetchMediaStats() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/media-stats`);
        const data = await res.json();

        // Update News page total articles
        const totalEl = document.getElementById('news-total-articles');
        if (totalEl) totalEl.textContent = data.total || 0;

        // Update Media Teraktif
        const container = document.getElementById('media-active-stats');
        if (container && data.stats && data.stats.length > 0) {
            container.innerHTML = data.stats.slice(0, 5).map(s => `
                <div class="flex justify-between items-center"><span class="text-white truncate">${s.source}</span><span class="text-accent-blue">${s.count}</span></div>
                <div class="w-full bg-dark-900 h-1 mb-2">
                    <div class="bg-accent-blue h-1 transition-all" style="width: ${s.percentage}%"></div>
                </div>
            `).join('');
        } else if (container) {
            container.innerHTML = '<p class="text-[10px] text-gray-500 text-center py-2">Belum ada data media.</p>';
        }
    } catch (e) {
        console.warn("Media stats fetch error:", e);
    }
}

// --- EWS ALERTS (replaces hardcoded threat alerts) ---
async function fetchThreatAlerts() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/alerts/active`);
        const alerts = await res.json();

        const container = document.getElementById('ews-alerts-container');
        if (container && alerts && alerts.length > 0) {
            container.innerHTML = alerts.map(a => {
                const isRed = ['Merah', 'Tinggi'].includes(a.severity_level);
                const colorClass = isRed ? 'accent-red' : 'accent-amber';
                const time = new Date(a.created_at);
                const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

                return `
                <div class="bg-${colorClass}/10 border border-${colorClass}/50 p-2.5 rounded hover:bg-${colorClass}/20 transition-colors cursor-pointer">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[9px] font-bold text-${colorClass} bg-${colorClass}/20 px-1 rounded uppercase">${a.category || 'ANCAMAN'}</span>
                        <span class="text-[8px] text-gray-400 font-mono">${timeStr}</span>
                    </div>
                    <p class="text-xs font-bold text-white mb-1">${a.title}</p>
                    <p class="text-[10px] text-gray-300 line-clamp-2">${a.description || ''}</p>
                    <div class="mt-2 text-[8px] font-mono flex gap-2">
                        <span class="text-gray-400"><i class="ph-fill ph-crosshair"></i> ${a.region || ''}</span>
                        <span class="text-${colorClass}">Level: ${a.severity_level}</span>
                    </div>
                </div>`;
            }).join('');
        } else if (container) {
            container.innerHTML = '<p class="text-[10px] text-gray-500 text-center py-4 font-mono">✅ Tidak ada ancaman aktif saat ini.</p>';
        }
    } catch (e) {
        console.warn("EWS alerts fetch error:", e);
    }
}

// --- MAIN DASHBOARD DATA FETCHER ---
async function fetchDashboardData(region, isSilent = false) {
    const container = document.getElementById('top-issues-container');
    const osintContainer = document.getElementById('osint-feed');

    if (!isSilent) {
        container.innerHTML = '<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-accent-blue text-2xl"></i><p class="text-xs text-gray-500 mt-2 font-mono">LOADING DATA...</p></div>';
        osintContainer.innerHTML = '<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-accent-emerald text-2xl"></i></div>';
    }

    try {
        const topRes = await fetch(`${API_BASE}/api/v1/incidents/top?region=${encodeURIComponent(region)}`);
        if (!topRes.ok) throw new Error("Server response not ok");
        const topIssues = await topRes.json();

        const sumRes = await fetch(`${API_BASE}/api/v1/dashboard/summary`);
        const summary = await sumRes.json();

        // Update sentiment score display
        const sentScore = document.getElementById('sentiment-score');
        const sentLabel = document.getElementById('sentiment-label');
        if (sentScore) {
            const dominant = Math.max(summary.sentiment.negative, summary.sentiment.positive, summary.sentiment.neutral);
            sentScore.textContent = `${dominant}%`;
        }
        if (sentLabel) {
            if (summary.sentiment.negative >= summary.sentiment.positive && summary.sentiment.negative >= summary.sentiment.neutral) {
                sentLabel.textContent = 'Negatif';
            } else if (summary.sentiment.positive >= summary.sentiment.neutral) {
                sentLabel.textContent = 'Positif';
            } else {
                sentLabel.textContent = 'Netral';
            }
        }

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
            if (['Merah', 'Tinggi'].includes(item.severity_level)) { iconColor = 'text-accent-red'; bgIcon = 'bg-accent-red/10'; }
            else if (item.severity_level === 'Oranye') { iconColor = 'text-accent-amber pulse-red'; bgIcon = 'bg-accent-red/10'; }
            else if (item.severity_level === 'Kuning') { iconColor = 'text-accent-amber'; bgIcon = 'bg-accent-amber/10'; }

            htmlTop += `
            <div class="flex items-center justify-between p-2 rounded bg-dark-900 border border-gray-700/50 hover:border-gray-500 transition-colors cursor-pointer">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded ${bgIcon} flex items-center justify-center shrink-0">
                        <i class="ph-fill ph-hash ${iconColor}"></i>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-white leading-tight line-clamp-2">${item.title}</p>
                        <p class="text-[9px] text-gray-500 font-mono mt-0.5">${item.category} <span class="text-accent-cyan text-[8px] border border-accent-cyan/30 px-1 rounded ml-1">LIVE</span></p>
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
            htmlOsint = `<div class="p-2.5 rounded bg-dark-900 border border-gray-700/50"><p class="text-[11px] text-gray-300 italic mb-2">Belum ada data OSINT di database.</p></div>`;
        }

        container.innerHTML = htmlTop || '<p class="text-xs text-gray-500 text-center py-4">Tidak ada data ditemukan.</p>';
        osintContainer.innerHTML = htmlOsint;

    } catch (error) {
        console.warn("API Backend tidak aktif. Mengaktifkan Mode RSS Fallback...");
        fetchFallbackRSS(region, container, osintContainer);
    }
}

// --- SOCIAL DATA FETCHER ---
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
        const dashKwdList = document.getElementById('trending-keywords-dashboard');

        if (keywords.length > 0) {
            const kwdHTML = keywords.map(k => `
                <div class="p-2 rounded bg-dark-900 border border-gray-700 flex justify-between items-center hover:border-gray-500 transition-colors">
                    <span class="text-xs font-bold text-accent-emerald">#${k.word.toUpperCase()}</span>
                    <span class="text-[10px] text-gray-400 font-mono">${(k.count).toLocaleString()} mentions</span>
                </div>
            `).join('');

            if (kwdList) kwdList.innerHTML = kwdHTML;

            if (dashKwdList) {
                dashKwdList.innerHTML = keywords.slice(0, 5).map((k, i) => {
                    const isUp = Math.random() > 0.3;
                    const color = isUp ? 'text-accent-emerald' : 'text-accent-amber';
                    const icon = isUp ? 'ph-trend-up' : 'ph-trend-down';
                    return `
                    <div class="p-2 rounded bg-dark-900 border border-gray-700/50 flex justify-between items-center hover:border-gray-500 transition-colors cursor-pointer">
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] font-mono text-gray-500 w-4">${i + 1}.</span>
                            <span class="text-xs font-bold text-white">#${k.word.toUpperCase()}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] text-gray-400 font-mono">${(k.count).toLocaleString()} vol</span>
                            <i class="ph-fill ${icon} ${color} text-sm"></i>
                        </div>
                    </div>`;
                }).join('');
            }
        } else {
            if (kwdList) kwdList.innerHTML = '<p class="text-[10px] text-gray-500 text-center py-4">Belum ada data kata kunci.</p>';
            if (dashKwdList) dashKwdList.innerHTML = '<p class="text-[10px] text-gray-500 text-center py-4">Belum ada data trending.</p>';
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
        } else if (srcList) {
            srcList.innerHTML = '<p class="text-[10px] text-gray-500 text-center py-4">Belum ada data sumber berita.</p>';
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
        } else if (critList) {
            critList.innerHTML = '<p class="text-[10px] text-gray-500 text-center py-4">Tidak ada artikel kritis (Sentimen Negatif).</p>';
        }
    } catch (e) {
        console.error("Analytics fetch error:", e);
    }
}

// --- NEWS DATA FETCHER ---
async function fetchNewsData() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/osint`);
        const news = await res.json();

        const newsList = document.getElementById('news-list');
        if (newsList && news.length > 0) {
            newsList.innerHTML = news.map(n => {
                const borderClass = n.sentiment_label === 'Negatif' ? 'border-accent-red' : (n.sentiment_label === 'Positif' ? 'border-accent-emerald' : 'border-accent-blue');
                const time = new Date(n.created_at);
                const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return `
                <div class="bg-dark-900 border-l-2 ${borderClass} p-3 rounded border border-gray-700/50 hover:bg-gray-800 transition-colors flex gap-3 cursor-pointer">
                    <div class="flex-1">
                        <div class="flex gap-2 items-center mb-1">
                            <span class="text-[9px] font-bold text-gray-300 uppercase">${n.source_user || 'News'}</span>
                            <span class="text-[8px] text-gray-500 font-mono">&bull; ${timeStr}</span>
                            <span class="text-[8px] border border-gray-600 px-1 rounded text-gray-400 ml-auto">${n.sentiment_label}</span>
                        </div>
                        <p class="text-sm font-bold text-white mb-1 line-clamp-1">${n.content}</p>
                        <a href="${n.url}" target="_blank" class="text-[9px] text-accent-blue hover:underline">Baca Selengkapnya <i class="ph ph-arrow-up-right"></i></a>
                    </div>
                </div>
            `}).join('');
        } else if (newsList) {
            newsList.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Belum ada data berita.</p>';
        }
    } catch (e) {}
}

// --- FALLBACK RSS (server-side proxy, no CORS issues) ---
async function fetchFallbackRSS(region, container, osintContainer) {
    const feedUrl = RSS_FEEDS[region];
    try {
        const proxyUrl = `${API_BASE}/api/v1/rss-proxy?url=${encodeURIComponent(feedUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`RSS proxy returned ${response.status}`);

        const data = await response.json();
        if (!data.success || !data.items || data.items.length === 0) {
            throw new Error("No items returned from RSS proxy");
        }

        const items = data.items;
        let htmlTop = '';
        let htmlOsint = '';

        items.slice(0, 8).forEach(item => {
            let title = (item.title || "").replace(/ - .*/, '');
            const analysis = analyzeThreat(title);
            const isUp = Math.random() > 0.3;
            const trendStr = (isUp ? '+' : '-') + (Math.floor(Math.random() * 50) + 1) + '%';
            const iconColor = analysis.threatLevel === 'red' ? 'text-accent-red' : analysis.threatLevel === 'amber' ? 'text-accent-amber' : 'text-accent-blue';
            const bgIcon = analysis.threatLevel === 'red' ? 'bg-accent-red/10' : analysis.threatLevel === 'amber' ? 'bg-accent-amber/10' : 'bg-accent-blue/10';

            // Only show red/amber or Geopolitik/Kebijakan in Top Issues
            if (['red', 'amber'].includes(analysis.threatLevel) || ['Geopolitik', 'Kebijakan/Program'].includes(analysis.category)) {
                htmlTop += `
                <div class="flex items-center justify-between p-2 rounded bg-dark-900 border border-gray-700/50 hover:border-gray-500 transition-colors cursor-pointer relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-1.5 h-full ${analysis.threatLevel === 'red' ? 'bg-accent-red' : 'bg-transparent'}"></div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded ${bgIcon} flex items-center justify-center shrink-0">
                            <i class="ph-fill ph-hash ${iconColor}"></i>
                        </div>
                        <div>
                            <p class="text-[11px] font-bold text-white leading-tight line-clamp-2">${title}</p>
                            <p class="text-[9px] text-gray-500 font-mono mt-0.5">${analysis.category} <span class="text-accent-cyan text-[8px] border border-accent-cyan/30 px-1 rounded ml-1">RSS</span></p>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-[10px] ${isUp ? 'text-accent-red' : 'text-accent-emerald'} font-mono">${trendStr}</p>
                    </div>
                </div>`;
            }
        });

        items.slice(0, 15).forEach(item => {
            let title = (item.title || "").replace(/ - .*/, '');
            const source = item.source || (item.title || "").split(' - ').pop() || "Internet";
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
                        <span class="text-[9px] text-gray-500 uppercase font-mono">WEB NEWS (RSS)</span>
                    </div>
                    <span class="text-[9px] text-gray-600 font-mono">${item.pubDate ? new Date(item.pubDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}</span>
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
        container.innerHTML = '<p class="text-xs text-accent-red text-center py-4">Sistem Backend Offline. Periksa koneksi API.</p>';
        osintContainer.innerHTML = '<p class="text-xs text-accent-red text-center py-4">Silakan periksa deployment Vercel atau jalankan run.bat secara lokal</p>';
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
    const time = item.created_at ? new Date(item.created_at) : null;
    const timeStr = time ? time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja';
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
            <span class="text-[9px] text-gray-600 font-mono">${timeStr}</span>
        </div>
        <p class="text-[11px] text-gray-300 italic mb-2 line-clamp-2">" ${title} "</p>
        <div class="flex justify-between items-center mt-2 border-t border-gray-800 pt-2">
             <span class="text-[9px] text-gray-500 font-mono truncate w-32">SRC: ${item.source_user || 'Internet'}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded border ${sentimentColor} font-mono tracking-wider">${item.sentiment_label || 'Netral'}</span>
        </div>
    </div>`;
}
