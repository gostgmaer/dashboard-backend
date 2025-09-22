const express = require("express");
const router = express.Router();
const attachmentController = require("../controller/attachment/uploader");
const {authMiddleware} = require("../middleware/auth");
// Core File Operations
router.post("/", authMiddleware, attachmentController.uploadFile);
router.get("/:id", authMiddleware, attachmentController.viewFile);
router.put("/:id", authMiddleware, attachmentController.updateFile);
router.patch("/:id/rename", authMiddleware, attachmentController.renameFile);
router.delete("/:id", authMiddleware, attachmentController.removeFile);

// Additional Operations
router.get("/tag/:tag", authMiddleware, attachmentController.listByTag);
router.get("/category/:category", authMiddleware, attachmentController.listByCategory);
router.get("/public", authMiddleware, attachmentController.listPublic);
router.get("/search", authMiddleware, attachmentController.searchFiles);
router.get("/uploaded-by/:userId", authMiddleware, attachmentController.listByUploadedBy);
router.get("/largest", authMiddleware, attachmentController.getLargestFiles);
router.get("/recent", authMiddleware, attachmentController.getRecentUploads);
router.get("/oldest", authMiddleware, attachmentController.getOldestFiles);
router.get("/untagged", authMiddleware, attachmentController.getUntaggedFiles);
router.patch("/bulk-tags", authMiddleware, attachmentController.bulkUpdateTags);
router.delete("/tenant/:tenantId", authMiddleware, attachmentController.bulkDeleteByTenant);
router.get("/stats", authMiddleware, attachmentController.getStats);

module.exports = { AttachmentUpload: router };