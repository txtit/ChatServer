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
// Đảm bảo cloudinary được cấu hình

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

        // Trả về dữ liệu slide dạng JSON
        res.json({
            success: true,
            slides: slide.content
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
        const { learningPathId, lessonIndex } = req.body;
        const userId = req.user.id;

        // Tìm hoặc tạo progress record
        let progress = await Progress.findOne({ userId, learningPathId });
        if (!progress) {
            progress = await Progress.create({
                userId,
                learningPathId,
                completedLessons: [],
                quizResults: [],
                overallProgress: 0
            });
        }

        // Nếu bài học chưa được đánh dấu hoàn thành
        if (!progress.completedLessons.includes(lessonIndex)) {
            progress.completedLessons.push(lessonIndex);
        }

        // Tính % hoàn thành
        const learningPath = await LearningPath.findById(learningPathId);
        const totalLessons = learningPath.lessons.length;
        progress.overallProgress = Math.round((progress.completedLessons.length / totalLessons) * 100);

        // Cập nhật thời gian hoạt động
        progress.lastActivity = new Date();
        await progress.save();

        res.status(200).json({ success: true, data: progress });
    } catch (err) {
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
// Thêm API endpoint để tạo slide từ giáo án
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
        console.log("Nội dung slide đã tạo:", slidesContent);

        // Lưu kết quả vào database
        const Slide = require('../models/Slide');
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

// Thêm vào controllers/learn.js
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
// Hàm xử lý nội dung giáo trình và tạo slide
// async function generateSlidesFromCurriculum(curriculum) {
//     try {
//         Xử lý và chia nhỏ nội dung giáo trình
//         const sections = extractSectionsFromContent(curriculum.content);

//         Tạo prompt cho Gemini
//         const prompt = `
//         Tôi cần tạo slide giảng dạy cho học sinh từ giáo trình sau:

//         Tiêu đề: ${curriculum.title}
//         Môn học: ${curriculum.subject}
//         Lớp: ${curriculum.grade}

//         Nội dung giáo trình được chia thành các phần chính như sau:
//         ${sections.slice(0, 5).map((section, i) =>
//             `[Phần ${i + 1}]: ${section.substring(0, 200)}...`
//         ).join('\n\n')}
//         ${sections.length > 5 ? `\n\n... và ${sections.length - 5} phần khác` : ''}

//         Hãy tạo một bộ slide đẹp mắt, trực quan để giảng dạy cho học sinh lớp ${curriculum.grade}, bao gồm:

//         1. Slide tiêu đề (tên bài học, môn học)
//         2. Slide mục tiêu bài học (3-5 mục tiêu chính)
//         3. 5-10 slide nội dung (mỗi slide chỉ nên có ít điểm chính, dễ hiểu)
//         4. Slide tổng kết (nhấn mạnh những điểm quan trọng)
//         5. Slide hoạt động (1-2 bài tập nhỏ hoặc câu hỏi thảo luận)

//         Mỗi slide cần ngắn gọn, trực quan, dễ hiểu cho học sinh. Slide nên có ít chữ, nhiều hình ảnh minh họa.

//         Trả về kết quả dạng JSON:
//         {
//           "title": "Tên bộ slide",
//           "subjectGrade": "Môn học - Lớp",
//           "slides": [
//             {
//               "type": "title | content | activity | summary",
//               "title": "Tiêu đề slide",
//               "content": ["Nội dung 1", "Nội dung 2", "Nội dung 3"], 
//               "imagePrompt": "Mô tả về hình ảnh minh họa phù hợp cho slide này"
//             }
//           ]
//         }`;

//         Gọi Gemini API để tạo nội dung slide
//         const response = await axios.post(
//             "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
//             {
//                 contents: [{ role: "user", parts: [{ text: prompt }] }]
//             },
//             {
//                 headers: {
//                     "Content-Type": "application/json",
//                     "x-goog-api-key": "AIzaSyBJSBYNkRyHMHUKe8dkdySIaVXZg6MPx4U"
//                 },
//                 timeout: 30000
//             }
//         );

//         Xử lý kết quả
//         const text = response.data.candidates[0].content.parts[0].text;
//         const match = text.match(/```json\n([\s\S]*)\n```/) || text.match(/\{[\s\S]*\}/);

//         try {
//             const slidesContent = JSON.parse(match ? match[1] || match[0] : text);
//             return slidesContent;
//         } catch (e) {
//             console.error("Không thể parse JSON từ Gemini:", e);
//             return {
//                 title: curriculum.title,
//                 subjectGrade: `${curriculum.subject} - Lớp ${curriculum.grade}`,
//                 slides: [
//                     {
//                         type: "title",
//                         title: curriculum.title,
//                         content: [`${curriculum.subject} - Lớp ${curriculum.grade}`],
//                         imagePrompt: "Hình ảnh liên quan đến chủ đề giáo dục"
//                     }
//                 ]
//             };
//         }
//     } catch (error) {
//         console.error("Lỗi khi tạo slides:", error);
//         throw error;
//     }
// }
// Cập nhật hàm generateSlidesFromCurriculum để sử dụng Cloud API
// async function generateSlidesFromCurriculum(curriculum) {
//     try {
//         // Xử lý và chia nhỏ nội dung giáo trình
//         const sections = extractSectionsFromContent(curriculum.content);

//         // Thử sử dụng Vertex AI từ Google Cloud
//         const { PredictionServiceClient } = require('@google-cloud/aiplatform');
//         const predictionClient = new PredictionServiceClient();

//         // Tạo prompt giống như bạn đã làm
//         const prompt = `
//         Tôi cần tạo slide giảng dạy cho học sinh từ giáo trình sau:

//         Tiêu đề: ${curriculum.title}
//         Môn học: ${curriculum.subject}
//         Lớp: ${curriculum.grade}

//         Nội dung giáo trình được chia thành các phần chính như sau:
//         ${sections.slice(0, 5).map((section, i) =>
//             `[Phần ${i + 1}]: ${section.substring(0, 200)}...`
//         ).join('\n\n')}
//         ${sections.length > 5 ? `\n\n... và ${sections.length - 5} phần khác` : ''}

//         Hãy tạo một bộ slide đẹp mắt, trực quan để giảng dạy cho học sinh lớp ${curriculum.grade}, bao gồm:

//         1. Slide tiêu đề (tên bài học, môn học)
//         2. Slide mục tiêu bài học (3-5 mục tiêu chính)
//         3. 5-10 slide nội dung (mỗi slide chỉ nên có ít điểm chính, dễ hiểu)
//         4. Slide tổng kết (nhấn mạnh những điểm quan trọng)
//         5. Slide hoạt động (1-2 bài tập nhỏ hoặc câu hỏi thảo luận)

//         Trả về kết quả dạng JSON với cấu trúc:
//         {
//           "title": "Tên bộ slide",
//           "subjectGrade": "Môn học - Lớp",
//           "slides": [...]
//         }`;

//         try {
//             // Sử dụng Vertex AI (cần đã cài đặt và xác thực Google Cloud)
//             const projectId = 'AQ.Ab8RN6JFNpiag4DwTQMDoVdhWI5y_cG5w0_bQCXgIZC9-fkuJw'; // Thay đổi theo ID dự án của bạn
//             const location = 'us-central1';
//             const model = 'gemini-1.5-flash';

//             const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${model}`;

//             const request = {
//                 endpoint,
//                 instances: [
//                     {
//                         content: prompt
//                     }
//                 ],
//                 parameters: {
//                     temperature: 0.2,
//                     maxOutputTokens: 1024,
//                     topK: 40,
//                     topP: 0.95,
//                 }
//             };

//             const [response] = await predictionClient.predict(request);
//             const result = response.predictions[0];

//             // Xử lý kết quả trả về
//             const slidesContent = JSON.parse(result.content);
//             return slidesContent;

//         } catch (cloudError) {
//             console.log("Lỗi khi gọi Google Cloud API:", cloudError);

//             // Fallback sang Gemini API hiện tại nếu cloud gặp lỗi
//             const response = await axios.post(
//                 "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
//                 {
//                     contents: [{ role: "user", parts: [{ text: prompt }] }]
//                 },
//                 {
//                     headers: {
//                         "Content-Type": "application/json",
//                         "x-goog-api-key": "AIzaSyBJSBYNkRyHMHUKe8dkdySIaVXZg6MPx4U"
//                     },
//                     timeout: 30000
//                 }
//             );

//             const text = response.data.candidates[0].content.parts[0].text;
//             const match = text.match(/```json\n([\s\S]*)\n```/) || text.match(/\{[\s\S]*\}/);
//             return JSON.parse(match ? match[1] || match[0] : text);
//         }
//     } catch (error) {
//         console.error("Lỗi khi tạo slides:", error);
//         // return createDefaultSlides(curriculum);
//     }
// }



async function generateSlidesFromCurriculum(curriculum) {
    try {
        // Xử lý và chia nhỏ nội dung giáo trình
        const sections = extractSectionsFromContent(curriculum.content);

        // Tạo prompt cho Gemini
        const prompt = `
        Tôi cần tạo slide giảng dạy cho học sinh từ giáo trình sau:

        Tiêu đề: ${curriculum.title}
        Môn học: ${curriculum.subject}
        Lớp: ${curriculum.grade}

        Nội dung giáo trình được chia thành các phần chính như sau:
        ${sections.slice(0, 5).map((section, i) =>
            `[Phần ${i + 1}]: ${section.substring(0, 200)}...`
        ).join('\n\n')}
        ${sections.length > 5 ? `\n\n... và ${sections.length - 5} phần khác` : ''}

        Hãy tạo một bộ slide đẹp mắt, trực quan để giảng dạy cho học sinh lớp ${curriculum.grade}, bao gồm:

        1. Slide tiêu đề (tên bài học, môn học)
        2. Slide mục tiêu bài học (3-5 mục tiêu chính)
        3. 5-10 slide nội dung (mỗi slide chỉ nên có ít điểm chính, dễ hiểu)
        4. Slide tổng kết (nhấn mạnh những điểm quan trọng)
        5. Slide hoạt động (1-2 bài tập nhỏ hoặc câu hỏi thảo luận)

        Trả về kết quả dạng JSON với cấu trúc:
                // Tiếp tục hàm generateSlidesFromCurriculum
                {
                  "title": "Tên bộ slide",
                  "subjectGrade": "Môn học - Lớp",
                  "slides": [
                    {
                      "type": "title | content | activity | summary",
                      "title": "Tiêu đề slide",
                      "content": ["Nội dung 1", "Nội dung 2", "Nội dung 3"], 
                      "imagePrompt": "Mô tả về hình ảnh minh họa phù hợp cho slide này"
                    }
                  ]
                }`;

        // Bỏ qua Vertex AI và sử dụng trực tiếp Gemini API để đơn giản hóa
        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            {
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": "AIzaSyBJSBYNkRyHMHUKe8dkdySIaVXZg6MPx4U"
                },
                timeout: 60000 // Tăng timeout lên 60 giây
            }
        );

        // Xử lý kết quả
        const candidates = response.data.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error("Không nhận được kết quả từ API");
        }

        const text = candidates[0].content.parts[0].text;
        const match = text.match(/```json\n([\s\S]*)\n```/) || text.match(/\{[\s\S]*\}/);

        try {
            const slidesContent = JSON.parse(match ? match[1] || match[0] : text);
            return slidesContent;
        } catch (e) {
            console.error("Không thể parse JSON từ API:", e);
            return createDefaultSlides(curriculum);
        }
    } catch (error) {
        console.error("Lỗi khi tạo slides:", error);
        return createDefaultSlides(curriculum);
    }
}

// Hàm tạo slides mặc định khi API gặp lỗi
function createDefaultSlides(curriculum) {
    return {
        title: curriculum.title || "Bài giảng",
        subjectGrade: `${curriculum.subject || "Môn học"} - Lớp ${curriculum.grade || ""}`,
        slides: [
            {
                type: "title",
                title: curriculum.title || "Bài giảng",
                content: [`${curriculum.subject || "Môn học"} - Lớp ${curriculum.grade || ""}`],
                imagePrompt: "Hình ảnh minh họa về giáo dục và học tập, phù hợp cho trẻ em"
            },
            {
                type: "content",
                title: "Mục tiêu bài học",
                content: [
                    "Hiểu được kiến thức cơ bản về chủ đề",
                    "Phát triển kỹ năng liên quan",
                    "Ứng dụng kiến thức vào thực tế"
                ],
                imagePrompt: "Hình ảnh về mục tiêu học tập, có thể là bảng mục tiêu hoặc học sinh đang học"
            },
            {
                type: "content",
                title: "Nội dung chính",
                content: [
                    "Phần 1: Giới thiệu tổng quan",
                    "Phần 2: Kiến thức cơ bản",
                    "Phần 3: Ứng dụng thực tiễn"
                ],
                imagePrompt: "Hình ảnh minh họa cho nội dung chính của bài học"
            },
            {
                type: "summary",
                title: "Tổng kết",
                content: [
                    "Kiến thức quan trọng đã học",
                    "Các ứng dụng thực tiễn",
                    "Kết nối với bài học tiếp theo"
                ],
                imagePrompt: "Hình ảnh về tổng kết hoặc kết luận bài học"
            },
            {
                type: "activity",
                title: "Hoạt động thực hành",
                content: [
                    "Bài tập 1: Tự luyện tập",
                    "Bài tập 2: Thảo luận nhóm",
                    "Câu hỏi thảo luận: ..."
                ],
                imagePrompt: "Hình ảnh học sinh đang làm bài tập hoặc hoạt động nhóm"
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
            if (sectionContent.trim()) {
                sections.push(sectionContent);
            }
        }
    } else {
        // Nếu có nhiều tiêu đề, chia theo tiêu đề
        for (let i = 0; i < headingMatches.length; i++) {
            const start = headingMatches[i].index;
            const end = (i < headingMatches.length - 1) ?
                headingMatches[i + 1].index : content.length;

            const sectionContent = content.substring(start, end).trim();
            if (sectionContent) {
                sections.push(sectionContent);
            }
        }
    }

    // Nếu vẫn không có section nào, chia theo kích thước
    if (sections.length === 0) {
        const maxSectionLength = 2000; // Khoảng 2-3 trang
        for (let i = 0; i < content.length; i += maxSectionLength) {
            sections.push(content.substring(i, i + maxSectionLength));
        }
    }

    return sections;
}
module.exports = {
    suggestLearningPath,
    uploadCurriculum,
    updateProgress,
    submitQuiz,
    createLearningPath,
    createSlidesFromCurriculum,
    viewSlides,
    getSlidesData
};