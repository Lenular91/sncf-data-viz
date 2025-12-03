let map, markersCluster;
let processedData = {};
let evolutionChartInstance = null;
let regionChartInstance = null;

// --- ETAT INITIAL ---
let USE_LIVE_SPARQL = false;
const SPARQL_ENDPOINT = "http://localhost:7200/repositories/Gares_Frequentation_RCW";

function initMap() {
    map = L.map('map').setView([46.603354, 1.888334], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' }).addTo(map);
    markersCluster = L.markerClusterGroup({ maxClusterRadius: 50 });
    map.addLayer(markersCluster);

    loadDashboardData();
}

function toggleMode() {
    USE_LIVE_SPARQL = !USE_LIVE_SPARQL;
    const btn = document.getElementById('modeBtn');
    if (USE_LIVE_SPARQL) {
        btn.innerText = "⚡ SPARQL Live"; btn.className = "switch-btn btn-live";
    } else {
        btn.innerText = "📂 Fichier JSON"; btn.className = "switch-btn btn-json";
    }
    loadDashboardData();
}

async function loadDashboardData() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    loader.innerText = USE_LIVE_SPARQL ? "Connexion à GraphDB..." : "Lecture gares.json...";

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
        renderMap();
        renderStats();
        renderTop5();
        document.getElementById('total-stations').innerText = Object.keys(processedData).length;

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
    const timeoutId = setTimeout(() => controller.abort(), 5000);
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

function renderMap() {
    markersCluster.clearLayers();
    Object.values(processedData).forEach(gare => {
        const marker = L.marker([gare.lat, gare.long]);
        marker.bindPopup(`<b>${gare.nom}</b><br>${gare.region}`);
        marker.on('click', () => displayDetails(gare));
        markersCluster.addLayer(marker);
    });
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
    if (regionChartInstance) regionChartInstance.destroy();
    regionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedRegions.map(x => x[0]),
            datasets: [{ data: sortedRegions.map(x => x[1]), backgroundColor: colors, borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderTop5() {
    const sortedStations = Object.values(processedData)
        .sort((a, b) => (b.history['2023'] || 0) - (a.history['2023'] || 0))
        .slice(0, 5);
    const list = document.getElementById('top-stations-list');
    list.innerHTML = "";
    sortedStations.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${s.nom}</span> <span class="count">${(s.history['2023'] || 0).toLocaleString()}</span>`;
        li.onclick = () => { map.setView([s.lat, s.long], 14); displayDetails(s); };
        list.appendChild(li);
    });
}

// --- NOUVELLE FONCTION : RECUPERER IMAGE WIKIDATA ---
async function getWikidataImage(stationName) {
    const photoImg = document.getElementById('st-photo');
    const placeholder = document.getElementById('photo-placeholder');

    // Reset
    photoImg.style.display = 'none';
    placeholder.style.display = 'block';
    placeholder.innerText = "Recherche Wikidata...";

    // On cherche l'image (P18) d'une entité qui a le label "Nom de la gare"
    // On ajoute "Gare de" si ce n'est pas présent pour aider la recherche, ou on cherche large
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
            placeholder.innerText = "Pas de photo disponible";
        }
    } catch (e) {
        console.error("Erreur Wikidata", e);
        placeholder.innerText = "Erreur chargement photo";
    }
}

function displayDetails(gare) {
    document.getElementById('global-stats').style.display = 'none';
    document.getElementById('details-panel').style.display = 'block';
    document.getElementById('st-name').innerText = gare.nom;
    document.getElementById('st-geo').innerText = `${gare.dept} - ${gare.region}`;

    // APPEL DE LA FONCTION IMAGE
    getWikidataImage(gare.nom);

    const years = Object.keys(gare.history).sort();
    const values = years.map(y => gare.history[y]);

    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (evolutionChartInstance) evolutionChartInstance.destroy();
    evolutionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: years, datasets: [{ label: 'Voyageurs', data: values, backgroundColor: '#0088ce' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function closeDetails() {
    document.getElementById('details-panel').style.display = 'none';
    document.getElementById('global-stats').style.display = 'block';
    map.setView([46.603354, 1.888334], 6);
}

function filterStations() {
    const input = document.getElementById('search').value.toLowerCase();
    if (input.length < 3) return;
    const found = Object.values(processedData).find(s => s.nom.toLowerCase().includes(input));
    if (found) { map.setView([found.lat, found.long], 14); displayDetails(found); }
}

initMap();
