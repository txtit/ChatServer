# Test API Image Search - Hướng dẫn

## 📋 Mô tả
API này cho phép tìm kiếm hình ảnh từ prompt văn bản thông qua các dịch vụ: Unsplash, Pixabay, Pexels

## 🔧 Cấu hình API Keys (trong config.env)

Để sử dụng đầy đủ tính năng, bạn cần các API keys sau:

```env
# API Keys cho dịch vụ tìm hình ảnh
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
PIXABAY_API_KEY=your_pixabay_api_key_here  
PEXELS_API_KEY=your_pexels_api_key_here
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key_here
```

### Cách lấy API Keys:

1. **Unsplash API Key:**
   - Truy cập: https://unsplash.com/developers
   - Đăng ký/Đăng nhập tài khoản
   - Tạo ứng dụng mới và lấy Access Key

2. **Pixabay API Key:**
   - Truy cập: https://pixabay.com/api/docs/
   - Đăng ký tài khoản
   - Lấy API key từ trang tài khoản

3. **Pexels API Key:**
   - Truy cập: https://www.pexels.com/api/
   - Đăng ký tài khoản
   - Tạo ứng dụng và lấy API key

4. **Google Translate API Key:**
   - Truy cập: https://cloud.google.com/translate
   - Tạo project và enable Translate API
   - Lấy API key

## 🚀 Test với Postman

### 1. Test cơ bản với prompt tiếng Việt

**URL:** `POST http://localhost:3000/learn/slides/image-search`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "prompt": "con mèo đang ngủ",
  "language": "vi"
}
```

### 2. Test với prompt tiếng Anh

**Body (JSON):**
```json
{
  "prompt": "beautiful sunset over mountains",
  "language": "en"
}
```

### 3. Test với prompt giáo dục

**Body (JSON):**
```json
{
  "prompt": "học sinh đang học toán",
  "language": "vi"
}
```

## 📝 Phản hồi mẫu

### Thành công:
```json
{
  "success": true,
  "data": {
    "originalPrompt": "con mèo đang ngủ",
    "searchQuery": "sleeping cat",
    "totalResults": 9,
    "images": [
      {
        "source": "Unsplash",
        "url": "https://images.unsplash.com/photo-...",
        "thumbnail": "https://images.unsplash.com/photo-...",
        "description": "sleeping cat",
        "author": "John Doe",
        "downloadUrl": "https://unsplash.com/photos/..."
      },
      {
        "source": "Pixabay",
        "url": "https://pixabay.com/get/...",
        "thumbnail": "https://cdn.pixabay.com/photo/...",
        "description": "cat, sleep, cute",
        "author": "pixabay_user",
        "downloadUrl": "https://pixabay.com/get/..."
      }
    ],
    "sources": ["Unsplash", "Pixabay", "Pexels"]
  }
}
```

### Lỗi:
```json
{
  "success": false,
  "error": "Prompt là bắt buộc"
}
```

## 🔍 Tính năng

1. **Tự động dịch:** Prompt tiếng Việt sẽ được dịch sang tiếng Anh
2. **Multi-source:** Tìm kiếm từ nhiều nguồn cùng lúc
3. **Fallback:** Nếu không tìm thấy, sẽ trả về hình placeholder
4. **Shuffle:** Kết quả được trộn để đa dạng hóa
5. **Limit:** Giới hạn tối đa 9 kết quả

## 🛠️ Tích hợp vào slide

Để tích hợp vào hệ thống slide, bạn có thể:

1. Gọi API này để lấy danh sách hình ảnh
2. Cho người dùng chọn hình ảnh phù hợp
3. Lưu URL hình ảnh vào field `imageUrl` của slide

## 🐛 Troubleshooting

1. **Lỗi 400 - Prompt là bắt buộc:**
   - Kiểm tra body request có field `prompt`

2. **Không có hình ảnh trả về:**
   - Kiểm tra API keys trong config.env
   - Thử với prompt đơn giản hơn

3. **Lỗi kết nối:**
   - Kiểm tra internet connection
   - Kiểm tra API keys có đúng format không

## 💡 Tips

- Sử dụng prompt đơn giản, dễ hiểu
- Với prompt tiếng Việt, API sẽ tự động dịch sang tiếng Anh
- Nếu không có API keys, hệ thống vẫn trả về placeholder images
- Kết quả được cache trong memory, có thể cải thiện performance sau này
