const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleAuth } = require('google-auth-library');

// Đường dẫn đến file credentials (JSON key)
// Nếu dùng GOOGLE_APPLICATION_CREDENTIALS thì comment dòng này
// const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json';

// Khởi tạo VertexAI với project ID và location
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
});

// Export những dịch vụ cần dùng
const generativeVisionModel = vertexAI.getGenerativeModel({
    model: 'imagegeneration@002', // Model tạo hình ảnh của Google
    generation_config: {
        max_output_tokens: 2048,
    },
});

module.exports = {
    vertexAI,
    generativeVisionModel
};