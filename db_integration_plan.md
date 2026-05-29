# 🗺️ HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG CƠ SỞ DỮ LIỆU MONGODB & TÍNH NĂNG ÔN TẬP TỪ VỰNG (SPACED REPETITION)

Tài liệu này vạch ra kiến trúc, thiết kế cơ sở dữ liệu NoSQL (MongoDB) và lộ trình phát triển chi tiết để nâng cấp dự án **EnglishStation** từ một ứng dụng in-memory đơn giản thành một sản phẩm hoàn chỉnh có cơ chế xác thực người dùng, lưu trữ lịch sử dịch thuật chi tiết, quản lý sổ tay từ vựng và thuật toán ôn tập thông minh (Spaced Repetition).

---

## 🏗️ 1. Lựa Chọn Hệ Quản Trị Cơ Sở Dữ Liệu (Database Choice)

Để lưu trữ dữ liệu linh hoạt, đặc biệt là kết quả transcript chi tiết từ Whisper (các đoạn audio segments kèm timeline), **MongoDB** là một lựa chọn phù hợp.

*   **Khuyên dùng cho Development & Production:** **MongoDB** (chạy bằng một container Docker mới trong `docker-compose`).
*   **Thư viện ODM Thích Hợp cho Express + Bun (TypeScript):** **Mongoose** (Giúp định nghĩa Schema chặt chẽ ở tầng ứng dụng và hỗ trợ Type-safety đầy đủ).

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
        │ Mongoose ODM                        │ HTTP / JSON
        ▼                                     ▼
┌──────────────┐                       ┌──────────────┐
│   MongoDB    │                       │   FastAPI    │
│  (Database)  │                       │  (Whisper)   │
└──────────────┘                       └──────────────┘
```

---

## 🗄️ 2. Thiết Kế Sơ Đồ Cơ Sở Dữ Liệu (MongoDB Schemas)

Với MongoDB, chúng ta tận dụng cấu trúc tài liệu (Document) để nhúng (embed) các thông tin có mối quan hệ phụ thuộc chặt chẽ, thay vì tách thành quá nhiều bảng như SQL. 

Cụ thể: **Trạng thái ôn tập (Flashcard State)** sẽ được nhúng trực tiếp vào tài liệu **Vocabulary** vì chúng có mối quan hệ 1-1.

### A. Định nghĩa Types & Interfaces (TypeScript)
Tạo file `src/types/database.ts` để quản lý kiểu dữ liệu:

```typescript
import { Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface ITranscription {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  originalText: string;
  translatedText?: string;
  sourceUrl?: string;
  duration: number;
  language: string;
  segments?: ITranscriptionSegment[]; // Lưu chi tiết timeline từ Whisper
  createdAt: Date;
}

export interface IFlashcardState {
  repetitions: number;      // Số lần ôn tập đúng liên tiếp
  interval: number;         // Khoảng thời gian chờ đến lần ôn tiếp theo (ngày)
  easeFactor: number;       // Độ dễ của từ (mặc định 2.5)
  nextReviewAt: Date;       // Ngày cần ôn tập tiếp theo
  lastReviewedAt?: Date;    // Ngày ôn tập gần nhất
}

export interface IVocabulary {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  transcriptionId?: Types.ObjectId;
  word: string;
  translation: string;
  contextSentence?: string;
  notes?: string;
  flashcardState: IFlashcardState; // Nhúng trực tiếp trạng thái ôn tập
  createdAt: Date;
}
```

### B. Định nghĩa Mongoose Schemas & Models
Tạo file `src/models/Schemas.ts`:

```typescript
import { Schema, model } from 'mongoose';
import { IUser, ITranscription, IVocabulary } from '../types/database';

// 1. User Schema
const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String },
}, { timestamps: true });

// 2. Transcription Schema
const TranscriptionSchema = new Schema<ITranscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  originalText: { type: String, required: true },
  translatedText: { type: String },
  sourceUrl: { type: String },
  duration: { type: Number, required: true },
  language: { type: String, required: true },
  segments: [{
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    text: { type: String, required: true },
    confidence: { type: Number }
  }]
}, { timestamps: { createdAt: true, updatedAt: false } });

// 3. Vocabulary Schema (Nhúng FlashcardState)
const VocabularySchema = new Schema<IVocabulary>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  transcriptionId: { type: Schema.Types.ObjectId, ref: 'Transcription' },
  word: { type: String, required: true, trim: true },
  translation: { type: String, required: true },
  contextSentence: { type: String },
  notes: { type: String },
  flashcardState: {
    repetitions: { type: Number, default: 0 },
    interval: { type: Number, default: 1 },
    easeFactor: { type: Number, default: 2.5 },
    nextReviewAt: { type: Date, default: Date.now, index: true }, // Index để truy vấn nhanh hàng đợi học
    lastReviewedAt: { type: Date }
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

// Tạo phức hợp Index để tối ưu tìm kiếm từ vựng của từng User cần ôn tập
VocabularySchema.index({ userId: 1, 'flashcardState.nextReviewAt': 1 });

export const User = model<IUser>('User', UserSchema);
export const Transcription = model<ITranscription>('Transcription', TranscriptionSchema);
export const Vocabulary = model<IVocabulary>('Vocabulary', VocabularySchema);
```

---

## 🔄 3. Thuật Toán Ôn Tập Từ Vựng: SuperMemo-2 (SM-2)

Khi học viên ôn tập flashcard, họ sẽ tự đánh giá mức độ nhớ của mình từ **0 đến 5**:
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
    if (repetitions === 0) {
      interval = 1; // 1 ngày
    } else if (repetitions === 1) {
      interval = 6; // 6 ngày
    } else {
      interval = Math.round(prevInterval * easeFactor);
    }
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1; // Học lại vào ngày mai
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  return { repetitions, interval, easeFactor };
}
```

---

## 🛠️ 4. Quy Trình Các Bước Triển Khai Chi Tiết (Implementation Roadmap)

### Bước 1: Tích Hợp MongoDB vào Docker Compose
1.  Mở `docker-compose.yml`, bổ sung thêm service `mongodb` thay thế hoặc chạy song song:
    ```yaml
      mongodb:
        image: mongo:6.0-jammy
        container_name: es-mongodb
        ports:
          - "27017:27017"
        environment:
          - MONGO_INITDB_ROOT_USERNAME=english_admin
          - MONGO_INITDB_ROOT_PASSWORD=your_secure_password
          - MONGO_INITDB_DATABASE=english_station
        volumes:
          - mongodata:/data/db
        networks:
          - english-station-network
    ```
2.  Định nghĩa volume `mongodata` ở cuối file `docker-compose.yml`:
    ```yaml
    volumes:
      mongodata:
        driver: local
    ```

### Bước 2: Thiết Lập Kết Nối Mongoose Trên Backend
1.  Vào thư mục `backend`, cài đặt thư viện Mongoose:
    ```bash
    bun add mongoose
    ```
2.  Cập nhật file `.env` đường dẫn kết nối MongoDB:
    ```env
    MONGODB_URI="mongodb://english_admin:your_secure_password@mongodb:27017/english_station?authSource=admin"
    ```
3.  Tạo file khởi tạo kết nối cơ sở dữ liệu `src/config/database.ts`:
    ```typescript
    import mongoose from 'mongoose';

    export const connectDB = async () => {
      try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/english_station';
        await mongoose.connect(uri);
        console.log('🍃 MongoDB connected successfully!');
      } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
      }
    };
    ```
4.  Import và gọi `connectDB()` trong file chạy chính `src/server.ts` trước khi lắng nghe cổng kết nối của Express.

### Bước 3: Phát Triển Tính Năng Xác Thực (Authentication)
1.  Sử dụng thư viện `bcryptjs` để hash mật khẩu và `jsonwebtoken` (JWT) để cấp token đăng nhập.
2.  Tạo Middleware xác thực JWT trên Express: `src/middlewares/auth.ts`.
3.  Tạo các API Endpoints trong Router:
    *   `POST /api/auth/register` (Đăng ký tài khoản mới):
        ```typescript
        const { email, password, fullName } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await User.create({ email, passwordHash, fullName });
        ```
    *   `POST /api/auth/login` (Xác thực thông tin và trả về JWT Token).

### Bước 4: Phát Triển API Sổ Tay Từ Vựng & Lịch Sử
1.  **Lưu bài dịch (`Transcription`)**:
    *   Chỉnh sửa API nhận diện giọng nói gốc để lưu kết quả nhận diện (kèm `segments` chứa timeline) vào collection `transcriptions` liên kết với `userId`.
2.  **Lưu từ vựng (`Vocabulary`)**:
    *   Tạo endpoint `POST /api/vocabularies` để lưu từ mới do học viên nhấp chọn.
    *   Mặc định khởi tạo `flashcardState` với các giá trị ban đầu.
3.  **Lấy danh sách cần học (`Review Queue`)**:
    *   Tạo endpoint `GET /api/vocabularies/review-queue` lấy ra các từ có lịch học đến hạn hoặc quá hạn:
        ```typescript
        const reviewQueue = await Vocabulary.find({
          userId: req.user.id,
          'flashcardState.nextReviewAt': { $lte: new Date() }
        }).sort({ 'flashcardState.nextReviewAt': 1 });
        ```
4.  **Cập nhật tiến trình học (`Review Word`)**:
    *   Tạo endpoint `POST /api/vocabularies/review` nhận `vocabId` và `quality` (0-5) từ Client.
    *   Tìm kiếm từ vựng, tính toán các thông số mới bằng thuật toán SM-2, cập nhật và thiết lập ngày ôn tập tiếp theo:
        ```typescript
        const vocab = await Vocabulary.findById(vocabId);
        if (!vocab) return res.status(404).json({ message: 'Không tìm thấy từ vựng' });

        const currentReview = vocab.flashcardState;
        const nextState = calculateSM2(
          quality,
          currentReview.repetitions,
          currentReview.interval,
          currentReview.easeFactor
        );

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + nextState.interval);

        vocab.flashcardState = {
          repetitions: nextState.repetitions,
          interval: nextState.interval,
          easeFactor: nextState.easeFactor,
          nextReviewAt: nextReviewDate,
          lastReviewedAt: new Date()
        };

        await vocab.save();
        ```

### Bước 5: Cải Tiến Giao Diện Người Dùng (React Frontend)
1.  **Hệ thống Route Bảo Vệ:** Quản lý trạng thái đăng nhập của người dùng.
2.  **Tương tác click-to-save:** Cho phép nhấp chọn từ vựng ngay trên phụ đề dịch thuật, nhấn nút ➕ để gọi API lưu từ.
3.  **Màn hình Flashcard:**
    *   Lấy danh sách từ hàng đợi ôn tập từ API `/api/vocabularies/review-queue`.
    *   Sử dụng hiệu ứng lật thẻ (CSS 3D Transforms) để hiển thị nghĩa từ, phát âm và câu ngữ cảnh.
    *   Cung cấp 6 nút đánh giá (0-5) kích hoạt API cập nhật tiến độ ôn tập.
