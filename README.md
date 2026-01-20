# SMK Micro-Learning Platform API

A RESTful API for a vocational school (SMK) micro-learning platform built with Bun, Hono, Drizzle ORM, and SQLite.

## Tech Stack
- **Runtime:** Bun
- **Framework:** Hono
- **Database:** SQLite
- **ORM:** Drizzle ORM
- **Validation:** Zod

## Getting Started

### Installation
```bash
bun install
```

### Running the Server
```bash
bun run src/index.ts
```
The server runs on `http://localhost:3000`.

## Terminal Usage Guide (cURL Examples)

You can manage the platform directly from your terminal using `curl`.

### 1. Students (Siswa)

#### Get All Students
```bash
curl http://localhost:3000/students
```

#### Create Student
```bash
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d '{
    "nisn": "12345",
    "full_name": "Budi Santoso",
    "major": "TKJ",
    "grade_level": 10
  }'
```

#### Delete Student
Replace `:id` with the actual Student ID (e.g., `33d917a3...`):
```bash
curl -X DELETE http://localhost:3000/students/:id
```

### 2. Materials (Materi)

#### Get All Materials
```bash
curl http://localhost:3000/materials
```

#### Create Material
```bash
curl -X POST http://localhost:3000/materials \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dasar Teknik Jaringan",
    "content": "Pengenalan OSI Layer dan TCP/IP...",
    "major_target": "TKJ"
  }'
```
*Note: Copy the `id` from the response to use in Quizzes.*

#### Delete Material
```bash
curl -X DELETE http://localhost:3000/materials/:id
```

### 3. Quizzes (Kuis)

#### Create Quiz Information
Link a quiz to a material ID (replace `MATERIAL_ID_HERE`):
```bash
curl -X POST http://localhost:3000/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "material_id": "MATERIAL_ID_HERE",
    "title": "Kuis Jaringan Dasar",
    "passing_score": 75
  }'
```

#### Add Questions to Quiz
Relace `QUIZ_ID_HERE` with the quiz ID from the previous step:
```bash
curl -X POST http://localhost:3000/quizzes/QUIZ_ID_HERE/questions \
  -H "Content-Type: application/json" \
  -d '[
    {
      "question_text": "Kepanjangan dari LAN adalah?",
      "question_type": "multiple_choice",
      "options": ["Local Area Network", "Long Area Network"],
      "correct_answer": "Local Area Network"
    }
  ]'
```

#### Submit Quiz (Auto-Grading)
```bash
curl -X POST http://localhost:3000/quizzes/submit-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "STUDENT_ID_HERE",
    "quiz_id": "QUIZ_ID_HERE",
    "answers": [
      { "question_id": "QUESTION_ID_HERE", "user_answer": "Local Area Network" }
    ]
  }'
```

```

## Docker Deployment

### Using Docker Compose (Recommended)

#### Production (Named Volume)
```bash
# Pull and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

#### Development (Bind Mount)
```bash
# Create data directory
mkdir -p data

# Start with dev compose file
docker-compose -f docker-compose.dev.yml up -d

# Database will be at ./data/sqlite.db
```

### Manual Docker Run
```bash
# Pull image from GHCR
docker pull ghcr.io/ferilee/api-mathflix:latest

# Run with named volume
docker run -d \
  --name api-mathflix \
  -p 3000:3000 \
  -e DB_PATH=/app/data/sqlite.db \
  -v mathflix-data:/app/data \
  ghcr.io/ferilee/api-mathflix:latest
```

### GitHub Actions - Manual Publish
1. Go to your repository's **Actions** tab
2. Select **"Publish Docker Image to GHCR"**
3. Click **"Run workflow"**
4. Wait for the build to complete
5. Image will be available at `ghcr.io/ferilee/api-mathflix:latest`

📖 **Detailed database mounting guide:** See [DOCKER_DATABASE.md](./DOCKER_DATABASE.md)

## Database Management
The database is auto-managed using Drizzle Kit.
- **Push Schema Changes:** `bun x drizzle-kit push`
# api-mathflix
# api-mathflix
