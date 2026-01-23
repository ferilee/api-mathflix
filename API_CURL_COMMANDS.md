# Perintah CURL untuk API Micro-Learning Platform

Berikut adalah kumpulan perintah CURL untuk mengakses berbagai endpoint pada API Micro-Learning Platform SMK.

## Base URL
```
http://localhost:3000
```

Catatan: Server API ini dibangun menggunakan Bun dan Hono. Secara default, server akan berjalan di `localhost:3000`, tetapi biasanya juga akan menerima koneksi dari alamat IP lain (misalnya jika diakses dari jaringan lokal). Untuk lingkungan produksi, pastikan untuk mengonfigurasi akses jaringan sesuai kebutuhan keamanan Anda.

## 1. Students Endpoint

### Mendapatkan semua siswa
```bash
curl -X GET http://localhost:3000/students
```

### Mendapatkan siswa berdasarkan ID
```bash
curl -X GET http://localhost:3000/students/{id}
```

### Membuat siswa baru
```bash
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d '{
    "nisn": "1234567890",
    "full_name": "Nama Lengkap Siswa",
    "major": "Jurusan Siswa",
    "grade_level": 10
  }'
```

### Memperbarui data siswa
```bash
curl -X PUT http://localhost:3000/students/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "nisn": "1234567890",
    "full_name": "Nama Lengkap Siswa Terbaru",
    "major": "Jurusan Terbaru",
    "grade_level": 11
  }'
```

### Menghapus siswa
```bash
curl -X DELETE http://localhost:3000/students/{id}
```

### Menambahkan banyak siswa sekaligus
```bash
curl -X POST http://localhost:3000/students/bulk \
  -H "Content-Type: application/json" \
  -d '[
    {
      "nisn": "1234567890",
      "name": "Nama Siswa 1",
      "major": "Jurusan Siswa 1"
    },
    {
      "nisn": "0987654321",
      "name": "Nama Siswa 2",
      "major": "Jurusan Siswa 2"
    }
  ]'
```

## 2. Materials Endpoint

### Mendapatkan semua materi
```bash
curl -X GET http://localhost:3000/materials
```

### Mendapatkan materi berdasarkan ID
```bash
curl -X GET http://localhost:3000/materials/{id}
```

### Membuat materi baru
```bash
curl -X POST http://localhost:3000/materials \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Judul Materi",
    "description": "Deskripsi Materi",
    "content": "Isi konten materi disini...",
    "major_target": "Teknik Informatika",
    "teacher_name": "Nama Guru",
    "is_featured": true
  }'
```

### Memperbarui materi
```bash
curl -X PUT http://localhost:3000/materials/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Judul Materi Terbaru",
    "description": "Deskripsi Materi Terbaru",
    "content": "Isi konten materi terbaru disini..."
  }'
```

### Menghapus materi
```bash
curl -X DELETE http://localhost:3000/materials/{id}
```

### Mendapatkan kuis untuk suatu materi
```bash
curl -X GET http://localhost:3000/materials/{id}/quiz
```

## 3. Quizzes Endpoint

### Mendapatkan semua kuis
```bash
curl -X GET http://localhost:3000/quizzes
```

### Mendapatkan kuis berdasarkan ID
```bash
curl -X GET http://localhost:3000/quizzes/{id}
```

### Membuat kuis baru
```bash
curl -X POST http://localhost:3000/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "material_id": "id_materi_terkait",
    "title": "Judul Kuis",
    "passing_score": 75,
    "style": "normal"
  }'
```

### Menghapus kuis
```bash
curl -X DELETE http://localhost:3000/quizzes/{id}
```

### Menambahkan pertanyaan ke kuis
```bash
curl -X POST http://localhost:3000/quizzes/{id}/questions \
  -H "Content-Type: application/json" \
  -d '[
    {
      "question_text": "Apa ini?",
      "question_type": "multiple_choice",
      "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
      "correct_answer": "Pilihan A"
    }
  ]'
```

### Mengirim jawaban kuis
```bash
curl -X POST http://localhost:3000/submit-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "id_siswa",
    "quiz_id": "id_kuis",
    "answers": [
      {
        "question_id": "id_pertanyaan",
        "user_answer": "Jawaban siswa"
      }
    ]
  }'
```

## 4. Assignments Endpoint

### Membuat tugas baru
```bash
curl -X POST http://localhost:3000/assignments \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Judul Tugas",
    "description": "Deskripsi Tugas",
    "due_date": "2024-12-31T23:59:59Z",
    "target_grade": 10,
    "target_major": "Teknik Informatika",
    "target_students": ["id_siswa1", "id_siswa2"]
  }'
```

### Mendapatkan semua tugas
```bash
curl -X GET http://localhost:3000/assignments
```

### Mendapatkan tugas berdasarkan ID
```bash
curl -X GET http://localhost:3000/assignments/{id}
```

### Mendapatkan tugas untuk siswa tertentu
```bash
curl -X GET http://localhost:3000/assignments/my-assignments \
  -H "X-Student-ID: id_siswa"
```

### Mendapatkan status pengumpulan tugas oleh siswa
```bash
curl -X GET http://localhost:3000/assignments/{id}/status \
  -H "X-Student-ID: id_siswa"
```

### Mengumpulkan tugas
```bash
curl -X POST http://localhost:3000/assignments/{id}/submit \
  -H "X-Student-ID: id_siswa" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://link-submission.com",
    "note": "Catatan tambahan"
  }'
```

### Mendapatkan semua pengumpulan tugas
```bash
curl -X GET http://localhost:3000/assignments/{id}/submissions
```

### Memberikan nilai tugas
```bash
curl -X POST http://localhost:3000/assignments/{id}/grade \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "id_siswa",
    "grade": 85,
    "feedback": "Kerja bagus!"
  }'
```

### Menghapus tugas
```bash
curl -X DELETE http://localhost:3000/assignments/{id}
```

## 5. Endpoint Lainnya

### Leaderboard
```bash
# Mendapatkan leaderboard siswa berdasarkan skor total
curl -X GET http://localhost:3000/leaderboard
```

### Announcements
```bash
# Mendapatkan semua pengumuman (terbaru dulu)
curl -X GET http://localhost:3000/announcements

# Membuat pengumuman baru
curl -X POST http://localhost:3000/announcements \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Judul Pengumuman",
    "content": "Isi pengumuman disini..."
  }'

# Menghapus pengumuman
curl -X DELETE http://localhost:3000/announcements/{id}
```

### Discussions
```bash
# Mendapatkan semua postingan diskusi dengan komentar
curl -X GET http://localhost:3000/discussions

# Membuat postingan baru
curl -X POST http://localhost:3000/discussions \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Isi postingan diskusi",
    "author_id": "id_penulis",
    "author_name": "Nama Penulis",
    "author_role": "student"
  }'

# Mengunci/membuka postingan
curl -X PATCH http://localhost:3000/discussions/{id}/lock \
  -H "Content-Type: application/json" \
  -d '{
    "is_locked": true
  }'

# Menghapus postingan
curl -X DELETE http://localhost:3000/discussions/{id}

# Menambahkan komentar ke postingan
curl -X POST http://localhost:3000/discussions/{id}/comments \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Isi komentar",
    "author_id": "id_penulis",
    "author_name": "Nama Penulis",
    "author_role": "student"
  }'

# Menghapus komentar
curl -X DELETE http://localhost:3000/discussions/comments/{id}

```

### Cohorts
```bash
# Mendapatkan semua kelompok
curl -X GET http://localhost:3000/cohorts

# Membuat kelompok baru
curl -X POST http://localhost:3000/cohorts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nama Kelompok",
    "description": "Deskripsi Kelompok"
  }'

# Menambahkan anggota ke kelompok (ini akan mengganti seluruh anggota)
curl -X POST http://localhost:3000/cohorts/{id}/members \
  -H "Content-Type: application/json" \
  -d '{
    "student_ids": ["id_siswa1", "id_siswa2"]
  }'

# Menghapus kelompok
curl -X DELETE http://localhost:3000/cohorts/{id}
```

### Reflections
```bash
# Membuat refleksi baru
curl -X POST http://localhost:3000/reflections \
  -H "X-Student-ID: id_siswa" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Isi refleksi",
    "mood": "happy",
    "topic": "Topik pelajaran"
  }'

# Mendapatkan refleksi milik saya
curl -X GET http://localhost:3000/reflections/my-reflections \
  -H "X-Student-ID: id_siswa"

# Mendapatkan semua refleksi (untuk admin)
curl -X GET http://localhost:3000/reflections
# Atau untuk refleksi siswa tertentu:
curl -X GET "http://localhost:3000/reflections?student_id=id_siswa"
```

### Analytics
```bash
# Mendapatkan data analitik keseluruhan
curl -X GET http://localhost:3000/analytics
```

### Badges
```bash
# Mendapatkan lencana milik saya
curl -X GET http://localhost:3000/badges/my-badges \
  -H "X-Student-ID: id_siswa"

# Memeriksa apakah ada lencana baru yang bisa diraih
curl -X POST http://localhost:3000/badges/check \
  -H "X-Student-ID: id_siswa"
```

### Grading
```bash
# Mendapatkan data penilaian untuk semua siswa
curl -X GET http://localhost:3000/grading
```
