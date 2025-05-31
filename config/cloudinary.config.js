const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

// Cấu hình cho ảnh Instagram
const instagramStorage = new CloudinaryStorage({
    cloudinary,
    allowedFormats: ['jpg', 'png'],
    params: {
        folder: 'instagram'
    }
});

// Cấu hình cho tài liệu giáo án
const curriculaStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'curricula',
        resource_type: 'auto', // Cho phép mọi loại file
        format: (req, file) => {
            const extension = file.originalname.split('.').pop().toLowerCase();
            return extension; // Giữ nguyên định dạng file
        },
        public_id: (req, file) => {
            // Bỏ phần mở rộng khỏi public_id
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 8);
            const safeName = `file_${timestamp}_${randomString}`;
            return safeName;
        },
        // Đặt access_mode trực tiếp trong options
        access_mode: 'public',
        type: 'upload',
        overwrite: true,
        secure: true,
        transformation: [{
            quality: 'auto:good',
            fetch_format: 'auto'
        }],
        // Thêm options khác để đảm bảo file là public
        use_filename: true,
        unique_filename: true
    }
});


// const uploadCloud = multer({ storage });

// module.exports = uploadCloud;
module.exports = {
    uploadImage: multer({ storage: instagramStorage }),
    uploadCurriculum: multer({ storage: curriculaStorage })
};