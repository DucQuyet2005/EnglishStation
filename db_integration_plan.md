# 🗺️ HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG CƠ SỞ DỮ LIỆU & TÍNH NĂNG ÔN TẬP TỪ VỰNG (SPACED REPETITION)

Tài liệu này vạch ra kiến trúc, thiết kế cơ sở dữ liệu và lộ trình phát triển chi tiết để nâng cấp dự án **EnglishStation** từ một ứng dụng in-memory đơn giản thành một sản phẩm hoàn chỉnh có cơ chế xác thực người dùng, lưu trữ lịch sử, quản lý sổ tay từ vựng và thuật toán ôn tập thông minh (Spaced Repetition).

---

## 🏗️ 1. Lựa Chọn Hệ Quản Trị Cơ Sở Dữ Liệu (Database Choice)

Để quản lý các mối quan hệ chặt chẽ giữa **Người dùng (Users)**, **Từ vựng (Vocabularies)**, và **Lịch sử luyện tập (Reviews)**, hệ quản trị cơ sở dữ liệu quan hệ là lựa chọn tối ưu nhất.

*   **Khuyên dùng cho Development & Production:** **PostgreSQL** (chạy bằng một container Docker mới trong `docker-compose`).
*   **OR/M Thích Hợp cho Express + Bun (TypeScript):** **Prisma** hoặc **Drizzle ORM** (Giúp tự động hóa migrations, viết query an toàn kiểu dữ liệu Type-safe).

```
   ┌───────────────────────────────────────────────┐
   │             React Frontend (UI)               │
   └───────────────────────────────────────────────┘
                           │  HTTP / JWT
                           ▼
   ┌───────────────────────────────────────────────┐
   │             Express Backend API               │
   │  (Xử lý Auth, Quản lý Vocab, Thuật toán SM2)  │
   └───────────────────────────────────────────────┘
        │                                     │
        │ Prisma ORM                          │ HTTP / JSON
        ▼                                     ▼
┌──────────────┐                       ┌──────────────┐
│  PostgreSQL  │                       │   FastAPI    │
│  (Database)  │                       │  (Whisper)   │
└──────────────┘                       └──────────────┘
```

---

## 🗄️ 2. Thiết Kế Sơ Đồ Cơ Sở Dữ Liệu (Database Schema)

Dưới đây là thiết kế các bảng (tables) quan trọng sử dụng cú pháp Prisma Schema để minh họa:

### A. Bảng Người Dùng (`User`)
Lưu trữ thông tin tài khoản và đăng nhập.
```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  passwordHash  String
  fullName      String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  transcriptions Transcription[]
  vocabularies   Vocabulary[]
  reviews        FlashcardReview[]
}
```

### B. Bảng Lịch Sử Dịch thuật (`Transcription`)
Lưu trữ các bài nói từ mic hoặc video YouTube mà người dùng đã thực hiện.
```prisma
model Transcription {
  id                   String            @id @default(uuid())
  userId               String
  user                 User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  title                String            // Tiêu đề (hoặc Tên file mic / Tiêu đề YouTube)
  originalText         String            @db.Text
  translatedText       String?           @db.Text
  sourceUrl            String?           // Link YouTube (nếu có)
  duration             Float
  language             String
  createdAt            DateTime          @default(now())
  
  vocabularies         Vocabulary[]      // Liên kết tới các từ vựng được lưu từ bài dịch này
}
```

### C. Sổ Tay Từ Vựng (`Vocabulary`)
Lưu trữ những từ vựng học viên chủ động nhấp vào và chọn "Lưu từ mới".
```prisma
model Vocabulary {
  id              String         @id @default(uuid())
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  transcriptionId String?
  transcription   Transcription? @relation(fields: [transcriptionId], references: [id])
  
  word            String         // Từ vựng gốc (ví dụ: "abundant")
  translation     String         // Nghĩa dịch (ví dụ: "dồi dào, phong phú")
  contextSentence String?        @db.Text // Câu chứa từ đó để người học nhớ ngữ cảnh
  notes           String?        @db.Text // Ghi chú cá nhân
  createdAt       DateTime       @default(now())
  
  flashcardState  FlashcardState?
}
```

### D. Trạng Thái Flashcard & Ôn Tập (`FlashcardState` & `FlashcardReview`)
Lưu trạng thái tính toán tần suất lặp lại theo phương pháp ôn tập ngắt quãng (Spaced Repetition).
```prisma
model FlashcardState {
  id            String     @id @default(uuid())
  vocabularyId  String     @unique
  vocabulary    Vocabulary @relation(fields: [vocabularyId], references: [id], onDelete: Cascade)
  
  // Các thông số của thuật toán SuperMemo-2 (SM-2)
  repetitions   Int        @default(0)    // Số lần đã ôn tập đúng liên tiếp
  interval      Int        @default(1)    // Khoảng thời gian chờ đến lần ôn tiếp theo (tính bằng ngày)
  easeFactor    Float      @default(2.5)  // Độ dễ của từ (mặc định ban đầu là 2.5)
  nextReviewAt  DateTime   @default(now())// Ngày cần ôn tập tiếp theo
  lastReviewedAt DateTime?
}
```

---

## 🔄 3. Thuật Toán Ôn Tập Từ Vựng: SuperMemo-2 (SM-2)

Để học viên ghi nhớ từ vựng hiệu quả nhất, hệ thống sẽ áp dụng thuật toán **SM-2** để tính toán thời điểm học lại tối ưu. 

Mỗi lần học viên ôn tập từ vựng (bằng flashcard), họ sẽ tự đánh giá mức độ nhớ của mình từ **0 đến 5**:
*   `5`: Nhớ hoàn toàn không do dự.
*   `4`: Nhớ chính xác nhưng cần suy nghĩ một chút.
*   `3`: Nhớ nhưng mất nhiều thời gian hoặc nhớ mang máng.
*   `2`: Đoán sai nhưng khi nhìn đáp án thì nhận ra ngay.
*   `1`: Đoán sai hoàn toàn, đáp án trông rất quen.
*   `0`: Hoàn toàn không biết từ này.

### Logic tính toán lại lịch ôn tập ở Backend:
```typescript
interface SM2Result {
  repetitions: number;
  interval: number;
  easeFactor: number;
}

function calculateSM2(
  quality: number, // Đánh giá của user (0-5)
  prevRepetitions: number,
  prevInterval: number,
  prevEaseFactor: number
): SM2Result {
  let repetitions = prevRepetitions;
  let interval = prevInterval;
  let easeFactor = prevEaseFactor;

  if (quality >= 3) {
    // Nếu nhớ từ (Đánh giá từ 3, 4, 5)
    if (repetitions === 0) {
      interval = 1; // Học lại sau 1 ngày
    } else if (repetitions === 1) {
      interval = 6; // Học lại sau 6 ngày
    } else {
      interval = Math.round(prevInterval * easeFactor);
    }
    repetitions++;
  } else {
    // Nếu quên từ (Đánh giá 0, 1, 2)
    repetitions = 0;
    interval = 1; // Quay lại học vào ngày mai
  }

  // Cập nhật lại Độ dễ của từ (Ease Factor)
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Giới hạn Ease Factor tối thiểu là 1.3
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  return { repetitions, interval, easeFactor };
}
```

---

## 🛠️ 4. Quy Trình Các Bước Triển Khai Chi Tiết (Implementation Roadmap)

### Bước 1: Tích Hợp Cơ Sở Dữ Liệu vào Docker Compose
1.  Mở `docker-compose.yml`, bổ sung thêm một service `postgres`:
    ```yaml
      postgres:
        image: postgres:15-alpine
        container_name: es-postgres
        ports:
          - "5432:5432"
        environment:
          - POSTGRES_USER=english_admin
          - POSTGRES_PASSWORD=your_secure_password
          - POSTGRES_DB=english_station
        volumes:
          - pgdata:/var/lib/postgresql/data
        networks:
          - english-station-network
    ```
2.  Định nghĩa volume `pgdata` ở cuối file để dữ liệu không bị mất đi khi tắt container.

### Bước 2: Thiết Lập Prisma ORM Trên Backend
1.  Vào thư mục `backend`, cài đặt thư viện:
    ```bash
    bun add @prisma/client
    bun add -d prisma
    ```
2.  Khởi tạo Prisma: `bunx prisma init`.
3.  Cập nhật file `.env` đường dẫn kết nối: `DATABASE_URL="postgresql://english_admin:your_secure_password@postgres:5432/english_station?schema=public"`.
4.  Viết schema như ở phần (2), sau đó chạy lệnh migration để tạo bảng:
    ```bash
    bunx prisma migrate dev --name init
    ```

### Bước 3: Phát Triển Tính Năng Xác Thực (Authentication)
1.  Sử dụng thư viện `bcryptjs` để hash mật khẩu và `jsonwebtoken` (JWT) để cấp token đăng nhập.
2.  Viết các Middleware xác thực JWT trên Express: `auth.middleware.ts`.
3.  Tạo các Endpoint:
    *   `POST /api/auth/register` (Đăng ký tài khoản).
    *   `POST /api/auth/login` (Đăng nhập và nhận Token).
    *   `GET /api/auth/profile` (Xem thông tin cá nhân).

### Bước 4: Phát Triển API Sổ Tay Từ Vựng & Lịch Sử
1.  **Lưu bài dịch:** Chỉnh sửa API nhận diện giọng nói gốc để lưu kết quả nhận diện vào bảng `Transcription` liên kết với `userId`.
2.  **Lưu từ vựng:** Tạo endpoint `POST /api/vocabularies` để lưu từ mới do học viên nhấp chọn, kèm theo câu ngữ cảnh trích xuất trực tiếp từ bài dịch gốc.
3.  **Lấy danh sách cần học:** Tạo endpoint `GET /api/vocabularies/review-queue` lấy ra các từ có `nextReviewAt <= thời_gian_hiện_tại`.
4.  **Cập nhật tiến trình học:** Tạo endpoint `POST /api/vocabularies/review` nhận vào `quality` (0-5) từ Client, áp dụng thuật toán SM-2 để tính ngày ôn tiếp theo và cập nhật cơ sở dữ liệu.

### Bước 5: Cải Tiến Giao Diện Người Dùng (React Frontend)
1.  **Màn hình Login/Register:** Thiết lập hệ thống Router (React Router DOM) bảo vệ màn hình học nếu chưa đăng nhập.
2.  **Tương tác nhấp từ (Click-to-Add):**
    *   Tại màn hình kết quả dịch, khi di chuột qua từng từ của văn bản tiếng Anh, hiển thị popup giải nghĩa nhanh.
    *   Có một nút bấm ➕ để người học nhanh chóng lưu từ đó vào "Sổ tay từ vựng" cá nhân.
3.  **Trang Sổ Tay Từ Vựng (Vocabulary Notebook):** Hiển thị danh sách từ đã lưu, nghĩa tiếng Việt, câu ngữ cảnh và trạng thái trí nhớ (Ví dụ: "Đã thuộc", "Cần ôn tập hôm nay").
4.  **Tính năng Luyện Tập Flashcard (Spaced Repetition Study):**
    *   Màn hình lật thẻ (Flashcard): Mặt trước hiện từ tiếng Anh + phát âm, mặt sau hiện nghĩa + câu ví dụ.
    *   Bên dưới có 6 nút đánh giá mức độ nhớ từ 0 đến 5. Khi bấm, từ tiếp theo sẽ xuất hiện và từ cũ được lên lịch ôn tập tiếp theo.
