const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Google GenAI
const ai = new GoogleGenerativeAI("AQ.Ab8RN6JFNpiag4DwTQMDoVdhWI5y_cG5w0_bQCXgIZC9-fkuJw");

// Utility function for generating images
async function generateImageFromPrompt(prompt) {
  try {
    console.log(`Generating image for prompt: "${prompt}"`);

    // Get the model (using Imagen model for images)
    const model = ai.getGenerativeModel({ model: "gemini-pro-vision" });

    // Generate the image
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Return the base64 image data
    if (response.candidates[0].content.parts[0].inlineData.data) {
      return response.candidates[0].content.parts[0].inlineData.data;
    } else {
      throw new Error("No image generated");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

// Sửa lại hàm sendMessage - PHẦN QUAN TRỌNG CẦN SỬA
async function sendMessage(messages) {
  try {
    console.log("Sending message to Gemini model:", messages);

    // Sử dụng getGenerativeModel thay vì startChat (phương pháp đúng)
    const model = ai.getGenerativeModel({ model: "gemini-pro" });

    // Cấu hình generation
    const generationConfig = {
      maxOutputTokens: 8192,
      temperature: 0.9,
      topP: 0.8
    };

    // Gửi tin nhắn dưới dạng chuỗi (text)
    if (typeof messages === 'string') {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: messages }] }],
        generationConfig
      });

      const response = await result.response;
      return response.text();
    }
    // Gửi tin nhắn dưới dạng mảng các tin nhắn
    else if (Array.isArray(messages)) {
      const formattedMessages = messages.map(msg => ({
        role: msg.role || "user",
        parts: [{ text: msg.content || msg.text || msg }]
      }));

      const result = await model.generateContent({
        contents: formattedMessages,
        generationConfig
      });

      const response = await result.response;
      return response.text();
    }

    throw new Error("Invalid message format");
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

// Hàm generateContent không cần thay đổi nhiều
async function generateContent(document, prompt) {
  try {
    // Kết hợp document và prompt nếu cả hai đều tồn tại
    let fullPrompt;
    if (document && prompt) {
      fullPrompt = document + '\n\n' + prompt;
    } else {
      fullPrompt = document || prompt;
    }

    // Gọi sendMessage với prompt đầy đủ
    console.log("Generating content with prompt:", fullPrompt.substring(0, 100) + "...");
    return await sendMessage(fullPrompt);
  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
}

async function processLessonPlan(lessonPlanContent) {
  const prompt = "Hãy đọc kĩ file giáo án này tạo cho tôi các bài học theo ngày, các bài tập để học sinh có thể học và luyện tập tốt";
  return await generateContent(lessonPlanContent, prompt);
}

// Export using CommonJS syntax
module.exports = {
  ai,
  generateImageFromPrompt,
  sendMessage,
  generateContent,
  processLessonPlan
};