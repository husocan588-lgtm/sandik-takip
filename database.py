import psycopg2
from psycopg2.extras import RealDictCursor
import json
import os

# Supabase veya Render için veritabanı bağlantı adresi
DB_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    if not DB_URL:
        raise ValueError("DATABASE_URL ortam değişkeni bulunamadı. Lütfen Supabase veritabanı bağlantı adresinizi ayarlayın.")
    conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
    return conn

def init_db():
    if not DB_URL:
        print("DATABASE_URL eksik, veritabanı başlatılamadı.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Sandıklar Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crates (
            id SERIAL PRIMARY KEY,
            tag_mac TEXT UNIQUE NOT NULL,
            public_key TEXT,
            pn TEXT,
            name TEXT NOT NULL,
            width REAL,
            height REAL,
            length REAL,
            status TEXT DEFAULT 'Stokta Yok',
            last_seen_lat REAL,
            last_seen_lng REAL,
            last_seen_address TEXT,
            last_seen_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            battery INTEGER
        )
    ''')
    
    # Parça Kataloğu Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS parts_catalog (
            id SERIAL PRIMARY KEY,
            pn TEXT UNIQUE NOT NULL,
            description TEXT,
            width REAL,
            length REAL,
            height REAL
        )
    ''')
    
    # Ayarlar Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # Kullanıcılar Tablosu (Web Girişi İçin)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    
    # Varsayılan yönetici hesabı oluştur (admin / admin123)
    from werkzeug.security import generate_password_hash
    cursor.execute("SELECT * FROM users WHERE username = 'admin'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
            ('admin', generate_password_hash('admin123'))
        )
    
    # Varsayılan Geofence Poligonları (Yeşil Alanlar)
    default_polygons = [
        # 1. Yeşil Alan
        [
            { "lat": 40.891333, "lng": 29.305972 },
            { "lat": 40.891416, "lng": 29.306166 },
            { "lat": 40.891749, "lng": 29.305722 },
            { "lat": 40.891805, "lng": 29.305888 }
        ],
        # 2. Yeşil Alan
        [
            { "lat": 40.891611, "lng": 29.305805 },
            { "lat": 40.891805, "lng": 29.305694 },
            { "lat": 40.891666, "lng": 29.305277 },
            { "lat": 40.891500, "lng": 29.305361 }
        ]
    ]
    cursor.execute('''
        INSERT INTO settings (key, value) 
        VALUES ('geofence_polygons', %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    ''', (json.dumps(default_polygons),))
    
    conn.commit()
    conn.close()
    print("PostgreSQL veritabanı bağlandı ve tablolar başlatıldı.")

def is_point_in_polygon(point, vs):
    x = point.get('lat', 0)
    y = point.get('lng', 0)
    inside = False
    
    j = len(vs) - 1
    for i in range(len(vs)):
        xi = vs[i].get('lat', 0)
        yi = vs[i].get('lng', 0)
        xj = vs[j].get('lat', 0)
        yj = vs[j].get('lng', 0)
        
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
        if intersect:
            inside = not inside
        j = i
        
    return inside

# Uygulama başlarken DB'yi başlatmaya çalış (Eğer DATABASE_URL tanımlıysa)
try:
    init_db()
except Exception as e:
    print(f"Veritabanı başlatılamadı: {e}")
