const express = require("express");
const axios = require("axios");
const Curriculum = require("../models/learn/currculum");
const router = express.Router();
// Thêm các import cần thiết ở đầu file
const uploadCloud = require("../config/cloudinary.config");
const cloudinary = require('cloudinary').v2;
// Import thêm model LearningPath nếu chưa có
const LearningPath = require('../models/learn/learningPath'); // Tạo model này nếu chưa có
const mammoth = require('mammoth'); // Cài đặt: npm install mammoth
const pdfParse = require('pdf-parse'); // Cài đặt: npm install pdf-parse
const Slide = require("../models/Slide");
const openai = require('../config/openai.config');
const streamifier = require('streamifier');
// Đảm bảo cloudinary được cấu hình
// Thêm import mới cho Google GenAI
const { generateImageFromPrompt: genAIImageGenerator } = require('../config/google-genai.config');
const Progress = require("../models/learn/progress");
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});
// Thêm hàm để lấy file từ Cloudinary trực tiếp bằng SDK
async function getFileFromCloudinary(publicId) {
    return new Promise((resolve, reject) => {
        // Tải file tạm
        const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.bin`);
        const writeStream = fs.createWriteStream(tempFilePath);

        // Lấy publicId từ URL Cloudinary
        // URL format: https://res.cloudinary.com/dszqwl3wv/image/upload/v1748338096/curricula/f1miesgeewe2auqkenlz.pdf
        const parts = publicId.split('/upload/');
        if (parts.length < 2) {
            return reject(new Error("URL không hợp lệ"));
        }

        const idPath = parts[1].split('/');
        idPath.shift(); // Bỏ version
        const actualPublicId = idPath.join('/');

        console.log("Tải file từ Cloudinary với publicId:", actualPublicId);

        // Tải file xuống bằng Cloudinary SDK
        cloudinary.api
            .resource(actualPublicId, { resource_type: 'raw' })
            .then(result => {
                // Tạo download stream
                https.get(result.secure_url, (response) => {
                    response.pipe(writeStream);
                    writeStream.on('finish', () => {
                        console.log("Đã tải file thành công vào:", tempFilePath);
                        resolve(tempFilePath);
                    });
                }).on('error', reject);
            })
            .catch(err => {
                console.error("Lỗi khi truy vấn Cloudinary:", err);
                reject(err);
            });
    });
}
// Hàm tạo prompt từ dữ liệu form
function buildPrompt({ grade, weakSubjects, learningStyle, goal }) {
    return `
Tôi là học sinh lớp ${grade}. Môn học tôi yếu là: ${weakSubjects}.
Tôi thích học theo phong cách: ${learningStyle}.
Mục tiêu của tôi: ${goal}.
Hãy gợi ý cho tôi 3-5 khóa học hoặc chủ đề học tập phù hợp, mỗi khóa học gồm: tiêu đề, mô tả ngắn, cấp độ (cơ bản/nâng cao), lý do phù hợp với tôi.
Trả về kết quả dạng JSON array, ví dụ:
[
  {
    "title": "...",
    "description": "...",
    "link": "...",
    "level": "...",
    "reason": "..."
  }
]
    `.trim();
}

// API nhận form, gọi Gemini, trả về danh sách khóa học
const suggestLearningPath = async (req, res) => {
    try {
        const prompt = buildPrompt(req.body);

        const geminiRes = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBJSBYNkRyHMHUKe8dkdySIaVXZg6MPx4U",
            {
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            }
        );

        // Lấy text trả về từ Gemini
        const text = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Tìm đoạn JSON trong text trả về
        const match = text.match(/\[.*\]/s);
        let courses = [];
        if (match) {
            courses = JSON.parse(match[0]);
        }

        res.json({ courses });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi khi gợi ý lộ trình học tập" });
    }
};

// XÓA hàm uploadFileToStorage không đúng cách và thay thế bằng hàm này
async function uploadToCloudinaryDirect(fileBuffer, options = {}) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'auto',
                folder: 'curricula',
                ...options
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });
}

// Hàm trích xuất nội dung từ file PDF hoặc DOCX
async function extractContentFromFile(fileUrl, fileName) {
    try {
        // Xác định loại file dựa vào đuôi file
        const fileExt = fileName ? fileName.split('.').pop().toLowerCase() :
            fileUrl.split('.').pop().toLowerCase();

        console.log('Đang xử lý file:', fileExt, 'tại URL:', fileUrl);
        // Xử lý file PDF lớn
        if (fileExt === 'pdf') {
            const pdf = require('pdf-parse');
            const axios = require('axios');

            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 60000 // Tăng timeout lên 60 giây cho file lớn
            });

            const buffer = Buffer.from(response.data);

            // Tùy chọn cho PDF lớn
            const options = {
                max: 150, // Cho phép tối đa 150 trang
                pagerender: function (pageData) {
                    // Chỉ trích xuất text, bỏ qua hình ảnh để tăng tốc
                    return pageData.getTextContent()
                        .then(function (textContent) {
                            let text = "";
                            textContent.items.forEach(item => {
                                text += item.str + " ";
                            });
                            return text;
                        });
                }
            };

            console.log("Đang trích xuất nội dung PDF...");
            const data = await pdf(buffer, options);
            console.log(`Đã trích xuất xong ${data.numpages} trang PDF`);
            return data.text;
        }
        // Xử lý file DOCX lớn
        else if (fileExt === 'docx' || fileExt === 'doc') {
            const mammoth = require('mammoth');
            const axios = require('axios');

            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 60000
            });

            const buffer = Buffer.from(response.data);

            console.log("Đang trích xuất nội dung DOCX...");

            // Tùy chọn cho file Word lớn
            const options = {
                convertImage: mammoth.images.dataUri,
                includeDefaultStyleMap: true,
                ignoreEmptyParagraphs: true,
                styleMap: [
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Title'] => h1:fresh"
                ]
            };

            const result = await mammoth.extractRawText({ buffer }, options);
            console.log("Đã trích xuất xong nội dung DOCX");
            return result.value;
        }
        // Xử lý các định dạng khác
        else {
            try {
                const response = await axios.get(fileUrl, { timeout: 30000 });
                return typeof response.data === 'string' ? response.data : "Không phải là nội dung văn bản.";
            } catch (error) {
                console.error("Lỗi khi đọc file:", error);
                return "Không thể đọc nội dung file. Định dạng không được hỗ trợ.";
            }
        }
    } catch (error) {
        console.error("Lỗi khi trích xuất nội dung:", error);
        return "Không thể trích xuất nội dung file. Chi tiết lỗi: " + error.message;
    }
}
// Thêm middleware để lưu buffer file
const fileBufferMiddleware = (req, res, next) => {
    const originalMulter = multer({ storage: multer.memoryStorage() }).single('file');

    originalMulter(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return next();

        // Lưu buffer trước khi tiếp tục
        const fileBuffer = req.file.buffer;

        try {
            // Thực hiện upload lên Cloudinary
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'curricula',
                        resource_type: 'auto',
                        access_mode: 'public'
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );

                // Stream buffer lên Cloudinary
                streamifier.createReadStream(fileBuffer).pipe(uploadStream);
            });

            // Cập nhật thông tin file sau khi upload
            req.file.path = result.secure_url;
            req.file.fileBuffer = fileBuffer; // Lưu buffer để xử lý sau này

            next();
        } catch (error) {
            next(error);
        }
    });
};
// controllers/curriculum.js

// API Upload giáo án
const uploadCurriculum = async (req, res) => {
    try {
        console.log(req.body);
        // Lấy dữ liệu từ form
        const { title, description, subject, grade } = req.body;
        // Kiểm tra file upload - req.file đã có từ middleware
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Không tìm thấy file. Vui lòng upload file giáo án."
            });
        }
        console.log("File đã upload:", {
            path: req.file.path,
            filename: req.file.originalname,
            mimetype: req.file.mimetype
        });

        // trích uất nội dung tư file
        let content = "";
        let tempFilePath = "";
        if (req.fileBuffer) {
            try {
                // Tải file từ Cloudinary về máy chủ tạm thời
                tempFilePath = path.join(os.tmpdir(), req.file.originalname);
                const axios = require('axios');

                const response = await axios.get(req.file.path, {
                    responseType: 'arraybuffer',
                    timeout: 60000
                });

                fs.writeFileSync(tempFilePath, Buffer.from(response.data));
                console.log(`Đã lưu file tạm tại: ${tempFilePath}`);

                // Trích xuất nội dung từ file tạm
                const fileExt = req.file.originalname.split('.').pop().toLowerCase();

                if (fileExt === 'pdf') {
                    const pdf = require('pdf-parse');
                    const fileBuffer = fs.readFileSync(tempFilePath);
                    const data = await pdf(fileBuffer);
                    content = data.text;
                }
                else if (fileExt === 'docx' || fileExt === 'doc') {
                    const mammoth = require('mammoth');
                    const fileBuffer = fs.readFileSync(tempFilePath);
                    const result = await mammoth.extractRawText({ buffer: fileBuffer });
                    content = result.value;
                }
            } catch (extractErr) {
                console.error("Lỗi khi trích xuất nội dung:", extractErr);
                content = "Không thể trích xuất nội dung từ file.";
            } finally {
                // Xóa file tạm nếu tồn tại
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log(`Đã xóa file tạm: ${tempFilePath}`);
                }
            }
        } else {
            // Dùng phương thức cũ nếu không có buffer
            try {
                content = await extractContentFromFile(req.file.path, req.file.originalname);
            } catch (extractErr) {
                console.error("Lỗi khi trích xuất nội dung:", extractErr);
                content = "Không thể trích xuất nội dung từ file.";
            }
        }
        // Log thông tin file để debug
        console.log("File đã upload:", {
            path: req.file.path,
            filename: req.file.originalname,
            mimetype: req.file.mimetype
        });

        // Tạo record trong database
        const curriculum = await Curriculum.create({
            title: title || req.file.originalname,
            description,
            subject,
            grade: Number(grade) || 1,
            content: content || "Không thể trích xuất nội dung từ file.",
            fileUrl: req.file.path, // URL từ Cloudinary
            fileName: req.file.originalname,
            fileType: req.file.mimetype
        });

        // Trả về kết quả thành công
        res.status(201).json({
            success: true,
            message: "Upload giáo án thành công",
            data: {
                id: curriculum._id,
                title: curriculum.title,
                fileUrl: curriculum.fileUrl
            }
        });

    } catch (err) {
        console.error("Lỗi khi upload giáo án:", err);
        res.status(500).json({
            success: false,
            message: "Không thể tải lên giáo án",
            error: err.message
        });
    }
};
// API endpoint trả về dữ liệu slide dạng JSON
const getSlidesData = async (req, res) => {
    try {
        const { slideId } = req.params;

        // Tìm slide theo ID
        const slide = await Slide.findById(slideId);
        if (!slide) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy slide'
            });
        }
        // Clone content để không ảnh hưởng DB
        const content = JSON.parse(JSON.stringify(slide.content));

        // Gán id cho từng exercise
        let exerciseIdMap = {};
        if (Array.isArray(content.exercises)) {
            content.exercises = content.exercises.map((ex, idx) => {
                const exId = ex.id || `ex_${slideId}_${idx + 1}`;
                exerciseIdMap[idx] = exId;
                return {
                    ...ex,
                    id: exId
                };
            });
        }

        // Gán id cho từng slide và gán exerciseId nếu là slide exercise
        if (Array.isArray(content.slides)) {
            content.slides = content.slides.map((s, idx) => {
                const newId = s.id || `slide_${slideId}_${idx + 1}`;
                let slideObj = { ...s, id: newId };
                if (s.type === 'exercise') {
                    // Gán exerciseId theo thứ tự nếu có exercise tương ứng
                    if (content.exercises && content.exercises[idx]) {
                        slideObj.exerciseId = content.exercises[idx].id;
                    }
                }
                return slideObj;
            });
        }

        // Gán id cho từng quiz
        if (Array.isArray(content.quizzes)) {
            content.quizzes = content.quizzes.map((qz, idx) => ({
                ...qz,
                id: qz.id || `quiz_${slideId}_${idx + 1}`
            }));
        }
        // Trả về dữ liệu slide dạng JSON
        res.json({
            success: true,
            slides: content
        });

    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu slide:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra: ' + error.message
        });
    }
};

// Thêm API endpoint để tạo lộ trình học từ giáo án đã upload
const createLearningPath = async (req, res) => {
    try {
        const { curriculumId } = req.body;

        // Tìm giáo án trong DB
        const curriculum = await Curriculum.findById(curriculumId);
        if (!curriculum) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giáo án"
            });
        }

        // Kiểm tra nếu đã có lộ trình học cho giáo án này
        const existingPath = await LearningPath.findOne({ curriculumId });
        if (existingPath) {
            return res.status(200).json({
                success: true,
                message: "Lộ trình học đã tồn tại",
                data: existingPath
            });
        }

        // Gọi Gemini để tạo lộ trình
        const learningPath = await generateLearningPath(curriculum);

        res.status(201).json({
            success: true,
            message: "Đã tạo lộ trình học thành công",
            data: learningPath
        });

    } catch (err) {
        console.error("Lỗi khi tạo lộ trình học:", err);
        res.status(500).json({
            success: false,
            message: "Không thể tạo lộ trình học",
            error: err.message
        });
    }
};
// Cập nhật hàm generateLearningPath để xử lý nội dung lớn
async function generateLearningPath(curriculum) {
    try {
        // Giới hạn độ dài nội dung gửi cho Gemini
        const MAX_CONTENT_LENGTH = 12000;

        // Chuẩn bị nội dung
        let content = curriculum.content || "";

        // Nếu nội dung quá dài, cần cắt ngắn
        if (content.length > MAX_CONTENT_LENGTH) {
            console.log(`Nội dung giáo án quá dài (${content.length} ký tự), đang cắt ngắn...`);

            // Trích xuất các phần quan trọng
            const sections = extractSectionsFromContent(content);

            // Tạo tóm tắt từ các phần
            const introduction = sections[0]?.substring(0, MAX_CONTENT_LENGTH * 0.2) || "";

            // Lấy một số phần giữa
            let middleParts = "";
            const middleSections = sections.slice(1, Math.min(6, sections.length - 1));
            for (const section of middleSections) {
                const excerpt = section.substring(0, MAX_CONTENT_LENGTH * 0.1);
                middleParts += excerpt + "\n\n...";
            }

            // Lấy phần cuối
            const conclusion = sections[sections.length - 1]?.substring(0, MAX_CONTENT_LENGTH * 0.2) || "";

            // Kết hợp các phần
            content = `${introduction}\n\n... [Nội dung được tóm tắt] ...\n\n${middleParts}\n\n... [Nội dung được tóm tắt] ...\n\n${conclusion}`;

            // Đảm bảo không vượt quá giới hạn
            content = content.substring(0, MAX_CONTENT_LENGTH);

            console.log(`Đã cắt ngắn nội dung còn ${content.length} ký tự.`);
        }

        // Chuẩn bị prompt cho Gemini
        const prompt = `
        Phân tích giáo án sau và tạo lộ trình học chi tiết theo ngày và buổi:
        
        Tiêu đề: ${curriculum.title}
        Môn học: ${curriculum.subject}
        Lớp: ${curriculum.grade}
        
        Nội dung giáo án:
        ${content}
        
        Hãy tạo lộ trình học với các bài học theo ngày và buổi, mỗi bài học bao gồm: 
        tiêu đề, mô tả, nội dung, thời lượng (phút), và 2-3 câu hỏi trắc nghiệm để đánh giá.
        
        Trả về kết quả dạng JSON như sau:
        {
          "title": "Tên lộ trình học",
          "lessons": [
            {
              "title": "Tiêu đề bài học",
              "description": "Mô tả ngắn",
              "content": "Nội dung chi tiết",
              "duration": 45,
              "day": 1,
              "session": "Sáng",
              "resources": ["Link tài liệu 1", "Link tài liệu 2"],
              "quiz": [
                {
                  "question": "Câu hỏi?",
                  "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
                  "answer": 2
                }
              ]
            }
          ]
        }
      `;

        // Gọi Gemini API với timeout dài hơn
        console.log("Đang gọi Gemini API...");
        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
            {
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": "AIzaSyBJSBYNkRyHMHUKe8dkdySIaVXZg6MPx4U"
                },
                timeout: 45000 // Tăng timeout lên 45 giây
            }
        );

        // Xử lý kết quả từ Gemini
        const text = response.data.candidates[0].content.parts[0].text;
        const match = text.match(/```json\n([\s\S]*)\n```/) || text.match(/\{[\s\S]*\}/);

        let learningPathData;
        try {
            learningPathData = JSON.parse(match ? match[1] || match[0] : text);
        } catch (e) {
            console.error("Không thể parse JSON từ Gemini:", e);
            learningPathData = {
                title: `Lộ trình học ${curriculum.subject} lớp ${curriculum.grade}`,
                lessons: createDefaultLessons(curriculum)
            };
        }

        // Lưu lộ trình học vào DB
        const learningPath = await LearningPath.create({
            curriculumId: curriculum._id,
            title: learningPathData.title,
            lessons: learningPathData.lessons
        });

        return learningPath;
    } catch (error) {
        console.error("Lỗi khi tạo lộ trình học:", error);

        // Tạo lộ trình mặc định nếu có lỗi
        const defaultLessons = createDefaultLessons(curriculum);

        const defaultPath = await LearningPath.create({
            curriculumId: curriculum._id,
            title: `Lộ trình học ${curriculum.subject} lớp ${curriculum.grade}`,
            lessons: defaultLessons
        });

        return defaultPath;
    }
}

// Thêm hàm tạo bài học mặc định
function createDefaultLessons(curriculum) {
    const defaultLessons = [];
    const totalDays = 5;

    // Các chủ đề phổ biến theo môn học
    const subjectTopics = {
        "Toán": ["Số học", "Đại số", "Hình học", "Ôn tập"],
        "Tiếng Việt": ["Từ vựng", "Ngữ pháp", "Đọc hiểu", "Tập làm văn"],
        "Tiếng Anh": ["Vocabulary", "Grammar", "Reading", "Speaking"],
        "Khoa học": ["Vật lý", "Hóa học", "Sinh học", "Thí nghiệm"]
    };

    const topics = subjectTopics[curriculum.subject] || ["Phần 1", "Phần 2", "Phần 3", "Phần 4"];

    // Tạo 4 bài học mặc định
    for (let i = 0; i < 4; i++) {
        defaultLessons.push({
            title: `Bài ${i + 1}: ${topics[i]}`,
            description: `Giới thiệu về ${topics[i]} cho học sinh lớp ${curriculum.grade}`,
            content: `Nội dung chi tiết sẽ được cập nhật sau. Đây là bài học về ${topics[i]} cho học sinh lớp ${curriculum.grade}.`,
            duration: 45,
            day: Math.ceil((i + 1) / 2),
            session: i % 2 === 0 ? "Sáng" : "Chiều",
            resources: ["https://hocmai.vn", "https://vietjack.com"],
            quiz: [
                {
                    question: `Câu hỏi về ${topics[i]}?`,
                    options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
                    answer: 0
                },
                {
                    question: `Câu hỏi 2 về ${topics[i]}?`,
                    options: ["Lựa chọn 1", "Lựa chọn 2", "Lựa chọn 3", "Lựa chọn 4"],
                    answer: 1
                }
            ]
        });
    }

    return defaultLessons;
}

// Hàm gọi Gemini để tạo lộ trình
async function generateLearningPath(curriculum) {
    // Chuẩn bị prompt cho Gemini
    const prompt = `
    Phân tích giáo án sau và tạo lộ trình học chi tiết theo ngày và buổi:
    
    Tiêu đề: ${curriculum.title}
    Môn học: ${curriculum.subject}
    Lớp: ${curriculum.grade}
    
    Nội dung giáo án:
    ${curriculum.content}
    
    Hãy tạo lộ trình học với các bài học theo ngày và buổi, mỗi bài học bao gồm: 
    tiêu đề, mô tả, nội dung, thời lượng (phút), và 2-3 câu hỏi trắc nghiệm để đánh giá.
    
    Trả về kết quả dạng JSON như sau:
    {
      "title": "Tên lộ trình học",
      "lessons": [
        {
          "title": "Tiêu đề bài học",
          "description": "Mô tả ngắn",
          "content": "Nội dung chi tiết",
          "duration": 45,
          "day": 1,
          "session": "Sáng",
          "resources": ["Link tài liệu 1", "Link tài liệu 2"],
          "quiz": [
            {
              "question": "Câu hỏi?",
              "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
              "answer": 2
            }
          ]
        }
      ]
    }
  `;

    // Gọi Gemini API
    const response = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
        {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        },
        {
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": "AIzaSyBJSBYNkRyHMHUKe8dkdySIaVXZg6MPx4U"
            }
        }
    );

    // Xử lý kết quả từ Gemini
    const text = response.data.candidates[0].content.parts[0].text;
    const match = text.match(/```json\n([\s\S]*)\n```/) || text.match(/\{[\s\S]*\}/);

    let learningPathData;
    try {
        learningPathData = JSON.parse(match ? match[1] || match[0] : text);
    } catch (e) {
        console.error("Không thể parse JSON từ Gemini:", e);
        learningPathData = { title: curriculum.title, lessons: [] };
    }

    // Lưu lộ trình học vào DB
    const learningPath = await LearningPath.create({
        curriculumId: curriculum._id,
        title: learningPathData.title,
        lessons: learningPathData.lessons
    });

    return learningPath;
}
// controllers/progress.js

// API Cập nhật tiến độ khi hoàn thành bài học
const updateProgress = async (req, res) => {
    try {
        const { slideId, completedSlides = [], completedExercises = [], completedQuizzes = [], userId = "guest" } = req.body;

        let progress = await Progress.findOne({ userId, slideId });
        if (!progress) {
            progress = new Progress({ userId, slideId });
        }

        // Cập nhật các trường
        progress.completedSlides = completedSlides;
        progress.completedExercises = completedExercises;
        progress.completedQuizzes = completedQuizzes;

        // Lấy tổng số slide, bài tập, quiz
        const slide = await Slide.findById(slideId);
        const totalSlides = slide.content.slides.length;
        const totalExercises = slide.content.exercises?.length || 0;
        const totalQuizzes = slide.content.quizzes?.length || 0;

        const totalItems = totalSlides + totalExercises + totalQuizzes;
        const completedItems = completedSlides.length + completedExercises.length + completedQuizzes.length;

        progress.overallProgress = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
        progress.lastActivity = new Date();

        await progress.save();

        res.json({ success: true, progress });
    } catch (err) {
        console.log("Lỗi khi cập nhật tiến độ:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// API Lưu kết quả bài kiểm tra
const submitQuiz = async (req, res) => {
    try {
        const { learningPathId, lessonIndex, answers } = req.body;
        const userId = req.user.id;

        // Lấy câu hỏi và đáp án chính xác
        const learningPath = await LearningPath.findById(learningPathId);
        const lesson = learningPath.lessons[lessonIndex];
        const correctAnswers = lesson.quiz.map(q => q.answer);

        // Tính điểm
        let score = 0;
        answers.forEach((answer, index) => {
            if (answer === correctAnswers[index]) {
                score++;
            }
        });
        const finalScore = Math.round((score / correctAnswers.length) * 100);

        // Cập nhật tiến độ
        const progress = await Progress.findOne({ userId, learningPathId });

        // Thêm kết quả bài kiểm tra
        progress.quizResults.push({
            lessonIndex,
            score: finalScore,
            answers,
            completedAt: new Date()
        });

        await progress.save();

        res.status(200).json({
            success: true,
            data: { score: finalScore, correctAnswers }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Cập nhật hàm generateImageFromPrompt
async function generateImageFromPrompt(prompt, slideIndex, retryCount = 0) {
    try {
        console.log(`Đang tạo hình ảnh cho slide ${slideIndex + 1} với prompt: "${prompt}"`);

        // Cải thiện prompt cho phù hợp với nội dung giáo dục
        const enhancedPrompt = `${prompt}, phong cách giáo dục, đơn giản, màu sắc tươi sáng, phù hợp cho trẻ em`;

        // Sử dụng hàm từ file cấu hình Google GenAI
        const imageBase64 = await genAIImageGenerator(enhancedPrompt);

        // Chuyển đổi base64 thành buffer để tải lên Cloudinary
        const buffer = Buffer.from(imageBase64, 'base64');

        console.log(`✅ Đã nhận được hình ảnh từ Google GenAI, đang tải lên Cloudinary...`);

        // Upload lên Cloudinary để lưu trữ lâu dài
        const cloudinaryUrl = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'slide-images',
                    resource_type: 'image'
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result.secure_url);
                    }
                }
            );

            streamifier.createReadStream(buffer).pipe(uploadStream);
        });

        console.log(`✓ Đã tạo và lưu hình ảnh cho slide ${slideIndex + 1}`);
        return cloudinaryUrl;
    } catch (error) {
        console.error(`❌ Lỗi khi tạo hình ảnh cho slide ${slideIndex + 1}:`, error.message);

        // Thử lại với prompt đơn giản hơn nếu là lần đầu gặp lỗi
        if (retryCount < 1) {
            console.log(`⏳ Thử lại với prompt đơn giản hơn...`);
            // Đơn giản hóa prompt, chỉ lấy phần đầu
            const simplifiedPrompt = prompt.split(',')[0] + ", educational image";

            // Đợi 2 giây trước khi thử lại
            await new Promise(resolve => setTimeout(resolve, 2000));
            return generateImageFromPrompt(simplifiedPrompt, slideIndex, retryCount + 1);
        }

        // Nếu vẫn lỗi, sử dụng hình ảnh placeholder
        console.log(`⚠️ Không thể tạo hình ảnh, sử dụng hình ảnh placeholder cho slide ${slideIndex + 1}`);
        return `https://via.placeholder.com/800x600/3498db/ffffff?text=Slide+${slideIndex + 1}`;
    }
}

// Không cần thay đổi hàm startCanvaImageGeneration, nó sẽ gọi hàm generateImageFromPrompt đã cập nhật

// Cập nhật hàm startCanvaImageGeneration để sử dụng OpenAI
async function startCanvaImageGeneration(slideId) {
    try {
        // Tìm slide trong database
        const slide = await Slide.findById(slideId);
        if (!slide) {
            console.error("Không tìm thấy slide với ID:", slideId);
            return;
        }


        // Kiểm tra OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
            console.error("Thiếu OpenAI API key trong biến môi trường");
            slide.imageGenerationStatus = "failed";
            await slide.save();
            return;
        }

        // Kiểm tra kết nối với OpenAI
        try {
            console.log("Kiểm tra kết nối OpenAI...");
            await openai.models.list();
            console.log("Kết nối OpenAI thành công");
        } catch (error) {
            console.error("Không thể kết nối đến OpenAI:", error);
            slide.imageGenerationStatus = "failed";
            await slide.save();
            return;
        }

        // Cập nhật trạng thái slide
        slide.imageGenerationStatus = "processing";
        await slide.save();

        // Ghi log bắt đầu quá trình
        console.log(`Bắt đầu tạo hình ảnh cho ${slide.content.slides.length} slide`);

        // Giới hạn số lượng slide được tạo hình ảnh để tiết kiệm chi phí
        const MAX_IMAGES = 10; // Giới hạn số lượng hình ảnh được tạo
        const slidesToProcess = Math.min(slide.content.slides.length, MAX_IMAGES);

        console.log(`Sẽ tạo hình ảnh cho ${slidesToProcess}/${slide.content.slides.length} slide`);

        // Xử lý tuần tự để tránh vượt quá giới hạn API rate
        for (let i = 0; i < slidesToProcess; i++) {
            const currentSlide = slide.content.slides[i];

            // Bỏ qua nếu không có prompt hoặc đã có hình ảnh
            if (!currentSlide.imagePrompt || currentSlide.imageUrl) {
                console.log(`Bỏ qua slide ${i + 1}: ${!currentSlide.imagePrompt ? 'Không có prompt' : 'Đã có hình ảnh'}`);
                continue;
            }

            try {
                // Tạo hình ảnh
                const imageUrl = await generateImageFromPrompt(currentSlide.imagePrompt, i);

                // Lưu URL hình ảnh vào slide
                if (imageUrl) {
                    slide.content.slides[i].imageUrl = imageUrl;
                    // Lưu sau mỗi hình ảnh để tránh mất dữ liệu nếu có lỗi
                    await slide.save();
                }

                // Đợi lâu hơn để tránh rate limit (tối thiểu 6 giây giữa các yêu cầu)
                await new Promise(resolve => setTimeout(resolve, 6000));
            } catch (error) {
                console.error(`Lỗi khi tạo hình ảnh cho slide ${i + 1}:`, error);
                // Tiếp tục với slide tiếp theo nếu có lỗi
            }
        }

        // Cập nhật trạng thái và lưu vào database
        slide.imageGenerationStatus = "completed";
        await slide.save();

        console.log(`Đã hoàn thành việc tạo hình ảnh cho slide`);
    } catch (error) {
        console.error("Lỗi khi tạo hình ảnh tự động:", error);
    }
}

// Thêm API endpoint để kiểm tra trạng thái tạo hình ảnh
const checkImageGenerationStatus = async (req, res) => {
    try {
        const { slideId } = req.params;

        // Tìm slide theo ID
        const slide = await Slide.findById(slideId);
        if (!slide) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy slide"
            });
        }

        // Đếm số lượng hình ảnh đã tạo
        const totalSlides = slide.content.slides.length;
        let completedImages = 0;

        slide.content.slides.forEach(slideItem => {
            if (slideItem.imageUrl) completedImages++;
        });

        // Trả về thông tin trạng thái
        res.status(200).json({
            success: true,
            status: slide.imageGenerationStatus,
            progress: {
                total: totalSlides,
                completed: completedImages,
                percentage: Math.round((completedImages / totalSlides) * 100)
            }
        });

    } catch (error) {
        console.error("Lỗi khi kiểm tra trạng thái tạo hình ảnh:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// // Thêm API endpoint để tạo slide từ giáo án - giuex ngiuen 
const createSlidesFromCurriculum = async (req, res) => {
    try {
        const { curriculumId } = req.body;

        if (!curriculumId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu curriculumId"
            });
        }

        // Tìm giáo án trong database
        const curriculum = await Curriculum.findById(curriculumId);
        if (!curriculum) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giáo án với ID cung cấp"
            });
        }

        // Gọi hàm tạo slides
        console.log("Bắt đầu tạo slide từ giáo án với ID:", curriculumId);
        const slidesContent = await generateSlidesFromCurriculum(curriculum);

        // Lưu kết quả vào database
        const slide = new Slide({
            curriculumId,
            title: slidesContent.title,
            content: slidesContent
        });

        await slide.save();

        // Trả về kết quả
        res.status(200).json({
            success: true,
            message: "Đã tạo slide thành công",
            data: slidesContent,
            slideId: slide._id
        });

    } catch (err) {
        console.error("Lỗi khi tạo slides:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
// Thêm API endpoint để tạo slide từ giáo án

// API endpoint để xem slide
const viewSlides = async (req, res) => {
    try {
        const { slideId } = req.params;
        console.log("Yêu cầu xem slide với ID:", slideId);

        // Tìm slide theo ID
        const slide = await Slide.findById(slideId);
        if (!slide) {
            return res.status(404).send('Không tìm thấy slide');
        }

        // Render trang xem slide
        res.render('slides-viewer', { slides: slide.content });

    } catch (error) {
        console.error('Lỗi khi hiển thị slide:', error);
        res.status(500).send('Có lỗi xảy ra: ' + error.message);
    }
};

// Hàm tạo slides từ nội dung giáo trình - giũ nguyên 
async function generateSlidesFromCurriculum(curriculum) {
    try {
        // Xử lý và chia nhỏ nội dung giáo trình
        const sections = extractSectionsFromContent(curriculum.content);



        const prompt = `
        Hãy đọc kĩ giáo án của tôi và tạo ra các bài giảng, bài học, bài tập để học sinh có thể luyện tập thật tốt.

        Thông tin giáo án:
        Tiêu đề: ${curriculum.title}
        Môn học: ${curriculum.subject}
        Lớp: ${curriculum.grade}

        Nội dung giáo án chi tiết:
        ${sections.slice(0, 5).map((section, i) =>
            `[Phần ${i + 1}]: ${section.substring(0, 300)}...`
        ).join('\n\n')}
        ${sections.length > 5 ? `\n\n... và ${sections.length - 5} phần khác` : ''}

        Yêu cầu:
        1. Phân tích kỹ nội dung giáo án và tạo một bộ tài liệu dạy học hoàn chỉnh
        2. Tạo 10-15 slide với nội dung chi tiết, trực quan và sinh động
        3. Mỗi slide phải bao gồm:
           - Tiêu đề rõ ràng
           - Nội dung cốt lõi, dễ hiểu, phù hợp với lứa tuổi học sinh lớp ${curriculum.grade}
           - Ví dụ minh họa cụ thể
        4. Bổ sung 3-5 bài tập thực hành sau mỗi phần kiến thức
        5. Thêm 5-7 câu hỏi trắc nghiệm có đáp án để học sinh tự kiểm tra
        6. Đề xuất 2-3 hoạt động nhóm để học sinh thảo luận và ứng dụng kiến thức

        Trả về kết quả dạng JSON với cấu trúc:
        {
          "title": "Tên bộ bài giảng",
          "subjectGrade": "Môn học - Lớp",
          "slides": [
            {
              "type": "title | content | exercise | activity | quiz | summary",
              "title": "Tiêu đề slide",
              "content": ["Nội dung 1", "Nội dung 2", "Nội dung 3"],
              "imagePrompt": "Mô tả hình ảnh minh họa cho slide này"
            }
          ],
          "exercises": [
            {
              "title": "Tên bài tập",
              "description": "Mô tả chi tiết bài tập",
              "questions": ["Câu hỏi 1", "Câu hỏi 2"],
              "answers": ["Đáp án 1", "Đáp án 2"]
            }
          ],
          "quizzes": [
            {
              "question": "Câu hỏi trắc nghiệm",
              "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
              "correctOption": 0
            }
          ]
        }`;

        // Gọi đến API để tạo slide
        try {
            console.log("Đang gửi prompt đến API...");

            // Sử dụng axios để gọi API trực tiếp thay vì sendMessage
            const response = await axios.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
                {
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: prompt }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                        topP: 0.9
                    }
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": process.env.GOOGLE_GENAI_API_KEY || "AIzaSyBJSBYNkRyHMHUKe8dkdySIaVXZg6MPx4U"
                    },
                    timeout: 60000 // 60 giây timeout để xử lý yêu cầu lớn
                }
            );

            // Xử lý kết quả từ API
            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Không nhận được phản hồi hợp lệ từ API");
            }

            // Tìm và parse JSON từ kết quả trả về
            let slidesData;
            try {
                // Tìm chuỗi JSON trong phản hồi
                const jsonMatch = text.match(/```json\n([\s\S]*)\n```/) ||
                    text.match(/```\n([\s\S]*)\n```/) ||
                    text.match(/\{[\s\S]*\}/);

                const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
                slidesData = JSON.parse(jsonStr);

                console.log("Đã parse JSON thành công từ phản hồi API");

                return slidesData;
            } catch (parseError) {
                console.error("Không thể parse JSON từ phản hồi:", parseError);
                console.log("Phản hồi thô từ API:", text.substring(0, 500) + "...");
                throw new Error("Lỗi khi parse dữ liệu JSON từ phản hồi API");
            }
        } catch (apiError) {
            console.error("Lỗi khi gọi API:", apiError.message);
            if (apiError.response) {
                console.error("Chi tiết lỗi:", apiError.response.status, apiError.response.statusText);
                console.error("Thông tin phản hồi:", apiError.response.data);
            }
            // Sử dụng slides mặc định nếu API gặp lỗi
            console.log("Sử dụng mẫu slides mặc định...");
            return createDefaultSlides(curriculum);
        }
    } catch (error) {
        console.error("Lỗi khi tạo slides từ giáo án:", error.message);
    }

}
// Thêm import cho Vertex AI


// API lấy danh sách tất cả slide
const getAllSlides = async (req, res) => {
    try {
        // Lấy tham số truy vấn (không bắt buộc)
        const { page = 1, limit = 10, subject, grade } = req.query;

        // Tạo điều kiện tìm kiếm
        const query = {};

        // Thêm lọc theo môn học nếu có
        if (subject) {
            // Tìm các curricula có subject tương ứng
            const curricula = await Curriculum.find({ subject });
            const curriculaIds = curricula.map(curr => curr._id);
            query.curriculumId = { $in: curriculaIds };
        }

        // Thực hiện truy vấn với phân trang
        const slides = await Slide.find(query)
            .populate('curriculumId', 'title subject grade') // Lấy thông tin giáo án liên quan
            .sort({ createdAt: -1 }) // Sắp xếp mới nhất trước
            .skip((page - 1) * limit)
            .limit(Number(limit));

        // Đếm tổng số slide
        const total = await Slide.countDocuments(query);

        // Trả về kết quả
        res.status(200).json({
            success: true,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            slides: slides.map(slide => ({
                id: slide._id,
                title: slide.title,
                subject: slide.curriculumId?.subject || 'Không xác định',
                grade: slide.curriculumId?.grade || 'Không xác định',
                slideCount: slide.content?.slides?.length || 0,
                createdAt: slide.createdAt
            }))
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách slide:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách slide",
            error: error.message
        });
    }
};


// Hàm tạo slides mặc định khi API gặp lỗi
function createDefaultSlides(curriculum) {
    return {
        title: curriculum.title || "Bài giảng",
        subjectGrade: `${curriculum.subject || "Môn học"} - Lớp ${curriculum.grade || ""}`,
        slides: [
            {
                type: "title",
                title: curriculum.title || "Bài giảng",
                content: [`${curriculum.subject || "Môn học"} - Lớp ${curriculum.grade || ""}`]
            },
            {
                type: "content",
                title: "Mục tiêu bài học",
                content: [
                    "Hiểu được kiến thức cơ bản về chủ đề",
                    "Phát triển kỹ năng liên quan",
                    "Ứng dụng kiến thức vào thực tế"
                ]
            },
            {
                type: "content",
                title: "Nội dung chính",
                content: [
                    "Phần 1: Giới thiệu tổng quan",
                    "Phần 2: Kiến thức cơ bản",
                    "Phần 3: Ứng dụng thực tiễn"
                ]
            },
            {
                type: "summary",
                title: "Tổng kết",
                content: [
                    "Kiến thức quan trọng đã học",
                    "Các ứng dụng thực tiễn",
                    "Kết nối với bài học tiếp theo"
                ]
            },
            {
                type: "activity",
                title: "Hoạt động thực hành",
                content: [
                    "Bài tập 1: Tự luyện tập",
                    "Bài tập 2: Thảo luận nhóm",
                    "Câu hỏi thảo luận: ..."
                ]
            }
        ]
    };
}

// Hàm chia nhỏ nội dung thành các phần
function extractSectionsFromContent(content) {
    if (!content || typeof content !== 'string') {
        return ["Không có nội dung"];
    }

    // Tìm các tiêu đề, đoạn văn lớn
    const headingRegex = /(?:CHƯƠNG|PHẦN|UNIT|Chapter|Part|Bài\s*\d+)[^\n]{0,50}|(?:^|\n)#{1,3}\s+[^\n]+|\n[A-Z\d\s.,]{10,60}\n/gi;
    const headingMatches = [...content.matchAll(headingRegex)];

    const sections = [];

    if (headingMatches.length <= 2) {
        // Nếu không tìm được nhiều tiêu đề, chia theo đoạn văn
        const paragraphs = content.split(/\n\s*\n/);
        const chunkSize = 5; // Gộp 5 đoạn văn vào một phần

        for (let i = 0; i < paragraphs.length; i += chunkSize) {
            const sectionContent = paragraphs.slice(i, i + chunkSize).join('\n\n');
            sections.push(sectionContent);
        }
    } else {
        // Nếu tìm được nhiều tiêu đề, chia theo tiêu đề
        for (let i = 0; i < headingMatches.length; i++) {
            const currentMatch = headingMatches[i];
            const nextMatch = headingMatches[i + 1];

            const startIdx = currentMatch.index;
            const endIdx = nextMatch ? nextMatch.index : content.length;

            const sectionContent = content.substring(startIdx, endIdx).trim();
            sections.push(sectionContent);
        }
    }

    return sections;
}


// const generateCanvaImage = async (req, res) => {
//     try {
//         const { prompt, width = 800, height = 600, style, slideId } = req.body;

//         if (!prompt) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Thiếu prompt để tạo hình ảnh"
//             });
//         }

//         console.log(`Đang tạo hình ảnh Canva với prompt: "${prompt}"`);

//         // Tạo hình ảnh sử dụng Canva API
//         const imageUrl = await createCanvaImage(prompt, width, height, style);

//         // Nếu có slideId, cập nhật URL hình ảnh vào slide
//         if (slideId && mongoose.Types.ObjectId.isValid(slideId)) {
//             const { slideIndex } = req.body;

//             if (slideIndex !== undefined) {
//                 const slide = await Slide.findById(slideId);
//                 if (slide && slide.content.slides[slideIndex]) {
//                     slide.content.slides[slideIndex].imageUrl = imageUrl;
//                     await slide.save();
//                     console.log(`Đã cập nhật hình ảnh cho slide ${slideIndex} của slideId: ${slideId}`);
//                 }
//             }
//         }

//         // Trả về URL hình ảnh đã tạo
//         res.status(200).json({
//             success: true,
//             message: "Đã tạo hình ảnh thành công",
//             data: {
//                 imageUrl: imageUrl
//             }
//         });

//     } catch (err) {
//         console.error("Lỗi khi tạo hình ảnh Canva:", err);
//         res.status(500).json({
//             success: false,
//             message: "Không thể tạo hình ảnh",
//             error: err.message
//         });
//     }
// };

// // Hàm tạo hình ảnh bằng Canva API
// async function createCanvaImage(prompt, width, height, style) {
//     try {
//         // Kiểm tra và lấy Canva API key từ biến môi trường
//         const openaiApiKey = process.env.OPENAI_API_KEY;

//         if (!CANVA_API_KEY) {
//             throw new Error("Thiếu Canva API Key trong biến môi trường");
//         }
//         if (!openaiApiKey) {
//             throw new Error("Thiếu OpenAI API Key trong biến môi trường");
//         }
//         // Chuẩn bị prompt cho hình ảnh giáo dục
//         let enhancedPrompt = prompt;
//         if (style) {
//             enhancedPrompt += `, ${style} style`;
//         } else {
//             enhancedPrompt += ", educational style, clear, colorful, suitable for students";
//         }

//         // Gọi OpenAI API để tạo hình ảnh
//         const response = await axios.post(
//             "https://api.openai.com/v1/images/generations",
//             {
//                 model: "dall-e-3",
//                 prompt: enhancedPrompt,
//                 n: 1,
//                 size: `${width}x${height}`,
//                 quality: "standard",
//                 response_format: "url"
//             },
//             {
//                 headers: {
//                     "Content-Type": "application/json",
//                     "Authorization": `Bearer ${openaiApiKey}`
//                 },
//                 timeout: 30000
//             }
//         );

//         // Lấy URL hình ảnh từ phản hồi
//         const imageUrl = response.data.imageUrl;

//         // Tải hình ảnh từ URL và lưu vào Cloudinary để lưu trữ lâu dài
//         const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
//         const buffer = Buffer.from(imageResponse.data);

//         // Upload lên Cloudinary
//         const cloudinaryUrl = await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.uploader.upload_stream(
//                 {
//                     folder: 'canva-images',
//                     resource_type: 'image'
//                 },
//                 (error, result) => {
//                     if (error) {
//                         reject(error);
//                     } else {
//                         resolve(result.secure_url);
//                     }
//                 }
//             );

//             streamifier.createReadStream(buffer).pipe(uploadStream);
//         });

//         console.log(`Đã tạo và lưu hình ảnh Canva thành công`);
//         return cloudinaryUrl;

//     } catch (error) {
//         console.error("Lỗi khi tạo hình ảnh bằng Canva:", error);

//         // Nếu không tạo được hình ảnh, sử dụng hình ảnh placeholder
//         return `https://via.placeholder.com/${width}x${height}/3498db/ffffff?text=${encodeURIComponent(prompt.substring(0, 20))}`;
//     }
// }

// Controller tạo hình ảnh bằng Google Gemini
const generateGeminiImage = async (req, res) => {
    try {
        const prompt = req.body.prompt || req.query.prompt;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: "Thiếu prompt để tạo hình ảnh"
            });
        }

        console.log(`Đang tạo hình ảnh Gemini cho prompt: "${prompt}"`);

        try {
            // Gọi hàm tạo hình ảnh với Google Gemini
            const imageUrl = await createGeminiImage(prompt);

            // Trả về URL hình ảnh đã tạo
            res.status(200).json({
                success: true,
                imageUrl: imageUrl
            });

        } catch (error) {
            console.error("Lỗi khi tạo hình ảnh Gemini:", error);
            res.status(500).json({
                success: false,
                message: "Không thể tạo hình ảnh",
                error: error.message
            });
        }
    } catch (err) {
        console.error("Lỗi server:", err);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi xử lý yêu cầu"
        });
    }
};

// Hàm helper để tạo hình ảnh bằng Google Gemini (Imagen)
// Hàm helper để tạo hình ảnh bằng Google Gemini (Imagen)
async function createGeminiImage(prompt) {
    try {
        // Lấy API key từ biến môi trường
        const googleApiKey = process.env.GOOGLE_GENAI_API_KEY;

        if (!googleApiKey) {
            throw new Error("Thiếu Google API Key trong biến môi trường");
        }

        // Tạo prompt nâng cao
        const enhancedPrompt = `${prompt}, high quality, detailed, educational, clear image`;

        console.log("Đang gọi Gemini Image API với prompt:", enhancedPrompt.substring(0, 50) + "...");

        // Gọi Google Gemini API với model hỗ trợ tạo hình ảnh
        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-preview-image-generation:generateContent",
            {
                contents: enhancedPrompt,
                config: {
                    responseModalities: ["text", "image"]
                }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": googleApiKey
                },
                timeout: 60000
            }
        );

        // Xử lý phản hồi để lấy dữ liệu hình ảnh
        if (response.data?.candidates?.[0]?.content?.parts) {
            for (const part of response.data.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    // Tìm thấy phần dữ liệu hình ảnh
                    const base64Data = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType || 'image/jpeg';

                    // Tạo URL data cho hình ảnh
                    const dataUrl = `data:${mimeType};base64,${base64Data}`;

                    // Upload hình ảnh lên Cloudinary để lưu trữ lâu dài
                    const buffer = Buffer.from(base64Data, 'base64');
                    const cloudinaryUrl = await uploadToCloudinary(buffer);

                    return cloudinaryUrl || dataUrl;
                }
            }
        }

        throw new Error("Không nhận được dữ liệu hình ảnh từ Gemini API");

    } catch (error) {
        console.error("Lỗi khi gọi Google Image API:", error);

        // Log chi tiết về lỗi
        if (error.response && error.response.data) {
            console.error("Chi tiết lỗi từ Google API:", JSON.stringify(error.response.data));
        }

        // Trả về hình ảnh placeholder nếu có lỗi
        return `https://via.placeholder.com/1024x768/3498db/ffffff?text=${encodeURIComponent(prompt.substring(0, 20))}`;
    }
}

// Hàm hỗ trợ upload lên Cloudinary
async function uploadToCloudinary(buffer) {
    try {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'gemini-images',
                    resource_type: 'image'
                },
                (error, result) => {
                    if (error) {
                        console.error("Lỗi khi upload lên Cloudinary:", error);
                        reject(error);
                    } else {
                        console.log("Đã upload hình ảnh thành công lên Cloudinary");
                        resolve(result.secure_url);
                    }
                }
            );

            streamifier.createReadStream(buffer).pipe(uploadStream);
        });
    } catch (error) {
        console.error("Lỗi khi xử lý upload:", error);
        return null;
    }
}


module.exports = {
    suggestLearningPath,
    uploadCurriculum,
    updateProgress,
    submitQuiz,
    createLearningPath,
    createSlidesFromCurriculum,
    viewSlides,
    getSlidesData,
    checkImageGenerationStatus,
    generateGeminiImage,
    getAllSlides
    // Các function mới thêm:

};