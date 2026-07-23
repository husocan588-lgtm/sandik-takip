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

        // Bu PN'ye sahip stoktaki sandıkları bul
        const matchingCrates = cratesList.filter(c => c.pn === pn && c.status === 'Stokta Var');

        // Eğer arama kutusuna yazılmışsa, sadece arananları göster (Arama logic'i ayrı)
        
        let cratesHTML = '';
        if (matchingCrates.length > 0) {
            matchingCrates.forEach(crate => {
                const locText = crate.last_seen_address ? crate.last_seen_address : 
                               (crate.last_seen_lat ? `${crate.last_seen_lat.toFixed(4)}, ${crate.last_seen_lng.toFixed(4)} (Yeşil Alan)` : 'Konum Bilinmiyor');
                
                cratesHTML += `
                    <div class="crate-item stok-var">
                        <div class="crate-title">
                            <span><ion-icon name="cube-outline"></ion-icon> ${crate.name}</span>
                            <span style="color: #2ed573;">Stokta Var</span>
                        </div>
                        <div class="crate-location">
                            <ion-icon name="location-outline"></ion-icon> Mevcut Lokasyon: ${locText}
                        </div>
                    </div>
                `;
            });
        } else {
            cratesHTML = `<div class="empty-match">Stokta bu PN (${pn}) için uygun sandık bulunamadı.</div>`;
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
