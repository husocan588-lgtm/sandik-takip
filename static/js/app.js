let cratesData = [];
let catalogData = [];
let map;
let markersLayer;
let crateMarkers = {};

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchCrates();
    fetchCatalog();
    
    // Her 60 saniyede bir tabloyu yenile
    setInterval(() => {
        fetchCrates();
    }, 60000);
});

let currentRoute = null;
let routeMarkers = [];

async function drawRouteForCrate(publicKey) {
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = [];
    
    try {
        const res = await fetch(`/api/crates/${publicKey}/route`);
        const json = await res.json();
        
        if (json.ok && json.data) {
            const latlngs = json.data.filter(d => d.latitude && d.longitude).map(d => [d.latitude, d.longitude]);
            if (latlngs.length > 1) {
                currentRoute = L.polyline(latlngs, {color: '#e74c3c', weight: 4, dashArray: '5, 10'}).addTo(map);
                map.fitBounds(currentRoute.getBounds());
                
                // 15. adımı (veya dizideki en eski adımı) belirgin göster
                const oldestStep = latlngs[latlngs.length - 1];
                const oldestTime = json.data[json.data.length - 1].collectedAt;
                const timeStr = oldestTime ? new Date(oldestTime).toLocaleString('tr-TR') : '';
                
                const startMarker = L.circleMarker(oldestStep, {
                    color: '#f39c12',
                    fillColor: '#f1c40f',
                    fillOpacity: 1,
                    radius: 12,
                    weight: 3
                }).bindPopup(`<b>Rota Başlangıcı</b><br>İlk Adım (Geçmiş 15.)<br>${timeStr}`).addTo(map);
                
                routeMarkers.push(startMarker);
            } else {
                alert('Yeterli geçmiş rota bilgisi bulunamadı.');
            }
        } else {
            alert('Rota verisi çekilemedi.');
        }
    } catch (err) {
        console.error(err);
        alert('Rota verisi alınırken hata oluştu.');
    }
}

// --- Map Initialization ---

function initMap() {
    // Merkezi Türkiye/İstanbul civarı başlatalım (ilk açılış için)
    map = L.map('map').setView([40.8915, 29.3058], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    // Geofence verilerini çek ve çiz
    fetch('/api/geofence')
        .then(res => res.json())
        .then(polygons => {
            if (polygons && polygons.length > 0) {
                polygons.forEach(poly => {
                    const latlngs = poly.map(p => [p.lat, p.lng]);
                    L.polygon(latlngs, {
                        color: '#2ecc71',
                        fillColor: '#2ecc71',
                        fillOpacity: 0.15,
                        weight: 2
                    }).addTo(map);
                });
                // Harita odak noktasını ilk poligona göre ayarla
                if (polygons[0].length > 0) {
                    map.setView([polygons[0][0].lat, polygons[0][0].lng], 16);
                }
            }
        })
        .catch(err => console.error('Geofence yüklenemedi:', err));
}

// --- API Calls ---

async function fetchCrates() {
    const grid = document.getElementById('cratesGrid');
    grid.innerHTML = `
        <div class="loader-container" id="loader">
            <div class="spinner"></div>
            <p>Veriler Yükleniyor...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/crates?t=' + new Date().getTime());
        if (!response.ok) throw new Error('Network response was not ok');
        cratesData = await response.json();
        renderCrates();
    } catch (error) {
        console.error('Error fetching crates:', error);
        grid.innerHTML = `<div class="error-badge">Veriler alınırken bir hata oluştu.</div>`;
    }
}

async function fetchCatalog() {
    try {
        const response = await fetch('/api/catalog');
        if (response.ok) {
            catalogData = await response.json();
        }
    } catch (error) {
        console.error('Error fetching catalog:', error);
    }
}

async function saveCrate() {
    const id = document.getElementById('crateId').value;
    const isEdit = !!id;
    
    const payload = {
        name: document.getElementById('crateName').value,
        tag_mac: document.getElementById('crateMac').value,
        public_key: document.getElementById('cratePublicKey').value,
        pn: document.getElementById('cratePn').value,
        width: parseFloat(document.getElementById('crateWidth').value) || null,
        length: parseFloat(document.getElementById('crateLength').value) || null,
        height: parseFloat(document.getElementById('crateHeight').value) || null,
    };

    if (!payload.name || !payload.tag_mac) {
        alert("Sandık Adı ve MAC Adresi zorunludur!");
        return;
    }

    const url = isEdit ? `/api/crates/${id}` : `/api/crates`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
            closeModal('crateModal');
            fetchCrates();
        } else {
            alert(data.error || "Bir hata oluştu");
        }
    } catch (error) {
        alert("Bağlantı hatası");
    }
}

async function deleteCrate() {
    const id = document.getElementById('crateId').value;
    if (!id) return;

    if (!confirm("Bu sandığı silmek istediğinize emin misiniz?")) return;

    try {
        const response = await fetch(`/api/crates/${id}`, { method: 'DELETE' });
        if (response.ok) {
            closeModal('crateModal');
            fetchCrates();
        } else {
            const data = await response.json();
            alert(data.error || "Silinemedi");
        }
    } catch (error) {
        alert("Bağlantı hatası");
    }
}

// --- Rendering Logic ---

function filterCrates() {
    renderCrates();
}

function renderCrates() {
    const grid = document.getElementById('cratesGrid');
    
    // Filters
    const query = document.getElementById('searchInput').value.toLowerCase();
    const reqW = parseFloat(document.getElementById('reqWidth').value) || 0;
    const reqL = parseFloat(document.getElementById('reqLength').value) || 0;
    const reqH = parseFloat(document.getElementById('reqHeight').value) || 0;
    const stockOnly = document.getElementById('stockFilter').checked;

    const filtered = cratesData.filter(c => {
        const matchQuery = c.name.toLowerCase().includes(query) || c.tag_mac.toLowerCase().includes(query);
        const matchW = (c.width || 0) >= reqW;
        const matchL = (c.length || 0) >= reqL;
        const matchH = (c.height || 0) >= reqH;
        const matchStock = stockOnly ? c.status === 'Stokta Var' : true;

        return matchQuery && matchW && matchL && matchH && matchStock;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="loader-container"><p>Kriterlere uygun sandık bulunamadı.</p></div>`;
        updateMapMarkers([]);
        return;
    }

    // Haritadaki markerları güncelle
    updateMapMarkers(filtered);

    grid.innerHTML = filtered.map(crate => {
        const isApiSynced = !!crate.public_key;
        let badgeClass = 'status-red';
        if (isApiSynced) badgeClass = 'status-purple';
        else if (crate.status === 'Stokta Var') badgeClass = 'status-green';

        const lastSeen = crate.last_seen_time ? new Date(crate.last_seen_time).toLocaleString('tr-TR') : 'Bilinmiyor';

        return `
        <div class="crate-card">
            <div class="card-header">
                <div class="card-title">
                    <h3>${crate.name}</h3>
                    <p>MAC: ${crate.tag_mac}</p>
                </div>
                <div class="status-badge ${badgeClass}">
                    ${isApiSynced ? '<ion-icon name="cube"></ion-icon>' : ''}
                    ${crate.status}
                </div>
            </div>

            <div class="dims-row">
                <div class="dim-item">
                    <span>En</span>
                    <strong>${crate.width || '-'} cm</strong>
                </div>
                <div class="dim-item">
                    <span>Boy</span>
                    <strong>${crate.length || '-'} cm</strong>
                </div>
                <div class="dim-item">
                    <span>Yükseklik</span>
                    <strong>${crate.height || '-'} cm</strong>
                </div>
            </div>

            <div class="card-footer">
                <div class="last-seen">
                    <p>Son: ${lastSeen}</p>
                    <p class="address">${crate.last_seen_address || ''}</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    ${(crate.last_seen_lat && crate.last_seen_lng) ? `
                    <button class="btn-success" onclick="focusOnMap('${crate.tag_mac}')" style="padding: 10px; min-width: 40px;" title="Haritada Gör">
                        <ion-icon name="location-outline" style="font-size: 18px; margin: 0;"></ion-icon>
                    </button>
                    ` : ''}
                    <button class="btn-info" onclick='openEditModal(${JSON.stringify(crate).replace(/'/g, "&#39;")})'>
                        <ion-icon name="create-outline"></ion-icon> Düzenle
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function updateMapMarkers(filteredCrates) {
    if (!markersLayer) return;
    markersLayer.clearLayers();
    crateMarkers = {};
    
    filteredCrates.forEach(crate => {
        if (crate.last_seen_lat && crate.last_seen_lng) {
            const isApiSynced = !!crate.public_key;
            let markerColor = crate.status === 'Stokta Var' ? '#2ecc71' : (isApiSynced ? '#9b59b6' : '#e74c3c');
            
            const marker = L.circleMarker([crate.last_seen_lat, crate.last_seen_lng], {
                color: markerColor,
                fillColor: markerColor,
                fillOpacity: 0.8,
                radius: 8,
                weight: 2
            }).addTo(markersLayer);

            let batteryText = crate.battery !== undefined && crate.battery !== null ? `<br>🔋 Batarya: %${crate.battery}` : '';
            let routeBtn = crate.public_key ? `<br><br><button onclick="drawRouteForCrate('${crate.public_key}')" style="background:#e74c3c;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Geçmiş Rota</button>` : '';
            
            const isStock = crate.status === 'Stokta Var';
            const timeStr = crate.last_seen_time ? new Date(crate.last_seen_time).toLocaleString('tr-TR') : 'Bilinmiyor';

            const popupContent = `
                <div style="font-family: sans-serif; min-width: 150px;">
                    <h4 style="margin:0 0 5px 0; color: #2c3e50;">${crate.name}</h4>
                    <p style="margin:0; font-size: 13px;">
                        <strong>Durum:</strong> <span style="color:${isStock ? '#2ecc71' : '#e74c3c'}">${crate.status}</span><br>
                        <strong>Son Görülme:</strong> ${timeStr}
                        ${batteryText}
                        ${routeBtn}
                    </p>
                </div>
            `;
            marker.bindPopup(popupContent);
            crateMarkers[crate.tag_mac] = marker;
        }
    });
}



function focusOnMap(mac) {
    if (!map || !crateMarkers[mac]) return;
    
    // Haritaya doğru kaydır
    document.querySelector('.map-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const marker = crateMarkers[mac];
    const latlng = marker.getLatLng();
    
    // Haritayı yakınlaştır ve ortala
    map.flyTo(latlng, 18, { duration: 1.5 });
    
    // Uçuş bitince popup aç
    setTimeout(() => {
        marker.openPopup();
    }, 1500);
}

// --- Modals ---

function openModal(type) {
    if (type === 'createModal') {
        document.getElementById('modalTitle').innerText = 'Yeni Sandık Ekle';
        document.getElementById('crateForm').reset();
        document.getElementById('crateId').value = '';
        document.getElementById('btnDelete').style.display = 'none';
        document.getElementById('crateModal').classList.add('active');
    }
}

function openEditModal(crate) {
    document.getElementById('modalTitle').innerText = 'Sandık Düzenle';
    document.getElementById('crateId').value = crate.id;
    document.getElementById('cratePn').value = crate.pn || '';
    document.getElementById('crateName').value = crate.name || '';
    document.getElementById('crateMac').value = crate.tag_mac || '';
    document.getElementById('cratePublicKey').value = crate.public_key || '';
    document.getElementById('crateWidth').value = crate.width || '';
    document.getElementById('crateLength').value = crate.length || '';
    document.getElementById('crateHeight').value = crate.height || '';
    
    document.getElementById('btnDelete').style.display = 'block';
    document.getElementById('crateModal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// --- Catalog ---

function openCatalogModal() {
    document.getElementById('catalogModal').classList.add('active');
    filterCatalog();
}

function filterCatalog() {
    const query = document.getElementById('catalogSearch').value.toLowerCase();
    const list = document.getElementById('catalogList');
    
    const filtered = catalogData.filter(c => 
        c.pn.toLowerCase().includes(query) || 
        (c.description && c.description.toLowerCase().includes(query))
    );

    list.innerHTML = filtered.map(c => `
        <div class="catalog-item" onclick="selectCatalogItem('${c.pn}', '${c.description || ''}', ${c.width || ''}, ${c.length || ''}, ${c.height || ''})">
            <strong>${c.pn}</strong>
            <span>${c.description || ''}</span>
        </div>
    `).join('');
}

function selectCatalogItem(pn, desc, w, l, h) {
    document.getElementById('cratePn').value = pn;
    document.getElementById('crateName').value = desc || pn;
    document.getElementById('crateWidth').value = w || '';
    document.getElementById('crateLength').value = l || '';
    document.getElementById('crateHeight').value = h || '';
    closeModal('catalogModal');
}
