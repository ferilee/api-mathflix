# SQLite Database Mounting di Docker

## 📋 Pilihan Mounting

### 1. **Named Volume (Recommended untuk Production)** ✅

File: `docker-compose.yml`

```yaml
volumes:
  - mathflix-data:/app/data
```

**Kelebihan:**
- ✅ Dikelola oleh Docker
- ✅ Lebih aman dan portable
- ✅ Backup lebih mudah dengan `docker volume`
- ✅ Performa lebih baik di Windows/Mac

**Cara pakai:**
```bash
# Start
docker-compose up -d

# Backup database
docker run --rm -v mathflix-data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .

# Restore database
docker run --rm -v mathflix-data:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /data

# Lihat lokasi volume
docker volume inspect mathflix-data
```

---

### 2. **Bind Mount ke Direktori (Untuk Development)** 🔧

File: `docker-compose.dev.yml`

```yaml
volumes:
  - ./data:/app/data
```

**Kelebihan:**
- ✅ Mudah diakses dari host (bisa buka dengan SQLite browser)
- ✅ Mudah di-backup (tinggal copy folder)
- ✅ Bisa di-commit ke git (jika diperlukan)

**Cara pakai:**
```bash
# Buat folder data dulu
mkdir -p data

# Start dengan file dev
docker-compose -f docker-compose.dev.yml up -d

# Database akan ada di ./data/sqlite.db
```

---

### 3. **Bind Mount ke File (TIDAK DISARANKAN)** ❌

```yaml
volumes:
  - ./sqlite.db:/app/sqlite.db
```

**Masalah:**
- ❌ File harus sudah ada sebelum container start
- ❌ Bisa corrupt jika container restart saat write
- ❌ Permission issues di Linux
- ❌ Tidak portable antar OS

---

## 🚀 Rekomendasi

**Production:** Gunakan `docker-compose.yml` (named volume)
```bash
docker-compose up -d
```

**Development:** Gunakan `docker-compose.dev.yml` (bind mount ke direktori)
```bash
docker-compose -f docker-compose.dev.yml up -d
```

---

## 📦 Backup & Restore

### Named Volume
```bash
# Backup
docker run --rm \
  -v mathflix-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Restore
docker run --rm \
  -v mathflix-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/backup-YYYYMMDD-HHMMSS.tar.gz -C /data
```

### Bind Mount (Development)
```bash
# Backup
cp -r data data-backup-$(date +%Y%m%d-%H%M%S)

# Restore
cp -r data-backup-YYYYMMDD-HHMMSS data
```

---

## 🔍 Troubleshooting

### Database tidak persist setelah restart?
- Pastikan menggunakan named volume atau bind mount
- Cek dengan: `docker volume ls`

### Permission denied?
```bash
# Untuk bind mount, set permission
chmod -R 777 data/
```

### Ingin lihat isi database?
```bash
# Untuk named volume
docker run --rm -it \
  -v mathflix-data:/data \
  alpine sh -c "ls -la /data"

# Untuk bind mount
ls -la data/
```
