# 🎙️ TỔNG KẾT DỰ ÁN: ENGLISHSTATION
## AI-Powered English Speaking Practice Platform

Tài liệu này tổng kết toàn bộ quy trình, cấu trúc kiến trúc, các bước thực hiện chi tiết và cách vận hành dự án **EnglishStation** — Hệ thống luyện nói tiếng Anh tích hợp nhận dạng giọng nói tự động sử dụng mô hình AI Whisper.

---

## 🏗️ 1. Kiến Trúc Hệ Thống (Architecture Overview)

Dự án được thiết kế theo mô hình **Microservices decoupled** để tối ưu hóa hiệu năng, tách biệt công nghệ và dễ dàng mở rộng trong tương lai. Hệ thống bao gồm 3 dịch vụ chính hoạt động độc lập và giao tiếp thông qua mạng nội bộ Docker:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│                  │     │                  │     │                      │
│   React Frontend │────▶│  Express Backend  │────▶│  Python Whisper      │
│   (Vite + TS)    │     │  (Bun Runtime)   │     │  Service (FastAPI)   │
│                  │◀────│                  │◀────│                      │
│   Port: 3000     │     │   Port: 3001     │     │    Port: 8000        │
│                  │     │                  │     │                      │
└──────────────────┘     └──────────────────┘     └──────────────────────┘
    Browser Audio           Multer Upload            faster-whisper
    MediaRecorder          Axios → FastAPI           CTranslate2
                           File Cleanup              VAD Filter
```

### ⚡ Các quyết định thiết kế cốt lõi:
1. **Tách biệt Python Service**: Whisper chạy tối ưu nhất trên hệ sinh thái Python (numpy, CTranslate2). Tách riêng giúp tránh xung đột tài nguyên với Node.js.
2. **Sử dụng `faster-whisper` thay vì OpenAI Whisper gốc**:
   - Tốc độ nhận diện nhanh gấp **4 lần**.
   - Dung lượng RAM sử dụng thấp hơn đáng kể (~500MB cho bản `base` nhờ lượng tử hóa `int8`).
   - Độ chính xác tương đương.
3. **Sử dụng Bun Runtime cho Backend**: Cho hiệu năng khởi động nhanh, tích hợp sẵn TypeScript compiler mà không cần các công cụ build phức tạp.

---

## 🔄 2. Quy Trình Hoạt Động (System Workflows)

### A. Luồng Đi của Dữ Liệu Âm Thanh (Audio Upload Lifecycle)

1. **Thu âm (Frontend)**:
   - Sử dụng `MediaRecorder` API để thu âm giọng nói trực tiếp từ trình duyệt của người dùng.
   - Cấu hình âm thanh tối ưu cho mô hình Whisper: Kênh đơn (mono), tần số lấy mẫu 16kHz, kích hoạt bộ khử tiếng ồn (noise suppression) và triệt tiêu tiếng vang (echo cancellation).
   - Audio được đóng gói dưới định dạng Container `audio/webm;codecs=opus`.
2. **Truyền dữ liệu lên Express Backend**:
   - Audio được gửi dưới dạng `multipart/form-data`.
   - Backend sử dụng `Multer` để lưu tạm file âm thanh vào thư mục `./uploads` với tên file ngẫu nhiên (UUID) để tránh trùng lặp.
   - Thực hiện kiểm tra định dạng và dung lượng file qua middleware validation.
3. **Chuyển tiếp đến Whisper Service**:
   - Backend sử dụng `Axios` để tạo một stream đọc file trực tiếp (`fs.createReadStream`) và chuyển tiếp qua POST HTTP Multipart request đến cổng dịch vụ Python `http://whisper:8000/transcribe`.
4. **Nhận diện giọng nói (FastAPI + AI)**:
   - FastAPI nhận file âm thanh, ghi tạm vào đĩa để tránh tràn RAM khi file lớn.
   - Chạy mô hình `faster-whisper` với thuật toán VAD (Voice Activity Detection) để lọc bỏ khoảng lặng và tiếng ồn nền trước khi dịch.
   - Trả về cấu trúc JSON chứa văn bản dịch, ngôn ngữ nhận diện, độ tin cậy và các phân đoạn thời gian (segments).
5. **Dọn dẹp tài nguyên & Phản hồi**:
   - FastAPI xóa file tạm ngay khi xử lý xong (trong block `finally`).
   - Express Backend nhận kết quả, tiến hành xóa file ghi âm tạm trên server của mình, sau đó trả dữ liệu JSON hoàn chỉnh cho Frontend hiển thị.

---

## 🛠️ 3. Các Bước Thực Hiện Xây Dựng Dự Án (Implementation Steps)

Quá trình xây dựng hệ thống từ đầu được chia thành các giai đoạn chính:

### Giai đoạn 1: Thiết lập cấu trúc Mono-repo & Docker Compose
- Tạo thư mục gốc dự án và các thư mục con: `frontend`, `backend`, `whisper-service`.
- Viết file `docker-compose.yml` để cấu hình mạng nội bộ (`english-station-network`), tạo các volume dùng chung để cache mô hình học máy (`whisper-models`) và lưu file upload tạm (`backend-uploads`).

### Giai đoạn 2: Phát triển Python Whisper Service
1. **Thiết lập môi trường**: Tạo file `requirements.txt` chứa các thư viện `fastapi`, `uvicorn`, `faster-whisper`, `pydantic-settings`, `python-multipart`, `yt-dlp`, và `requests`.
2. **Quản lý vòng đời mô hình (Lifespan Context Manager)**:
   - Tải mô hình (`load_model`) khi ứng dụng FastAPI khởi động nhằm tránh hiện tượng "cold start". Mô hình được giữ trên RAM để phục vụ tức thì.
3. **Xử lý Audio & Nhận dạng**:
   - Endpoint `/transcribe`: Nhận file âm thanh qua FastAPI `UploadFile`. Cấu hình `WhisperModel` với `beam_size=5` và `vad_filter=True`.
   - **Dịch vụ tải YouTube (`youtube_downloader.py`)**: Tích hợp thư viện `yt-dlp` để tải nhạc nền dạng MP3 chất lượng tốt nhất từ các URL YouTube (giới hạn tối đa 10 phút để tránh quá tải).
   - Endpoint `/transcribe_youtube`: Tiếp nhận URL YouTube, kích hoạt downloader tải và trích xuất audio tạm vào `/tmp/youtube_audio`, gửi qua mô hình dịch rồi lập tức dọn dẹp file tạm.

### Giai đoạn 3: Phát triển Backend API (Express + Bun)
1. **Thiết lập Bun Project**: Khởi tạo project TypeScript với Bun, cài đặt: `express`, `multer`, `axios`, `helmet`, `cors`, `express-rate-limit`.
2. **Giao tiếp API (Whisper Service Client)**:
   - Phương thức `transcribeAudio`: Gửi request Multipart Form kèm luồng đọc file âm thanh đến FastAPI.
   - Phương thức `transcribeYouTube`: Gửi request JSON chứa URL YouTube đến FastAPI, tiếp nhận kết quả chuyển ngữ kèm metadata video (title, uploader, url).
   - Cơ chế tự động dọn dẹp file trong block `finally` ở cả backend và AI service.
3. **Cấu hình Routes & Healthcheck**:
   - Thêm API route `POST /api/youtube-transcribe` nhận URL YouTube từ client.
   - **Tối ưu hóa Healthcheck**: Sửa đổi cơ chế kiểm tra sức khỏe của dịch vụ backend trong `Dockerfile` và `docker-compose.yml`. Thay thế công cụ `curl` (không có sẵn trong image rút gọn `bun:1-slim`) bằng script gọi hàm `fetch` nội tại của Bun:
     `bun -e "fetch('http://localhost:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"`

### Giai đoạn 4: Phát triển Frontend (React + Vite)
1. **Giao diện Tabs chuyển đổi**: Thiết kế thanh điều hướng tab Microphone / YouTube để lựa chọn phương thức đầu vào mong muốn.
2. **Microphone Mode**: Cho phép ghi âm trực tiếp qua mic của thiết bị và gửi file lên backend.
3. **YouTube Mode (`YouTubeTranscriber.tsx`)**:
   - Ô nhập link YouTube trực quan với hệ thống tự động kiểm tra định dạng URL hợp lệ trước khi gửi.
   - Trạng thái loading kèm micro-animation và thông báo tiến trình tải nhạc & dịch từ server.
4. **Hiển thị kết quả (`TranscriptDisplay.tsx`)**:
   - Nhận diện nếu kết quả dịch đến từ nguồn YouTube sẽ hiển thị thêm Banner đỏ sang trọng chứa Tiêu đề video, Tên kênh và Đường dẫn mở trực tiếp video gốc trên YouTube.
   - Trưng bày các phân đoạn text chia theo dòng thời gian tương tác (Segments).

### Giai đoạn 5: Đóng gói và Container hóa (Docker deployment)
- **Frontend Dockerfile**: Multi-stage build sang bundle tĩnh chạy bằng **Nginx** để tối ưu hóa hiệu suất truyền dữ liệu.
- **Backend Dockerfile**: Sử dụng image Bun tối giản, cấu hình phân quyền bảo mật cho user `expressuser` và tích hợp script healthcheck Bun-native.
- **Whisper Dockerfile**: Cài đặt `ffmpeg` xử lý âm thanh, tạo user bảo mật `whisperuser` (UID 1001), khởi tạo sẵn các thư mục `/home/whisperuser/.cache/huggingface` và phân quyền sở hữu trước khi switch user để tránh lỗi Permission denied khi lưu cache model.

---

## 🚀 4. Các Bước Khởi Chạy Chi Tiết (Execution Steps)

### Cách 1: Khởi chạy bằng Docker Compose (Khuyên dùng)
Đây là cách nhanh nhất và tự động cấu hình toàn bộ hệ thống.

1. **Chuẩn bị các file cấu hình**:
   ```bash
   # Di chuyển vào thư mục dự án
   cd EnglishStation

   # Sao chép cấu hình môi trường (nếu chưa có)
   cp .env.example .env
   ```
2. **Khởi chạy hệ thống**:
   ```bash
   # Xây dựng lại container và chạy ở chế độ nền
   docker-compose up --build -d
   ```
   *Lưu ý ở lần chạy đầu tiên:* Whisper Service sẽ kết nối HuggingFace để tải mô hình AI `base` (dung lượng ~140MB). Sau khi log hiển thị `Healthy`, toàn bộ các cổng sẽ sẵn sàng.
3. **Truy cập ứng dụng**:
   - Giao diện người dùng: [http://localhost:3000](http://localhost:3000)
   - Cổng Backend API: [http://localhost:3001](http://localhost:3001)
   - Cổng FastAPI Whisper: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Cách 2: Khởi chạy Thủ công từng phần trên Windows (Dành cho Lập trình viên)

Mở **3 Terminal riêng biệt**, mỗi terminal chạy một dịch vụ.

---

#### 🐍 Terminal 1 — Whisper Service (Python FastAPI)

**Lần đầu tiên** (cần tạo môi trường ảo và cài thư viện):
```powershell
cd whisper-service
python -m venv venv
# Cài đặt dependencies sử dụng pip trực tiếp từ thư mục venv
.\venv\Scripts\pip install -r requirements.txt
# Chạy ứng dụng thông qua python.exe trong venv
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Từ lần thứ 2 trở đi** (môi trường ảo đã có, chỉ cần chạy trực tiếp):
```powershell
cd whisper-service
# Chạy ứng dụng thông qua python.exe trong venv (không cần kích hoạt nếu PowerShell chặn script)
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> ⚠️ **Lưu ý quan trọng**: Luôn dùng `python -m uvicorn` (không phải `uvicorn` trực tiếp) trên Windows để tránh lỗi `command not found`. Dịch vụ sẵn sàng khi log hiển thị `Application startup complete`.

---

#### 🟢 Terminal 2 — Backend API (Express + Bun)

**Lần đầu tiên** (cần cài thư viện):
```powershell
cd backend
bun install
bun run dev
```

**Từ lần thứ 2 trở đi**:
```powershell
cd backend
bun run dev
```

> Backend sẵn sàng khi log hiển thị `Server running on port 3001`.

---

#### ⚛️ Terminal 3 — Frontend (React + Vite)

**Lần đầu tiên** (cần cài thư viện):
```powershell
cd frontend
bun install
bun run dev
```

**Từ lần thứ 2 trở đi**:
```powershell
cd frontend
bun run dev
```

> Truy cập giao diện tại: **[http://localhost:5173](http://localhost:5173)**

---

## 🏆 5. Kết Quả Đạt Được (Key Accomplishments)

1. **Khắc phục triệt để lỗi phân quyền (Docker Permission Denied)**:
   - Sửa lỗi tạo non-root user không có home directory trong Dockerfile (`useradd -m`).
   - Cấu hình phân quyền trước khi chuyển sang non-root user và thay đổi ánh xạ volume của `huggingface` sang đường dẫn `/home/whisperuser/.cache/...` tương thích.
2. **Sửa lỗi Healthcheck Backend**:
   - Giải quyết tình trạng container backend bị đánh giá `unhealthy` do ảnh hưởng của việc thiếu công cụ `curl` trong base image Bun-slim bằng cách viết script fetch nội tại.
3. **Tích hợp thành công tính năng YouTube Transcriber**:
   - Tự động hóa quá trình tải nhạc nén chất lượng cao và chuyển đổi giọng nói thành văn bản từ mọi video YouTube công khai có thời lượng dưới 10 phút.
   - Thêm giao diện tabs mượt mà, Banner video YouTube sinh động, quản lý logic tải và dịch song song.
4. **Tối ưu hóa tài nguyên**:
   - Đĩa cứng được dọn dẹp liên tục nhờ cơ chế auto-cleanup file tạm ở cả hai tầng microservices.
   - Khởi tạo RAM nhẹ chỉ ~500MB cho mô hình `faster-whisper`.

---

## 🗺️ 6. Lộ Trình Phát Triển Tiếp Theo (Roadmap)
- **Phase 2: Chấm điểm phát âm (Pronunciation Scoring)**: Phân tích âm thanh thu từ mic so sánh với văn bản chuẩn để chấm điểm phát âm chính xác tới từng từ và âm tiết (phoneme level).
- **Phase 3: AI Tutor (Gia sư AI)**: Sử dụng các mô hình ngôn ngữ lớn (LLM như Llama hoặc GPT) để trò chuyện trực tiếp bằng giọng nói với người học.
- **Phase 4: Streaming STT (Nhận diện thời gian thực)**: Thay vì tải lên cả file dài, hệ thống sẽ sử dụng WebSockets để nhận diện giọng nói ngay khi người dùng đang nói.

## 7. Tổng Hợp Lệnh Chạy Nhanh (Từ lần 2 trở đi)

Sau khi đã thiết lập môi trường ảo Python và các thư viện, mỗi lần khởi động dự án chỉ cần mở 3 Terminal riêng biệt:

| Terminal / Service | Lệnh chạy (Windows PowerShell) | Cổng |
|---|---|---|
| **Terminal 1** (Whisper) | `cd whisper-service; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` | 8000 |
| **Terminal 2** (Backend) | `cd backend; bun run dev` | 3001 |
| **Terminal 3** (Frontend) | `cd frontend; bun run dev` | 5173 |

> [!TIP]
> Do Windows PowerShell không hỗ trợ cú pháp `&&` như Bash, ta sử dụng dấu `;` để phân tách lệnh.
> Nếu muốn chạy nhanh bằng command prompt (`cmd`), bạn có thể đổi dấu `;` thành `&`.

**Kiểm tra dịch vụ đang chạy:**
- Whisper API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Backend Health: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- Frontend App: [http://localhost:5173](http://localhost:5173)