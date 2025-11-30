const mongoose = require('mongoose');
const { Schema } = mongoose;

const commonMetadataSchema = new Schema(
  {
    // --- A. AUDIT TRAIL (Who & When) ---
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    creationMethod: {
      type: String,
      enum: ['Manual_Entry', 'API', 'Web_Form', 'Bulk_Import'],
      default: 'Web_Form',
    },
    isRead: { type: Boolean, default: false }, // Has an admin opened this?
    isStarred: { type: Boolean, default: false }, // Marked as "Important"
    isArchived: { type: Boolean, default: false }, // Soft delete / hidden
    isLocked: { type: Boolean, default: false }, // Prevent further edits (e.g., after contract signed)
    flaggedReason: { type: String }, // e.g., "Potential Duplicate"

    // --- D. MARKETING ATTRIBUTION ---
    marketing: {
      utm_source: String,
      utm_medium: String,
      utm_campaign: String,
      landingPageUrl: String,
      referrerUrl: String,
    },

    tech: {
      // 1. Identification
      ipAddress: { type: String, trim: true },
      userAgent: { type: String, trim: true },

      // 2. Device Details (Parsed from UserAgent)
      browser: { type: String }, // e.g., "Chrome", "Safari"
      browserVersion: { type: String }, // e.g., "114.0.0"
      os: { type: String }, // e.g., "Windows 10", "macOS", "Android"
      deviceType: { type: String }, // e.g., "Desktop", "Mobile", "Tablet"
      isMobile: { type: Boolean }, // Quick boolean flag for queries

      // 3. User Context (Crucial for Service Providers)
      language: { type: String }, // e.g., "en-US", "fr-FR" (Browser Language)
      timezone: { type: String }, // e.g., "Asia/Kolkata", "America/New_York"
      screenResolution: { type: String }, // e.g., "1920x1080" (Helps with UI debugging)

      // 4. Network & Location
      geoCountry: { type: String },
      geoCity: { type: String },
      isp: { type: String }, // Internet Service Provider (useful to flag bot farms)
      connectionType: { type: String }, // e.g., "4g", "wifi" (via Navigator API)
    },
  },
  {
    _id: false,
    timestamps: false,
  }
);

module.exports = commonMetadataSchema;
