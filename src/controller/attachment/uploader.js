const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = require('firebase/storage');
const {  PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { storageType, localStoragePath, firebasePrivateKey,azureContainer, firebaseAuthDomain, azurestorage_conn_string, firebaseProjectId, firebaseBucket, firebaseMessagingSenderId, firebaseAppId, s3Region, s3AccessKey, s3SecretKey, bucketName } = require('../../config/setting');
const Attachment = require("../../models/attchments");
const { BlobServiceClient } = require("@azure/storage-blob");
// const { standardResponse } = require('../../utils/apiUtils');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// Ensure local upload directory exists
if (storageType === 'firebase' || storageType === 'local') {
    fs.mkdir(localStoragePath, { recursive: true }).catch(console.error);
}


// Initialize Firebase (if used)
 const firebaseConfig = {
    apiKey: firebasePrivateKey,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
    storageBucket: firebaseBucket,
    messagingSenderId: firebaseMessagingSenderId,
    appId: firebaseAppId,
};
 const firebaseApp = storageType === "firebase" ? initializeApp(firebaseConfig) : null;
 const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

// Initialize AWS S3 (if used)
 const s3Client = storageType === "s3" ? new S3Client({
    region: s3Region,
    credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
    },
}) : null;

// Initialize Azure Blob Storage (if used)
 const blobServiceClient = storageType === "azure" ? BlobServiceClient.fromConnectionString(
    azurestorage_conn_string
) : null;

// Configure Multer for file uploads
 const upload = multer({
    storage: storageType === "local" ? multer.diskStorage({
        destination: (req, file, cb) => cb(null, localStoragePath),
        filename: (req, file, cb) => cb(null, `${await generateUUID();}${path.extname(file.originalname)}`),
    }) : multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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
 const getFileCategory = (mimeType) => {
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
// Upload File
exports.uploadFile = [
    upload.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { tenantId, _id } = req.user; // From auth middleware
            const file = req.file;
            const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');
            const fileName = `${await generateUUID();}${fileExtension ? `.${fileExtension}` : ''}`;
            let fileUrl, storagePath;

            // Handle file upload based on storage type
            switch (storageType) {
                case 'local':
                    fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
                    storagePath = path.join(localStoragePath, file.filename);
                    break;
                case 'firebase':
                    storagePath = `tenants/${_id}/${fileName}`;
                    const fileRef = ref(firebaseStorage, storagePath);
                    const metadata = {
                        contentType: file.mimetype,
                        customMetadata: { _id, uploadedBy: _id },
                    };
                    await uploadBytes(fileRef, file.buffer, metadata);
                    fileUrl = await getDownloadURL(fileRef);
                    break;
                case 's3':
                    storagePath = `tenants/${_id}/${fileName}`;
                    await s3Client.send(
                        new PutObjectCommand({
                            Bucket: bucketName,
                            Key: storagePath,
                            Body: file.buffer,
                            ContentType: file.mimetype,
                            Metadata: { tenantId, uploadedBy: _id },
                            ACL: 'public-read', // Ensure public access
                        })
                    );
                    fileUrl = `https://${bucketName}.s3.${s3Region}.amazonaws.com/${storagePath}`;
                    break;
                case 'azure':
                    storagePath = `tenants/${_id}/${fileName}`;
                    const containerClient = blobServiceClient.getContainerClient(azureContainer);
                    const blobClient = containerClient.getBlockBlobClient(storagePath);
                    await blobClient.upload(file.buffer, file.size, {
                        blobHTTPHeaders: { blobContentType: file.mimetype },
                        metadata: { _id, uploadedBy: _id },
                    });
                    fileUrl = blobClient.url;
                    break;
                default:
                    throw new Error('Unsupported storage type');
            }

            // Create attachment record
            const attachment = await Attachment.create({
                tenant: _id,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                fileUrl,
                storageType: storageType,
                bucketName: storageType !== 'local' ? bucketName : null,
                storagePath,
                cloudMetadata: storageType !== 'local' ? { contentType: file.mimetype } : null,
                extension: fileExtension,
                category: getFileCategory(file.mimetype),
                uploadedBy: _id,
                sourceIp: req.ip,
            });

            standardResponse(res, true, attachment.maskForPublic(), 'File uploaded successfully', 201);
        } catch (error) {
            next(error);
        }
    },
];

// View File
exports.viewFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const attachment = await Attachment.findById(id).active().byTenant(req.user.tenantId);

        if (!attachment) {
            return res.status(404).json({ error: 'File not found or not accessible' });
        }

        // Return signed URL or direct URL
        const signedUrl = await attachment.generateSignedUrl();
        const response = attachment.maskForPublic();
        response.signedUrl = signedUrl;

        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Update File (Replace with new file)
exports.updateFile = [
    upload.single('file'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { tenantId, _id } = req.user;
            const attachment = await Attachment.findById(id).active().byTenant(id);

            if (!attachment) {
                return res.status(404).json({ error: 'File not found or not accessible' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const file = req.file;
            const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');
            let fileUrl;

            // Update file in storage
            switch (storageType) {
                case 'local':
                    // Delete old file
                    await fs.unlink(path.join(localStoragePath, path.basename(attachment.storagePath))).catch(() => { });
                    // Save new file
                    fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
                    break;
                case 'firebase':
                    const fileRef = ref(firebaseStorage, attachment.storagePath);
                    await uploadBytes(fileRef, file.buffer, {
                        contentType: file.mimetype,
                        customMetadata: { tenantId, uploadedBy: _id },
                    });
                    fileUrl = await getDownloadURL(fileRef);
                    break;
                case 's3':
                    await s3Client.send(
                        new PutObjectCommand({
                            Bucket: bucketName,
                            Key: attachment.storagePath,
                            Body: file.buffer,
                            ContentType: file.mimetype,
                            Metadata: { tenantId, uploadedBy: _id },
                            ACL: 'public-read',
                        })
                    );
                    fileUrl = `https://${bucketName}.s3.${s3Region}.amazonaws.com/${attachment.storagePath}`;
                    break;
                case 'azure':
                    const containerClient = blobServiceClient.getContainerClient(bucketName);
                    const blobClient = containerClient.getBlockBlobClient(attachment.storagePath);
                    await blobClient.upload(file.buffer, file.size, {
                        blobHTTPHeaders: { blobContentType: file.mimetype },
                        metadata: { tenantId, uploadedBy: _id },
                    });
                    fileUrl = blobClient.url;
                    break;
                default:
                    throw new Error('Unsupported storage type');
            }

            // Update attachment metadata
            const updatedData = {
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                fileUrl,
                extension: fileExtension,
                category: getFileCategory(file.mimetype),
                cloudMetadata: STORAGE_TYPE !== 'local' ? { contentType: file.mimetype } : null,
                updatedAt: new Date(),
            };

            await attachment.replaceFile(updatedData, _id);
            res.status(200).json(attachment.maskForPublic());
        } catch (error) {
            next(error);
        }
    },
];

// Rename File
exports.renameFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newFileName } = req.body;
        const { tenantId, _id } = req.user;

        if (!newFileName || typeof newFileName !== 'string' || !newFileName.trim()) {
            return res.status(400).json({ error: 'Valid new file name is required' });
        }

        const attachment = await Attachment.findById(id).active().byTenant(tenantId);
        if (!attachment) {
            return res.status(404).json({ error: 'File not found or not accessible' });
        }

        const fileExtension = attachment.getFileExtension();
        const trimmedFileName = newFileName.trim();
        const newFileNameWithExt = fileExtension ? `${trimmedFileName}.${fileExtension}` : trimmedFileName;

        // Rename in storage (if not local)
        let fileUrl = attachment.fileUrl;
        let newStoragePath = attachment.storagePath;

        if (storageType !== 'local') {
            newStoragePath = `tenants/${tenantId}/${await generateUUID();}.${fileExtension}`;
            switch (storageType) {
                case 'firebase':
                    const oldRef = ref(firebaseStorage, attachment.storagePath);
                    const newRef = ref(firebaseStorage, newStoragePath);
                    await uploadBytes(newRef, await (await fetch(attachment.fileUrl)).arrayBuffer(), {
                        contentType: attachment.fileType,
                        customMetadata: { tenantId, uploadedBy: _id },
                    });
                    await deleteObject(oldRef).catch(() => { });
                    fileUrl = await getDownloadURL(newRef);
                    break;
                case 's3':
                    await S3Client.send(
                        new PutObjectCommand({
                            Bucket: bucketName,
                            Key: newStoragePath,
                            Body: await (await fetch(attachment.fileUrl)).arrayBuffer(),
                            ContentType: attachment.fileType,
                            Metadata: { tenantId, uploadedBy: _id },
                            ACL: 'public-read',
                        })
                    );
                    await S3Client.send(
                        new DeleteObjectCommand({
                            Bucket: bucketName,
                            Key: attachment.storagePath,
                        })
                    );
                    fileUrl = `https://${bucketName}.s3.${s3Region}.amazonaws.com/${newStoragePath}`;
                    break;
                case 'azure':
                    const containerClient = blobServiceClient.getContainerClient(bucketName);
                    const oldBlobClient = containerClient.getBlockBlobClient(attachment.storagePath);
                    const newBlobClient = containerClient.getBlockBlobClient(newStoragePath);
                    await newBlobClient.upload(await (await fetch(attachment.fileUrl)).arrayBuffer(), attachment.fileSize, {
                        blobHTTPHeaders: { blobContentType: attachment.fileType },
                        metadata: { tenantId, uploadedBy: _id },
                    });
                    await oldBlobClient.delete();
                    fileUrl = newBlobClient.url;
                    break;
            }
        } else {
            // Rename locally
            const oldPath = attachment.storagePath;
            newStoragePath = path.join(localStoragePath, `${await generateUUID();}.${fileExtension}`);
            await fs.rename(oldPath, newStoragePath);
            fileUrl = `${req.protocol}://${req.get('host')}/uploads/${path.basename(newStoragePath)}`;
        }

        // Update database
        attachment.fileName = newFileNameWithExt;
        attachment.storagePath = newStoragePath;
        attachment.fileUrl = fileUrl;
        attachment.updatedAt = new Date();
        await attachment.save();

        res.status(200).json(attachment.maskForPublic());
    } catch (error) {
        next(error);
    }
};

// Remove File (Soft Delete)
exports.removeFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, _id } = req.user;

        const attachment = await Attachment.findById(id).active().byTenant(tenantId);
        if (!attachment) {
            return res.status(404).json({ error: 'File not found or not accessible' });
        }

        // Delete from storage
        switch (storageType) {
            case 'local':
                await fs.unlink(attachment.storagePath).catch(() => { });
                break;
            case 'firebase':
                const fileRef = ref(firebaseStorage, attachment.storagePath);
                await deleteObject(fileRef).catch(() => { });
                break;
            case 's3':
                await S3Client
                    .send(
                        new DeleteObjectCommand({
                            Bucket: bucketName,
                            Key: attachment.storagePath,
                        })
                    )
                    .catch(() => { });
                break;
            case 'azure':
                const containerClient = blobServiceClient.getContainerClient(bucketName);
                const blobClient = containerClient.getBlockBlobClient(attachment.storagePath);
                await blobClient.delete().catch(() => { });
                break;
        }

        // Soft delete in database
        await attachment.softDelete(_id);
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        next(error);
    }
};


// List Files by Tag
exports.listByTag = async (req, res, next) => {
    try {
        const { tag } = req.params;
        const { tenantId } = req.user;
        const attachments = await Attachment.findByTag(tag).active().byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// List Files by Category
exports.listByCategory = async (req, res, next) => {
    try {
        const { category } = req.params;
        const { tenantId } = req.user;
        const validCategories = ["image", "video", "document", "audio", "other"];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: "Invalid category" });
        }
        const attachments = await Attachment.findByCategory(category).active().byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// List Public Files
exports.listPublic = async (req, res, next) => {
    try {
        const { tenantId } = req.user;
        const attachments = await Attachment.findPublic().byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Search Files
exports.searchFiles = async (req, res, next) => {
    try {
        const { query } = req.query;
        const { tenantId } = req.user;
        if (!query || typeof query !== "string" || !query.trim()) {
            return res.status(400).json({ error: "Search query is required" });
        }
        const attachments = await Attachment.search(query).active().byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// List Files by UploadedBy
exports.listByUploadedBy = async (req, res, next) => {
    try {
        const { _id } = req.params;
        const { tenantId } = req.user;
        const attachments = await Attachment.findByUploadedBy(_id).byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Get Largest Files
exports.getLargestFiles = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const { tenantId } = req.user;
        const attachments = await Attachment.getLargestFiles(parseInt(limit)).byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Get Recent Uploads
exports.getRecentUploads = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const { tenantId } = req.user;
        const attachments = await Attachment.getRecentUploads(parseInt(limit)).byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Get Oldest Files
exports.getOldestFiles = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const { tenantId } = req.user;
        const attachments = await Attachment.getOldestFiles(parseInt(limit)).byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Get Untagged Files
exports.getUntaggedFiles = async (req, res, next) => {
    try {
        const { tenantId } = req.user;
        const attachments = await Attachment.findUntagged().active().byTenant(tenantId);
        const response = attachments.map((attachment) => attachment.maskForPublic());
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Bulk Update Tags
exports.bulkUpdateTags = async (req, res, next) => {
    try {
        const { attachmentIds, tags, action = "add" } = req.body;
        const { tenantId } = req.user;
        if (!Array.isArray(attachmentIds) || !Array.isArray(tags) || !["add", "remove"].includes(action)) {
            return res.status(400).json({ error: "Invalid attachmentIds, tags, or action" });
        }
        await Attachment.bulkUpdateTags(attachmentIds, tags, action).byTenant(tenantId);
        res.status(200).json({ message: `Tags ${action}ed successfully` });
    } catch (error) {
        next(error);
    }
};

// Bulk Delete by Tenant
exports.bulkDeleteByTenant = async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { _id, tenantId: userTenantId } = req.user;
        if (tenantId !== userTenantId) {
            return res.status(403).json({ error: "Unauthorized to delete files for this tenant" });
        }
        await Attachment.bulkDeleteByTenant(tenantId);
        res.status(200).json({ message: "Files deleted successfully for tenant" });
    } catch (error) {
        next(error);
    }
};

// Get Storage Statistics
exports.getStats = async (req, res, next) => {
    try {
        const { tenantId } = req.user;
        const [totalStorage, avgSize, sizeDistribution, topTags, categoryCounts] = await Promise.all([
            Attachment.getTotalStorageByTenant(tenantId),
            Attachment.getAverageFileSize(tenantId),
            Attachment.getSizeDistribution(tenantId),
            Attachment.getTopTags(tenantId, 5),
            Attachment.countByCategoryForTenant(tenantId),
        ]);

        res.status(200).json({
            totalStorage: totalStorage[0]?.totalBytes || 0,
            averageFileSize: avgSize[0]?.avgSize || 0,
            sizeDistribution,
            topTags,
            categoryCounts,
        });
    } catch (error) {
        next(error);
    }
};

// Error Handling Middleware
exports.errorHandler = (error, req, res, next) => {
    console.error(`Error: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
};