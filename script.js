// STEP 1: Initialize Map
const map = L.map('map').setView([23.5937, 80.9629], 5);

// STEP 2: Tile Layers
const baseMaps = {
  "Carto Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'),
  "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
  "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
};
baseMaps["Carto Light"].addTo(map);
L.control.layers(baseMaps).addTo(map);

// STEP 3: Globals
let allMarkers = [];
let allEvents = [];
const loadingDiv = document.getElementById("loading");
let timelineInterval = null;
let isPlaying = false;
let backgroundMusic = new Audio('assets/music/history_bg.mp3');
backgroundMusic.loop = true;

// STEP 4: Custom Icons
const icons = {
  battle: L.divIcon({ className: 'marker-icon battle-icon', html: "⚔️", iconSize: [25, 25] }),
  movement: L.divIcon({ className: 'marker-icon movement-icon', html: "✊", iconSize: [25, 25] }),
  law: L.divIcon({ className: 'marker-icon law-icon', html: "📜", iconSize: [25, 25] }),
  treaty: L.divIcon({ className: 'marker-icon treaty-icon', html: "🕊️", iconSize: [25, 25] }),
  event: L.divIcon({ className: 'marker-icon event-icon', html: "📌", iconSize: [25, 25] })
};

// STEP 5: Load Events
fetch('data/events.json')
  .then(res => res.json())
  .then(data => {
    allEvents = data;
    loadMarkers(allEvents);
    loadingDiv.style.display = "none";
  })
  .catch(err => {
    console.error("Error loading data:", err);
    loadingDiv.innerText = "Failed to load data.";
  });

// STEP 6: Marker Functions
function loadMarkers(data) {
  clearMarkers();
  data.forEach(event => {
    const icon = icons[event.type] || icons.event;
    const marker = L.marker([event.lat, event.lng], { icon });

    const popupHTML = `
      <div>
        <h3>${event.name}</h3>
        <p><strong>Year:</strong> ${event.year}</p>
        <p><strong>Type:</strong> ${event.type}</p>
        <p><strong>Parties:</strong> ${event.parties}</p>
        <p><strong>Impact:</strong> ${event.impact}</p>
        <p><strong>Fact:</strong> ${event.facts?.[0] || "N/A"}</p>
        <a href="${event.wiki}" target="_blank">🔗 Read on Wikipedia</a>
      </div>
    `;
    marker.bindPopup(popupHTML);
    marker.addTo(map);
    allMarkers.push({ marker, event });
  });
}

function clearMarkers() {
  allMarkers.forEach(obj => map.removeLayer(obj.marker));
  allMarkers = [];
}

// STEP 7: Filters + Auto Popup
function applyFilters(triggeredBySuggestion = false) {
  const search = document.getElementById('search').value.toLowerCase();
  const dynasty = document.getElementById('dynasty').value;
  const type = document.getElementById('eventType').value;
  const yearLimit = parseInt(document.getElementById('timeline').value);

  const filtered = allEvents.filter(event => {
    const matchSearch = event.name.toLowerCase().includes(search) || event.parties.toLowerCase().includes(search);
    const matchDynasty = dynasty === 'all' || event.dynasty === dynasty;
    const matchType = type === 'all' || event.type === type;
    const matchYear = event.year <= yearLimit;
    return matchSearch && matchDynasty && matchType && matchYear;
  });

  loadMarkers(filtered);
  const exactMatch = allMarkers.find(obj => obj.event.name.toLowerCase() === search);
  if (exactMatch) {
    map.setView([exactMatch.event.lat, exactMatch.event.lng], 7);
    exactMatch.marker.openPopup();
    document.getElementById("timeline").value = exactMatch.event.year;
    document.getElementById("timelineValue").textContent = `Year: ${exactMatch.event.year}`;
  }
  updateSuggestions(search);
  toggleClearButton();
}

function updateSuggestions(input) {
  const suggestionBox = document.getElementById('suggestions');
  suggestionBox.innerHTML = "";
  if (!input || input.length < 2) return;
  const matches = allEvents.filter(e => e.name.toLowerCase().includes(input)).slice(0, 5);
  matches.forEach(match => {
    const li = document.createElement("li");
    li.textContent = match.name;
    li.onclick = () => {
      document.getElementById('search').value = match.name;
      applyFilters(true);
      suggestionBox.innerHTML = "";
    };
    suggestionBox.appendChild(li);
  });
}

function toggleClearButton() {
  const clearBtn = document.getElementById('clearSearch');
  const searchVal = document.getElementById('search').value.trim();
  clearBtn.style.display = searchVal !== "" ? "block" : "none";
}

// Filter listeners
['search', 'dynasty', 'eventType'].forEach(id => {
  document.getElementById(id).addEventListener('input', applyFilters);
});

document.getElementById('timeline').addEventListener('input', function () {
  document.getElementById('timelineValue').textContent = `Year: ${this.value}`;
  applyFilters();
});

document.getElementById('search').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') applyFilters(true);
});

document.getElementById('search').addEventListener('input', toggleClearButton);

document.getElementById('clearSearch').addEventListener('click', () => {
  document.getElementById('search').value = "";
  document.getElementById('suggestions').innerHTML = "";
  applyFilters();
  toggleClearButton();
});

// STEP 8: Dark Mode Toggle
document.getElementById('darkModeToggle').addEventListener('change', () => {
  document.body.classList.toggle('dark-mode');
});

// STEP 9: GPS Button
document.getElementById('gpsBtn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const coords = pos.coords;
      map.setView([coords.latitude, coords.longitude], 8);
    });
  }
});

// STEP 10: Load Map View from URL (optional sharing support)
const params = new URLSearchParams(window.location.search);
const lat = parseFloat(params.get("lat"));
const lng = parseFloat(params.get("lng"));
const z = parseInt(params.get("z"));
if (!isNaN(lat) && !isNaN(lng) && !isNaN(z)) {
  map.setView([lat, lng], z);
}

// STEP 11: Timeline Play/Pause with Background Music
const playBtn = document.getElementById("playTimeline");
const pauseBtn = document.getElementById("pauseTimeline");
let currentYear = 300;

playBtn.addEventListener("click", () => {
  if (isPlaying) return;
  isPlaying = true;
  playBtn.style.display = "none";
  pauseBtn.style.display = "inline-block";
  backgroundMusic.play();
  timelineInterval = setInterval(() => {
    if (currentYear > 1950) {
      clearInterval(timelineInterval);
      isPlaying = false;
      playBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
      backgroundMusic.pause();
      return;
    }
    document.getElementById("timeline").value = currentYear;
    document.getElementById("timelineValue").textContent = `Year: ${currentYear}`;
    applyFilters();
    currentYear += 10;
  }, 1000);
});

pauseBtn.addEventListener("click", () => {
  clearInterval(timelineInterval);
  isPlaying = false;
  playBtn.style.display = "inline-block";
  pauseBtn.style.display = "none";
  backgroundMusic.pause();
});