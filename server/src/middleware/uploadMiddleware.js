const multer = require('multer');
const path = require('path');
const fs = require('fs');

const tempUploadDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Storage engine writing stream directly to disk to prevent RAM exhaustion
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure randomized temporary filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedExt = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${uniqueSuffix}${sanitizedExt}`);
  }
});

// Allowed MIME types for legal evidence
const ALLOWED_MIME_TYPES = [
  // Video
  'video/mp4',
  'video/mkv',
  'video/webm',
  'video/avi',
  'video/quicktime',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp3',
  'audio/x-m4a',
  // Forensic archives & data dumps
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not permitted for legal evidence`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB max file size
  },
  fileFilter
});

module.exports = upload;
