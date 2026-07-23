let aogList = [];
let cratesList = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchAOGData();
});

async function fetchAOGData() {
    const loader = document.getElementById('aogLoader');
    const grid = document.getElementById('aogGrid');
    
    if (loader) loader.style.display = 'flex';
    if (grid) grid.innerHTML = '';
    if (grid && loader) grid.appendChild(loader);

    try {
        // AOG listesi ve Sandık listesini paralel çekelim
        const [aogRes, cratesRes] = await Promise.all([
            fetch('/api/aog_list'),
            fetch('/api/crates')
        ]);

        if (!aogRes.ok) throw new Error('AOG Listesi çekilemedi');
        if (!cratesRes.ok) throw new Error('Sandıklar çekilemedi');

        aogList = await aogRes.json();
        cratesList = await cratesRes.json();

        // Eğer AOG listesi hata dönerse (örn excel yoksa)
        if (aogList.error) {
            throw new Error(aogList.error);
        }

        renderAOGGrid(aogList);
    } catch (error) {
        console.error("Hata:", error);
        if (grid) {
            grid.innerHTML = `<div class="error-msg" style="color: red; padding: 20px;">
                <ion-icon name="alert-circle-outline" style="font-size: 24px; vertical-align: middle;"></ion-icon> 
                Veriler yüklenirken bir hata oluştu: ${error.message}
            </div>`;
        }
    }
}

function renderAOGGrid(data) {
    const grid = document.getElementById('aogGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (data.length === 0) {
        grid.innerHTML = '<p style="padding: 20px;">Gösterilecek AOG kaydı bulunamadı.</p>';
        return;
    }

    data.forEach(item => {
        const pn = item['PN'] || item['AOG_PN'] || '';
        if (!pn) return;

        const desc = item['DESC'] || 'Tanımsız Parça';
        const acType = item['A/C TYPE'] || item['A_C'] || 'Bilinmiyor';
        const kutuTipi = item['Kutu Tipi'] || 'Belirtilmemiş';
        const ucaktipiSığar = item['Uçak Tipi'] || 'Belirtilmemiş';

        // Bu PN'ye sahip olan TÜM sandıkları bul
        const matchingCrates = cratesList.filter(c => String(c.pn).trim() === String(pn).trim());

        let cratesHTML = '';
        if (matchingCrates.length > 0) {
            matchingCrates.forEach(crate => {
                let locText = 'Konum Bilinmiyor';
                let mapLink = '';
                
                if (crate.last_seen_lat && crate.last_seen_lng) {
                    locText = crate.last_seen_address ? crate.last_seen_address : `${crate.last_seen_lat.toFixed(4)}, ${crate.last_seen_lng.toFixed(4)}`;
                    mapLink = `href="https://maps.google.com/?q=${crate.last_seen_lat},${crate.last_seen_lng}" target="_blank" style="color: #3b82f6; text-decoration: underline;" title="Haritada Aç"`;
                }

                let statusClass = '';
                let statusText = '';
                let statusColor = '';

                if (crate.status === 'Stokta Var') {
                    statusClass = 'stok-var';
                    statusText = 'Stokta Var';
                    statusColor = '#2ed573';
                } else if (crate.last_seen_lat && crate.last_seen_lng) {
                    // Stokta yok ama konumu var (Tag Aktif)
                    statusClass = 'stok-yok';
                    statusText = 'Stokta Yok (Tag Aktif)';
                    statusColor = '#ffa502'; // Turuncu
                } else {
                    statusClass = 'stok-yok';
                    statusText = 'Stokta Yok';
                    statusColor = '#ff4757'; // Kırmızı
                }

                const locationDisplay = mapLink ? `<a ${mapLink}><ion-icon name="location-outline"></ion-icon> ${locText}</a>` : `<ion-icon name="location-outline"></ion-icon> ${locText}`;

                cratesHTML += `
                    <div class="crate-item ${statusClass}" style="border-left-color: ${statusColor};">
                        <div class="crate-title">
                            <span><ion-icon name="cube-outline"></ion-icon> ${crate.name}</span>
                            <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                        </div>
                        <div class="crate-location" style="background: rgba(0,0,0,0.05);">
                            ${locationDisplay}
                        </div>
                    </div>
                `;
            });
        } else {
            cratesHTML = `<div class="empty-match">Sistemde bu PN (${pn}) için tanımlı bir sandık bulunamadı.</div>`;
        }

        const cardHTML = `
            <div class="aog-card">
                <div class="aog-header">
                    <span class="aog-pn">${pn}</span>
                    <span class="aog-ac">${acType}</span>
                </div>
                <div class="aog-desc">${desc}</div>
                
                <div class="crate-details">
                    <strong>Kutu Tipi:</strong> ${kutuTipi}<br>
                    <strong>Uygun Uçak Tipleri (Kargo):</strong> ${ucaktipiSığar}
                </div>

                <div class="crates-match">
                    <strong style="color: #2f3542;">Eşleşen Sandıklar:</strong>
                    ${cratesHTML}
                </div>
            </div>
        `;
        
        grid.innerHTML += cardHTML;
    });
}

function filterAOG() {
    const searchTerm = document.getElementById('aogSearchInput').value.toLowerCase();
    
    const filteredData = aogList.filter(item => {
        const pn = String(item['PN'] || item['AOG_PN'] || '').toLowerCase();
        const desc = String(item['DESC'] || '').toLowerCase();
        const acType = String(item['A/C TYPE'] || item['A_C'] || '').toLowerCase();
        
        return pn.includes(searchTerm) || desc.includes(searchTerm) || acType.includes(searchTerm);
    });

    renderAOGGrid(filteredData);
}
