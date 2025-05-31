const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');
const cloudinary = require('cloudinary').v2;
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const Curriculum = require('../models/learn/currculum');
const LearningPath = require('../models/learn/learningPath');
const Progress = require('../models/learn/progress'); // Add this for progress tests

// Controllers to test
const {
    suggestLearningPath,
    uploadCurriculum,
    createLearningPath,
    updateProgress,
    submitQuiz
} = require('./learn');

// Mock dependencies
jest.mock('axios');
jest.mock('cloudinary').v2;
jest.mock('pdf-parse');
jest.mock('mammoth');
jest.mock('../models/learn/currculum');
jest.mock('../models/learn/learningPath');
jest.mock('../models/learn/progress');
jest.mock('pdf-parse');
jest.mock('mammoth');
jest.mock('../models/learn/currculum');
jest.mock('../models/learn/learningPath');

describe('Learn Controller', () => {
    // Setup before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        // If we use mock-fs, restore it
        mockFs.restore();
    });

    describe('extractContentFromFile', () => {
        it('should extract content from PDF file', async () => {
            // Mock axios.get to return a buffer
            const mockPdfBuffer = Buffer.from('mock pdf content');
            axios.get.mockResolvedValue({ data: mockPdfBuffer });
            
            // Mock pdf-parse to return text
            pdf.mockResolvedValue({ text: 'Extracted PDF content' });

            // Get the function directly from the module (we need to do this since it's not exported)
            
            const result = await extractContentFromFile('http://example.com/file.pdf');
            
            expect(result).toBe('Extracted PDF content');
            expect(axios.get).toHaveBeenCalledWith('http://example.com/file.pdf', { responseType: 'arraybuffer' });
            expect(pdf).toHaveBeenCalled();
        });

        it('should extract content from DOCX file', async () => {
            // Mock axios.get to return a buffer
            const mockDocxBuffer = Buffer.from('mock docx content');
            axios.get.mockResolvedValue({ data: mockDocxBuffer });
            
            // Mock mammoth to return extracted text
            mammoth.extractRawText.mockResolvedValue({ value: 'Extracted DOCX content' });

            // Get the function directly from the module
            
            const result = await extractContentFromFile('http://example.com/file.docx');
            
            expect(result).toBe('Extracted DOCX content');
            expect(axios.get).toHaveBeenCalledWith('http://example.com/file.docx', { responseType: 'arraybuffer' });
            expect(mammoth.extractRawText).toHaveBeenCalled();
        });

        it('should handle extraction errors gracefully', async () => {
            axios.get.mockRejectedValue(new Error('Network error'));

            
            const result = await extractContentFromFile('http://example.com/file.pdf');
            
            expect(result).toBe('Không thể trích xuất nội dung file. Vui lòng nhập trực tiếp.');
        });
    });

    describe('uploadCurriculum', () => {
        it('should upload curriculum and extract content from PDF', async () => {
            // Mock request and response
            const req = {
                file: {
                    path: 'https://res.cloudinary.com/demo/file.pdf',
                    originalname: 'curriculum.pdf',
                    mimetype: 'application/pdf'
                },
                body: {
                    title: 'Math Curriculum',
                    description: 'Mathematics for grade 10',
                    subject: 'Math',
                    grade: '10'
                }
            };
            
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            // Mock extractContentFromFile to return content
            jest.spyOn(require('./learn'), 'extractContentFromFile')
                .mockResolvedValue('Extracted curriculum content');

            // Mock Curriculum.create
            Curriculum.create.mockResolvedValue({
                _id: 'curriculum123',
                title: 'Math Curriculum',
                fileUrl: 'https://res.cloudinary.com/demo/file.pdf'
            });

            await uploadCurriculum(req, res);

            expect(Curriculum.create).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Math Curriculum',
                subject: 'Math',
                grade: 10,
                fileUrl: 'https://res.cloudinary.com/demo/file.pdf'
            }));

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: "Upload giáo án thành công"
            }));
        });

        it('should return error if no file is uploaded', async () => {
            const req = {
                file: null,
                body: { title: 'Math Curriculum' }
            };
            
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await uploadCurriculum(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: "Không tìm thấy file. Vui lòng upload file giáo án."
            }));
        });
    });

    describe('createLearningPath with Gemini integration', () => {
        it('should generate learning path from curriculum using Gemini API', async () => {
            // Mock curriculum data
            const curriculum = {
                _id: 'curriculum123',
                title: 'Math Curriculum',
                subject: 'Math',
                grade: 10,
                content: 'Detailed math curriculum for grade 10'
            };

            // Mock Gemini API response
            const geminiResponse = {
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                text: `{
                                    "title": "Lộ trình học Toán lớp 10",
                                    "lessons": [
                                        {
                                            "title": "Đại số cơ bản",
                                            "description": "Làm quen với các khái niệm",
                                            "content": "Nội dung chi tiết...",
                                            "duration": 45,
                                            "day": 1,
                                            "session": "Sáng",
                                            "resources": ["Link 1", "Link 2"],
                                            "quiz": [
                                                {
                                                    "question": "Câu hỏi?",
                                                    "options": ["A", "B", "C", "D"],
                                                    "answer": 2
                                                }
                                            ]
                                        }
                                    ]
                                }`
                            }]
                        }
                    }]
                }
            };

            // Mock axios post to Gemini API
            axios.post.mockResolvedValue(geminiResponse);

            // Mock LearningPath.create
            const createdLearningPath = {
                _id: 'path123',
                curriculumId: 'curriculum123',
                title: 'Lộ trình học Toán lớp 10',
                lessons: [{ title: 'Đại số cơ bản' }]
            };
            LearningPath.create.mockResolvedValue(createdLearningPath);

            // Call the generateLearningPath function directly
            const result = await generateLearningPath(curriculum);

            // Assertions
            expect(axios.post).toHaveBeenCalledWith(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
                expect.objectContaining({
                    contents: [{ role: "user", parts: [{ text: expect.stringContaining('Phân tích giáo án') }] }]
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "x-goog-api-key": expect.any(String)
                    })
                })
            );

            expect(LearningPath.create).toHaveBeenCalledWith(expect.objectContaining({
                curriculumId: 'curriculum123',
                title: 'Lộ trình học Toán lớp 10'
            }));

            expect(result).toEqual(createdLearningPath);
        });

        it('should handle JSON parsing errors from Gemini response', async () => {
            // Mock curriculum
            const curriculum = {
                _id: 'curriculum123',
                title: 'Math Curriculum',
                content: 'Math content'
            };

            // Mock Gemini returning invalid JSON
            axios.post.mockResolvedValue({
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                text: 'This is not valid JSON'
                            }]
                        }
                    }]
                }
            });

            // Mock LearningPath.create with fallback values
            LearningPath.create.mockResolvedValue({
                _id: 'path123',
                title: 'Math Curriculum',
                lessons: []
            });

            const result = await generateLearningPath(curriculum);

            expect(LearningPath.create).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Math Curriculum',
                lessons: []
            }));
        });
    });

    describe('suggestLearningPath', () => {
        it('should suggest learning paths based on user input', async () => {
            // Mock request and response
            const req = {
                body: {
                    grade: '10',
                    weakSubjects: 'Math',
                    learningStyle: 'Visual',
                    goal: 'Improve math skills'
                }
            };
            
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            // Mock Gemini API response
            axios.post.mockResolvedValue({
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                text: `[
                                    {
                                        "title": "Math Fundamentals",
                                        "description": "Basic concepts for grade 10",
                                        "link": "https://example.com/math",
                                        "level": "Basic",
                                        "reason": "Perfect for your needs"
                                    }
                                ]`
                            }]
                        }
                    }]
                }
            });

            await suggestLearningPath(req, res);

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("gemini-2.0-flash"),
                expect.any(Object),
                expect.any(Object)
            );

            expect(res.json).toHaveBeenCalledWith({
                courses: expect.arrayContaining([
                    expect.objectContaining({
                        title: "Math Fundamentals"
                    })
                ])
            });
        });
    });
});