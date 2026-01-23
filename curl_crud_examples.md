# Contoh Penggunaan API dengan cURL

Berikut adalah contoh perintah cURL untuk operasi CRUD (Create, Read, Update, Delete) pada sebuah API.

## 1. CREATE (POST)
Menambahkan data baru ke server:

```bash
curl -X POST \
  http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "age": 30
  }'
```

## 2. READ (GET)
Mengambil semua data dari server:

```bash
curl -X GET http://localhost:3000/api/users
```

Mengambil data tunggal berdasarkan ID:

```bash
curl -X GET http://localhost:3000/api/users/1
```

## 3. UPDATE (PUT/PATCH)
Memperbarui data secara keseluruhan (PUT):

```bash
curl -X PUT \
  http://localhost:3000/api/users/1 \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John Doe Jr.",
    "email": "john.jr@example.com",
    "age": 31
  }'
```

Memperbarui sebagian data (PATCH):

```bash
curl -X PATCH \
  http://localhost:3000/api/users/1 \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John Doe Jr."
  }'
```

## 4. DELETE
Menghapus data dari server:

```bash
curl -X DELETE http://localhost:3000/api/users/1
```

## Parameter Tambahan yang Sering Digunakan

### Menambahkan Header Authorization
```bash
curl -X GET \
  http://localhost:3000/api/users \
  -H 'Authorization: Bearer token_anda_disini'
```

### Mengirim data dalam format form
```bash
curl -X POST \
  http://localhost:3000/api/users \
  -F 'name=John Doe' \
  -F 'email=john.doe@example.com' \
  -F 'age=30'
```

### Menyertakan parameter query
```bash
curl -X GET 'http://localhost:3000/api/users?page=1&limit=10&sort=name'
```

## Catatan Penting

- Pastikan untuk mengganti URL (`http://localhost:3000/api/users`) sesuai dengan endpoint API yang digunakan
- Ganti header dan body data sesuai kebutuhan aplikasi Anda
- Gunakan tanda kutip yang benar saat menulis JSON di parameter `-d`
- Untuk pengujian API lokal, pastikan server sudah berjalan terlebih dahulu