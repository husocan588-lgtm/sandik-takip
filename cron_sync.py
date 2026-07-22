import time
from app import sync_hbbk_data
import os

print("Arka plan senkronizasyon servisi başlatıldı (3 dakikada bir)...")
while True:
    try:
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Konumlar API'den güncelleniyor...")
        sync_hbbk_data()
        print("Güncelleme tamamlandı. 3 dakika bekleniyor...")
    except Exception as e:
        print(f"Hata oluştu: {e}")
    time.sleep(180)  # 180 saniye = 3 dakika
