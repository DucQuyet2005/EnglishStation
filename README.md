# 🎙️ EnglishStation

**AI-Powered English Speaking Practice Platform**

A production-ready system for learning English through speech recognition, powered by OpenAI's Whisper model. Record your voice, get instant transcription, and practice pronunciation.

## Features

- **Microphone Recording:** Record your voice directly in the browser and get an instant transcription.
- **YouTube Transcription:** Paste a YouTube video link to automatically extract and transcribe the audio (up to 10 minutes).
- **Fast & Accurate:** Uses the `faster-whisper` model (CTranslate2) for high-performance offline speech recognition.
- **User Authentication:** Secure JWT-based registration and login, including native **Google Sign-In** support.
- **Database Integration:** Persistent storage using **MongoDB & Mongoose** to save transcription history and vocabulary.
- **Visual Feedback:** See your transcription broken down into timed segments with confidence scores.
- **Clean Architecture:** Modern decoupled stack with React, Node.js (Bun), and Python FastAPI.
- **Dockerized:** Simple one-command deployment using Docker Compose.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Flow](#system-flow)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Run with Docker (Recommended)](#run-with-docker-recommended)
  - [Run Locally without Docker](#run-locally-without-docker)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [How It Works](#how-it-works)
- [Security](#security)
- [Deployment Guide](#deployment-guide)
- [Roadmap](#roadmap)

---

## 🏗️ Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│                  │     │                  │     │                      │
│   React Frontend │────▶│  Express Backend  │────▶│  Python Whisper      │
│   (Vite + TS)    │     │  (Bun Runtime)   │     │  Service (FastAPI)   │
│                  │◀────│                  │◀────│                      │
│   Port: 3000     │     │   Port: 3001     │     │    Port: 8000        │
│                  │     │                  │     │                      │
└──────────────────┘     └──────────────────┘     └──────────────────────┘
         ▲                         ▲
         │                         │
         ▼                         ▼
   Google OAuth              ┌──────────────┐
   Client Flow               │   MongoDB    │
                             │ (Atlas/Local)│
                             └──────────────┘
```

### Tại sao tách Python Service riêng?

1. **Tách biệt công nghệ**: Whisper chạy tốt nhất trên Python ecosystem (numpy, ctranslate2)
2. **Scaling độc lập**: Có thể scale Whisper service riêng khi load tăng
3. **Memory isolation**: Whisper model chiếm ~500MB RAM, cách ly khỏi Node process
4. **Dễ upgrade**: Cập nhật model mà không ảnh hưởng backend
5. **Reusable**: Whisper service có thể phục vụ nhiều backend khác nhau

### Tại sao dùng faster-whisper?

| Feature | OpenAI Whisper | faster-whisper |
|---------|---------------|----------------|
| Speed | 1x (baseline) | **4x faster** |
| Memory | ~1.5GB (base) | **~500MB (base, int8)** |
| Quantization | No | int8, float16 |
| Engine | PyTorch | CTranslate2 |
| Accuracy | Baseline | **Same quality** |
| Cost | Free | **Free** |

---

## 🔄 System Flow

### Audio Upload Lifecycle

```
User speaks into mic
       │
       ▼
┌─ Frontend (React) ──────────────────────────┐
│  1. MediaRecorder captures audio (webm)      │
│  2. User clicks "Transcribe"                 │
│  3. FormData created with audio blob         │
│  4. Axios POST to /api/transcribe            │
│  5. Upload progress tracked                  │
└──────────────────┬───────────────────────────┘
                   │ HTTP POST (multipart/form-data)
                   ▼
┌─ Backend (Express) ─────────────────────────┐
│  6. Multer saves file to /uploads/           │
│  7. Validation middleware checks file        │
│  8. whisper.service creates FormData         │
│  9. Axios POST to whisper:8000/transcribe    │
│ 10. Receives transcription JSON              │
│ 11. Maps to frontend-friendly format         │
│ 12. Cleans up temp file                      │
│ 13. Returns JSON response                    │
└──────────────────┬───────────────────────────┘
                   │ HTTP POST (multipart/form-data)
                   ▼
┌─ Whisper Service (FastAPI) ──────────────────┐
│ 14. Validates audio file                     │
│ 15. Saves to temp file                       │
│ 16. faster-whisper transcribes with VAD      │
│ 17. Returns text + segments + metadata       │
│ 18. Cleans up temp file                      │
└──────────────────────────────────────────────┘
```

### Whisper Model Lifecycle

```
Application Start
       │
       ▼
  Load Model (base, ~74M params)
  ⏱️ Takes 3-8 seconds
       │
       ▼
  Model in Memory (~500MB with int8)
       │
       ├──── Request 1: Transcribe → Return
       ├──── Request 2: Transcribe → Return
       ├──── Request N: Transcribe → Return
       │
       ▼
  Application Shutdown
       │
       ▼
  Unload Model from Memory
```

---

## 📁 Project Structure

```
EnglishStation/
├── frontend/                    # React Frontend
│   └── src/
│       ├── api/                 # API connection layer
│       ├── components/          # UI Components (Header, Auth, Audio, etc.)
│       ├── context/             # Global states (AuthContext, etc.)
│       ├── hooks/               # Custom React Hooks
│       └── types/               # TypeScript Definitions
│
├── backend/                     # Express Backend
│   └── src/
│       ├── config/              # Environment configurations
│       ├── controllers/         # API Request Handlers
│       ├── middlewares/         # JWT Auth & Upload Middlewares
│       ├── models/              # Mongoose DB Schemas & Models
│       ├── routes/              # Express API Routes
│       ├── services/            # Whisper client service integration
│       ├── types/               # TypeScript Definitions
│       └── utils/               # AppError, Logger & response helpers
│
└── whisper-service/             # Python Whisper Service
    └── app/
        ├── services/            # Core Whisper Transcription logic
        └── utils/               # Audio Validation utility
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + TypeScript | UI components & type safety |
| Build Tool | Vite 6 | Fast HMR development & optimized builds |
| Auth (Client) | Google Identity Services SDK | One-tap and button-based Google Sign-In |
| Backend | Express 4 | REST API web server |
| Runtime | Bun | High-performance TypeScript execution |
| Database | MongoDB + Mongoose | Data persistence (users, records, vocabulary) |
| Security & Auth | JWT + bcryptjs | Stateless session tokens & secure password hashing |
| File Upload | Multer | Multipart form data upload handling |
| AI Service | FastAPI | Async Python machine learning gateway |
| STT Engine | faster-whisper | High-speed CTranslate2 Speech-to-Text inference |
| Audio | ffmpeg | Server-side audio conversion & processing |
| Containers | Docker + Docker Compose | Infrastructure orchestration |
| Reverse Proxy | Nginx | Static frontend server & proxy router |

---

## 🚀 Getting Started

### Prerequisites

- **Docker & Docker Compose** (for Docker setup)
- **Bun** >= 1.0 (for local backend)
- **Node.js** >= 18 (for local frontend)
- **Python** >= 3.10 (for local Whisper service)
- **ffmpeg** (for local Whisper service)

### Run with Docker (Recommended)

```bash
# 1. Clone the project
cd EnglishStation

# 2. Copy environment files
cp .env.example .env

# 3. Build and start all services
docker-compose up --build

# 4. Open in browser
# http://localhost:3000
```

**What happens:**
1. Docker builds 3 images (frontend, backend, whisper)
2. Whisper service downloads the model (~140MB) on first start
3. Model loads into memory (~3-8s)
4. All services connect via internal Docker network
5. Frontend is served on port 3000
6. Backend API is accessible on port 3001
7. Whisper service runs on port 8000

**Other Docker commands:**
```bash
# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f whisper

# Rebuild a specific service
docker-compose up --build backend

# Remove volumes (cleans model cache)
docker-compose down -v
```

### Run Locally without Docker

#### Terminal 1: Whisper Service

```bash
cd whisper-service

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (macOS/Linux)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install ffmpeg (Windows - with chocolatey)
# choco install ffmpeg
# Install ffmpeg (macOS)
# brew install ffmpeg
# Install ffmpeg (Ubuntu)
# sudo apt install ffmpeg

# Copy env file
cp .env.example .env

# Start service (model downloads on first run)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 2: Backend

```bash
cd backend

# Install dependencies
bun install

# Copy env file
cp .env.example .env

# Start dev server
bun run dev
```

#### Terminal 3: Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Start dev server
npm run dev
```

**Access the app:** http://localhost:5173

---

## 📡 API Documentation

### Authentication API

#### POST /api/auth/register
Register a new user account with email and password.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "strongpassword123",
    "fullName": "John Doe"
  }
  ```
- **Success Response (201):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": "60d5ec49f1b29c2d18c1e4f1",
        "email": "user@example.com",
        "fullName": "John Doe"
      }
    },
    "message": "Account created successfully",
    "timestamp": "2026-06-03T14:00:00.000Z"
  }
  ```

#### POST /api/auth/login
Authenticate with email and password.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "strongpassword123"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": "60d5ec49f1b29c2d18c1e4f1",
        "email": "user@example.com",
        "fullName": "John Doe"
      }
    },
    "message": "Login successful",
    "timestamp": "2026-06-03T14:00:00.000Z"
  }
  ```

#### POST /api/auth/google
Authenticate or register automatically using a Google ID token.
- **Request Body:**
  ```json
  {
    "idToken": "eyJhbGciOiJSUzI1Ni..."
  }
  ```
- **Success Response (200):** Returns JWT token and user profile.

#### GET /api/auth/me
Fetch the logged-in user profile. Requires Bearer Token.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response (200):** Returns user profile details.

---

### Speech-to-Text API

#### POST /api/transcribe
Upload audio for transcription. Requires Bearer Token.
- **Headers:** `Authorization: Bearer <token>`
- **Request:**
  ```
  Content-Type: multipart/form-data
  Field: audio (file)
  Max Size: 10MB
  Formats: wav, mp3, ogg, webm, flac, m4a, aac, mp4
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "60d5ec49f1b29c2d18c1e4f5",
      "transcript": "Hello, my name is John and I am learning English.",
      "language": "en",
      "confidence": 0.9847,
      "duration": 3.52,
      "segments": [
        {
          "start": 0.00,
          "end": 3.52,
          "text": "Hello, my name is John and I am learning English."
        }
      ],
      "createdAt": "2026-05-26T10:30:00.000Z"
    },
    "message": "Transcription completed successfully",
    "timestamp": "2026-05-26T10:30:02.123Z"
  }
  ```

#### GET /api/health
Health check endpoint.
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "service": "english-station-backend",
      "whisperService": "connected",
      "timestamp": "2026-05-26T10:30:00.000Z"
    }
  }
  ```

---

## ⚙️ Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Backend server port |
| `NODE_ENV` | development | Environment mode |
| `MONGODB_URI` | `mongodb://localhost:27017/english_station` | MongoDB Atlas/Local connection URI |
| `JWT_SECRET` | - | Secret key used to sign JWT session tokens |
| `JWT_EXPIRES_IN` | `7d` | Session duration expiration |
| `GOOGLE_CLIENT_ID` | - | Client ID from Google Cloud Console credentials |
| `WHISPER_SERVICE_URL` | `http://localhost:8000` | Whisper service host URL |
| `MAX_FILE_SIZE_MB` | 10 | Maximum upload file size |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | CORS allowed origins |
| `UPLOAD_DIR` | `./uploads` | Temporary file storage path |

### Whisper Service

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL_SIZE` | base | Model size (tiny/base/small/medium/large) |
| `WHISPER_DEVICE` | cpu | Device (cpu/cuda/auto) |
| `WHISPER_COMPUTE_TYPE` | int8 | Quantization (int8/float16/float32) |
| `WHISPER_PORT` | 8000 | Service port |
| `MAX_AUDIO_DURATION` | 120 | Max audio length in seconds |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001/api` | Backend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | - | Google OAuth Client ID matching the backend config |

---

## 🔧 How It Works

### Frontend: Microphone Recording

```
Navigator.mediaDevices.getUserMedia()
    → MediaStream (mono, 16kHz, noise suppression)
        → MediaRecorder (webm/opus codec)
            → ondataavailable (chunks every 250ms)
                → onstop → Blob → FormData → Axios POST
```

Key settings for optimal Whisper input:
- **Mono channel**: Speech doesn't need stereo
- **16kHz sample rate**: Whisper's native input rate
- **Noise suppression**: Reduces background noise
- **Echo cancellation**: Prevents feedback loops

### Backend: Audio Processing Pipeline

```
Request arrives
    → Multer (MIME type check → disk storage → unique filename)
        → Validation middleware (extension + size check)
            → Controller (extracts file info)
                → Whisper Service Client
                    → Creates FormData with file stream
                    → POST to Python service
                    → Maps response to API format
                    → Cleans up temp file
                        → JSON response to client
```

### Express → FastAPI Communication

The backend uses **Axios** with **FormData** to forward audio:

```typescript
// whisper.service.ts
const form = new FormData();
form.append('file', fs.createReadStream(filePath), {
  filename: originalName,
  contentType: getMimeType(filePath),
});

// POST to Python service
await whisperClient.post('/transcribe', form, {
  headers: form.getHeaders(),
});
```

### Whisper: Transcription Process

```python
# 1. Model loaded at startup (once)
model = WhisperModel("base", device="cpu", compute_type="int8")

# 2. Per-request transcription
segments, info = model.transcribe(
    audio_path,
    beam_size=5,        # Balance accuracy/speed
    vad_filter=True,    # Skip silence
)

# 3. Collect segments with timestamps
for segment in segments:
    # Each segment has: start, end, text, probability
```

### Container Communication (Docker)

```
┌─ Docker Network: english-station-network ────────────────┐
│                                                           │
│  frontend (es-frontend)                                   │
│  └── Nginx proxies /api/* → http://backend:3001           │
│                                                           │
│  backend (es-backend)                                     │
│  └── Axios calls → http://whisper:8000/transcribe         │
│                                                           │
│  whisper (es-whisper)                                     │
│  └── Listens on port 8000, loads model at startup         │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

Docker Compose creates a **bridge network** where services reference each other by **service name** (not localhost). This is why the backend uses `WHISPER_SERVICE_URL=http://whisper:8000`.

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| Security Headers | Helmet middleware |
| CORS | Whitelist-based origin control |
| Rate Limiting | 30 req/min per IP |
| File Validation | MIME type + extension + size |
| Non-root Containers | Dedicated user in Dockerfiles |
| Input Sanitization | Multer file filter |
| Error Masking | Generic errors in production |
| File Cleanup | Automatic temp file deletion |

---

## 🚢 Deployment Guide

### VPS / Linux Server

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Install Docker Compose
sudo apt install docker-compose-plugin

# 3. Clone project
git clone <your-repo-url>
cd EnglishStation

# 4. Configure environment
cp .env.example .env
# Edit .env with production values

# 5. Build and start
docker-compose up -d --build

# 6. Set up reverse proxy (Nginx/Caddy)
# Point your domain to port 3000
```

### Docker Production

```bash
# Build with specific tag
docker-compose build --no-cache

# Start in production mode
docker-compose -f docker-compose.yml up -d

# Monitor logs
docker-compose logs -f

# Update a service
docker-compose up -d --build backend
```

### With GPU (NVIDIA)

```yaml
# In docker-compose.yml, add to whisper service:
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]

# And change environment:
environment:
  - WHISPER_DEVICE=cuda
  - WHISPER_COMPUTE_TYPE=float16
```

---

## 🗺️ Roadmap

### Phase 2: Pronunciation Scoring

```
User speaks → Whisper transcribes → Compare with reference text
                                         │
                                         ▼
                              Phoneme-level comparison
                              Word-level accuracy score
                              Visual feedback on errors
```

### Phase 3: AI English Tutor

```
Whisper STT → User's text → LLM (GPT/Llama) → Response text → TTS → Audio
                                   │
                                   ├── Grammar correction
                                   ├── Vocabulary suggestions
                                   ├── Conversation practice
                                   └── Topic-based lessons
```

### Phase 4: Real-time Streaming STT

```
Current:  Record full audio → Upload → Transcribe → Result
Future:   Stream audio chunks → WebSocket → Partial results → Live display

Technologies needed:
- WebSocket (Socket.IO)
- Streaming Whisper (whisper_streaming)
- Web Audio API (AudioWorklet)
```

### Phase 5: Shadowing Practice

```
Reference audio plays → User repeats → Compare transcripts
                                            │
                                            ▼
                                 Side-by-side comparison
                                 Timing analysis
                                 Pronunciation score
```

### Scaling Architecture

```
                    ┌─ Load Balancer ─┐
                    │                 │
              ┌─────┴─────┐   ┌─────┴─────┐
              │ Backend 1 │   │ Backend 2 │
              └─────┬─────┘   └─────┬─────┘
                    │               │
              ┌─────┴───────────────┴─────┐
              │      Message Queue        │
              │    (Redis/RabbitMQ)        │
              └─────┬───────────────┬─────┘
                    │               │
              ┌─────┴─────┐   ┌───┴───────┐
              │ Whisper 1 │   │ Whisper 2  │
              │   (CPU)   │   │   (GPU)    │
              └───────────┘   └────────────┘
```

### Performance Optimization

| Optimization | Impact | Difficulty |
|-------------|--------|------------|
| GPU inference | 10-50x faster | Medium |
| float16 quantization | 2x faster vs float32 | Easy |
| Audio chunking | Parallel processing | Medium |
| Model caching | Eliminate cold start | Easy |
| CDN for frontend | Faster page load | Easy |
| Redis caching | Cache repeated phrases | Medium |
| WebSocket streaming | Reduce perceived latency | Hard |

### Reducing Latency

1. **Use smaller model** (tiny instead of base) for real-time feedback
2. **VAD pre-filtering**: Skip silence before sending to Whisper
3. **Audio compression**: webm/opus is already compact
4. **Keep-alive connections** between backend and whisper service
5. **Streaming transcription** with partial results via WebSocket

---

## 📄 License

MIT License — Free for personal and educational use.

---

**Built with ❤️ for English learners everywhere.**
