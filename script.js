let map, markersCluster;
let processedData = {};
let evolutionChartInstance = null;
let regionChartInstance = null;

// --- ETAT INITIAL ---
let USE_LIVE_SPARQL = false;
const SPARQL_ENDPOINT = "http://localhost:7200/repositories/Gares_Frequentation_RCW";

// --- THEME MANAGEMENT ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);

    updateChartsTheme();
}

function updateThemeButton(theme) {
    const btn = document.getElementById('themeBtn');
    if (theme === 'dark') {
        btn.innerText = "☀️ Light";
    } else {
        btn.innerText = "🌙 Dark";
    }
}

function updateChartsTheme() {
    if (regionChartInstance) renderStats();
}

// --- MAP & DATA ---
function initMap() {
    initTheme();

    map = L.map('map', { zoomControl: false }).setView([46.603354, 1.888334], 6);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO',
        maxZoom: 19
    }).addTo(map);

    markersCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        showCoverageOnHover: false
    });
    map.addLayer(markersCluster);

    loadDashboardData();
}

function toggleMode() {
    USE_LIVE_SPARQL = !USE_LIVE_SPARQL;
    const btn = document.getElementById('modeBtn');
    if (USE_LIVE_SPARQL) {
        btn.innerText = "⚡ Live";
        btn.classList.add('btn-active');
        btn.classList.remove('btn-secondary');
    } else {
        btn.innerText = "📂 JSON";
        btn.classList.remove('btn-active');
        btn.classList.add('btn-secondary');
    }
    loadDashboardData();
}

async function loadDashboardData() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    loader.innerText = USE_LIVE_SPARQL ? "Connexion à GraphDB..." : "Chargement des données...";

    processedData = {};
    markersCluster.clearLayers();
    document.getElementById('total-stations').innerText = "0";
    document.getElementById('top-stations-list').innerHTML = "";
    if (regionChartInstance) regionChartInstance.destroy();

    try {
        let rawBindings = [];
        if (USE_LIVE_SPARQL) {
            console.log("Tentative de connexion SPARQL...");
            const query = `
                PREFIX sncf: <http://data.sncf.fr/frequentation-gares/>
                PREFIX schema1: <http://schema.org/>
                SELECT ?nom ?region ?dept ?lat ?long ?annee ?nombre WHERE {
                    ?gare a sncf:Gare ; sncf:Nom_de_la_gare ?nom ;
                          sncf:region ?region ; sncf:departement ?dept ;
                          schema1:latitude ?lat ; schema1:longitude ?long .
                    ?gare ?p ?nombre .
                    FILTER(CONTAINS(STR(?p), "Total_Voyageurs_"))
                    BIND(STRAFTER(STR(?p), "Total_Voyageurs_") AS ?annee)
                    FILTER(REGEX(?annee, "^[0-9]{4}$"))
                }
            `;
            rawBindings = await runSparql(query);
        } else {
            console.log("Chargement JSON statique...");
            const response = await fetch('gares.json');
            if (!response.ok) throw new Error("Fichier gares.json introuvable");
            const json = await response.json();
            rawBindings = json.results.bindings;
        }
        processGraphDBData(rawBindings);

        populateRegionFilter();
        populateYearFilter();
        populateBottomYearFilter();

        renderMap();
        renderStats();
        renderTop5();
        renderBottom5();
        updateStationCount();

    } catch (error) {
        console.error(error);
        if (USE_LIVE_SPARQL) {
            alert("ERREUR CONNEXION GRAPHDB ! Retour au mode JSON.");
            toggleMode();
        } else {
            alert("Erreur JSON : " + error.message);
        }
    } finally {
        loader.style.display = 'none';
    }
}

async function runSparql(query) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const url = SPARQL_ENDPOINT + "?query=" + encodeURIComponent(query);
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' }, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error("Erreur HTTP: " + response.status);
        const json = await response.json();
        return json.results.bindings;
    } catch (err) { throw err; }
}

function processGraphDBData(bindings) {
    bindings.forEach(row => {
        const nom = row.nom.value;
        const annee = row.annee.value;
        const nombre = parseInt(row.nombre.value);

        if (!processedData[nom]) {
            processedData[nom] = {
                nom: nom,
                lat: parseFloat(row.lat.value),
                long: parseFloat(row.long.value),
                region: row.region.value,
                dept: row.dept.value,
                history: {}
            };
        }
        processedData[nom].history[annee] = nombre;
    });
}

function populateRegionFilter() {
    const regions = new Set();
    Object.values(processedData).forEach(s => regions.add(s.region));

    const select = document.getElementById('regionFilter');
    select.innerHTML = '<option value="">🌍 Toutes les régions</option>';

    Array.from(regions).sort().forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.innerText = r;
        select.appendChild(opt);
    });
}

function populateYearFilter() {
    const years = new Set();
    Object.values(processedData).forEach(s => {
        Object.keys(s.history).forEach(year => years.add(year));
    });

    const select = document.getElementById('topYearFilter');
    select.innerHTML = '';

    const sortedYears = Array.from(years).sort().reverse();
    sortedYears.forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.innerText = `📅 ${year}`;
        select.appendChild(opt);
    });
}

function populateBottomYearFilter() {
    const years = new Set();
    Object.values(processedData).forEach(s => {
        Object.keys(s.history).forEach(year => years.add(year));
    });

    const select = document.getElementById('bottomYearFilter');
    select.innerHTML = '';

    const sortedYears = Array.from(years).sort().reverse();
    sortedYears.forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.innerText = `📅 ${year}`;
        select.appendChild(opt);
    });
}

function getFilteredStations() {
    const searchInput = document.getElementById('search').value.toLowerCase();
    const regionInput = document.getElementById('regionFilter').value;

    return Object.values(processedData).filter(s => {
        const matchName = s.nom.toLowerCase().includes(searchInput);
        const matchRegion = regionInput === "" || s.region === regionInput;
        return matchName && matchRegion;
    });
}

function updateStationCount(count = null) {
    const finalCount = count !== null ? count : Object.keys(processedData).length;
    document.getElementById('total-stations').innerText = finalCount.toLocaleString();
}

function renderMap() {
    markersCluster.clearLayers();
    const stations = getFilteredStations();

    stations.forEach(gare => {
        const marker = L.marker([gare.lat, gare.long]);
        marker.bindPopup(`<b>${gare.nom}</b><br>${gare.region}`);
        marker.on('click', () => displayDetails(gare));
        markersCluster.addLayer(marker);
    });
}

function filterStations() {
    renderMap();

    const stations = getFilteredStations();
    updateStationCount(stations.length);

    renderTop5(stations);
    renderBottom5(stations);
}

function renderStats() {
    const regionCounts = {};
    Object.values(processedData).forEach(gare => {
        const val2023 = gare.history['2023'] || 0;
        if (val2023 > 0) regionCounts[gare.region] = (regionCounts[gare.region] || 0) + val2023;
    });

    const ctx = document.getElementById('regionChart').getContext('2d');
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e', '#16a085', '#d35400'];
    const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ecf0f1' : '#2c3e50';

    if (regionChartInstance) regionChartInstance.destroy();
    regionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedRegions.map(x => x[0]),
            datasets: [{
                data: sortedRegions.map(x => x[1]),
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: isDark ? '#343434' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            label += context.raw.toLocaleString() + " voyageurs";
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderTop5(stationsSource = null) {
    const source = stationsSource || Object.values(processedData);

    const yearSelect = document.getElementById('topYearFilter');
    const countSelect = document.getElementById('topCountFilter');
    const selectedYear = yearSelect ? yearSelect.value : '2023';
    const topCount = countSelect ? parseInt(countSelect.value) : 5;

    const sortedStations = source
        .filter(s => s.history[selectedYear] !== undefined)
        .sort((a, b) => (b.history[selectedYear] || 0) - (a.history[selectedYear] || 0))
        .slice(0, topCount);

    const list = document.getElementById('top-stations-list');
    list.innerHTML = "";

    if (sortedStations.length === 0) {
        list.innerHTML = "<li style='justify-content:center; color:var(--text-secondary)'>Aucune gare trouvée</li>";
        return;
    }

    sortedStations.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${s.nom}</span> <span class="count">${(s.history[selectedYear] || 0).toLocaleString()}</span>`;
        li.onclick = () => {
            map.setView([s.lat, s.long], 14);
            displayDetails(s);
        };
        list.appendChild(li);
    });
}

function renderBottom5(stationsSource = null) {
    const source = stationsSource || Object.values(processedData);

    const yearSelect = document.getElementById('bottomYearFilter');
    const countSelect = document.getElementById('bottomCountFilter');
    const selectedYear = yearSelect ? yearSelect.value : '2023';
    const bottomCount = countSelect ? parseInt(countSelect.value) : 5;

    const sortedStations = source
        .filter(s => s.history[selectedYear] !== undefined && s.history[selectedYear] > 0)
        .sort((a, b) => (a.history[selectedYear] || 0) - (b.history[selectedYear] || 0))
        .slice(0, bottomCount);

    const list = document.getElementById('bottom-stations-list');
    list.innerHTML = "";

    if (sortedStations.length === 0) {
        list.innerHTML = "<li style='justify-content:center; color:var(--text-secondary)'>Aucune gare trouvée</li>";
        return;
    }

    sortedStations.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${s.nom}</span> <span class="count">${(s.history[selectedYear] || 0).toLocaleString()}</span>`;
        li.onclick = () => {
            map.setView([s.lat, s.long], 14);
            displayDetails(s);
        };
        list.appendChild(li);
    });
}

// --- WIKIDATA IMAGE ---
async function getWikidataImage(stationName) {
    const photoImg = document.getElementById('st-photo');
    const placeholder = document.getElementById('photo-placeholder');

    photoImg.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = "<span>⌛</span><span>Recherche...</span>";

    const sparqlQuery = `
        SELECT ?image WHERE {
            ?s rdfs:label "${stationName}"@fr . 
            ?s wdt:P18 ?image .
        } LIMIT 1
    `;

    const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparqlQuery);

    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
        const json = await response.json();

        if (json.results.bindings.length > 0) {
            const imageUrl = json.results.bindings[0].image.value;
            photoImg.src = imageUrl;
            photoImg.onload = () => {
                photoImg.style.display = 'block';
                placeholder.style.display = 'none';
            };
        } else {
            placeholder.innerHTML = "<span>❌</span><span>Pas de photo</span>";
        }
    } catch (e) {
        console.error("Erreur Wikidata", e);
        placeholder.innerHTML = "<span>⚠️</span><span>Erreur</span>";
    }
}

function displayDetails(gare) {
    document.getElementById('global-stats').style.display = 'none';
    document.getElementById('details-panel').style.display = 'block';
    document.getElementById('st-name').innerText = gare.nom;
    document.getElementById('st-geo').innerText = `${gare.dept} - ${gare.region}`;

    getWikidataImage(gare.nom);

    const years = Object.keys(gare.history).sort();
    const values = years.map(y => gare.history[y]);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const barColor = '#0088ce';
    const gridColor = isDark ? '#555' : '#ddd';
    const textColor = isDark ? '#ccc' : '#666';

    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (evolutionChartInstance) evolutionChartInstance.destroy();
    evolutionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Voyageurs',
                data: values,
                backgroundColor: barColor,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function closeDetails() {
    document.getElementById('details-panel').style.display = 'none';
    document.getElementById('global-stats').style.display = 'block';

    map.setView([46.603354, 1.888334], 6);
}

initMap();
