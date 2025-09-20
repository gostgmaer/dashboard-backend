const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const { initializeApp } = require("firebase/app");
const { getStorage } = require("firebase/storage");
const { S3Client } = require("@aws-sdk/client-s3");
const { BlobServiceClient } = require("@azure/storage-blob");

const { storageType, localStoragePath, firebasePrivateKey, firebaseAuthDomain, azurestorage_conn_string, firebaseProjectId, firebaseBucket, firebaseMessagingSenderId, firebaseAppId, s3Region, s3AccessKey, s3SecretKey } = require('../../config/setting');



// Initialize Firebase (if used)
export const firebaseConfig = {
    apiKey: firebasePrivateKey,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
    storageBucket: firebaseBucket,
    messagingSenderId: firebaseMessagingSenderId,
    appId: firebaseAppId,
};
export const firebaseApp = storageType === "firebase" ? initializeApp(firebaseConfig) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

// Initialize AWS S3 (if used)
export const s3Client = storageType === "s3" ? new S3Client({
    region: s3Region,
    credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
    },
}) : null;

// Initialize Azure Blob Storage (if used)
export const blobServiceClient = storageType === "azure" ? BlobServiceClient.fromConnectionString(
    azurestorage_conn_string
) : null;

// Configure Multer for file uploads
export const upload = multer({
    storage: storageType === "local" ? multer.diskStorage({
        destination: (req, file, cb) => cb(null, localStoragePath),
        filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
    }) : multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "video/mp4",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "audio/mpeg",
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"), false);
        }
    },
});

// Helper: Determine file category based on MIME type
export const getFileCategory = (mimeType) => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if ([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(mimeType)) return "document";
    return "other";
};