const mongoose = require('mongoose');
const crypto = require('crypto');

const ExperienceSchema = new mongoose.Schema({
    company: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true
    },
    role: {
        type: String,
        required: [true, 'Role/Position is required'],
        trim: true
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        validate: {
            validator: function (value) {
                return !value || value >= this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    description: {
        type: String,
        trim: true
    },
    current: {
        type: Boolean,
        default: false
    }
}, { _id: true });

const EducationSchema = new mongoose.Schema({
    institution: {
        type: String,
        required: [true, 'Institution name is required'],
        trim: true
    },
    degree: {
        type: String,
        required: [true, 'Degree is required'],
        trim: true
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        validate: {
            validator: function (value) {
                return !value || value >= this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    description: {
        type: String,
        trim: true
    },
    gpa: {
        type: String,
        trim: true
    }
}, { _id: true });

const ProjectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Project title is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Project description is required'],
        trim: true
    },
    link: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Please provide a valid URL'
        }
    },
    technologies: [{
        type: String,
        trim: true
    }],
    startDate: Date,
    endDate: Date
}, { _id: true });

const CertificationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Certification name is required'],
        trim: true
    },
    issuer: {
        type: String,
        required: [true, 'Issuer is required'],
        trim: true
    },
    date: {
        type: Date,
        required: [true, 'Certification date is required']
    },
    expiryDate: Date,
    credentialId: {
        type: String,
        trim: true
    },
    credentialUrl: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Please provide a valid URL'
        }
    }
}, { _id: true });

const CustomSectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Section title is required'],
        trim: true
    },
    content: {
        type: String,
        required: [true, 'Section content is required'],
        trim: true
    }
}, { _id: true });

const ResumeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User reference is required'],
        index: true
    },
    title: {
        type: String,
        required: [true, 'Resume title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    summary: {
        type: String,
        trim: true,
        maxlength: [1000, 'Summary cannot exceed 1000 characters']
    },
    personalInfo: {
        fullName: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
                },
                message: 'Please provide a valid email'
            }
        },
        phone: {
            type: String,
            trim: true
        },
        location: {
            type: String,
            trim: true
        },
        website: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^https?:\/\/.+/.test(v);
                },
                message: 'Please provide a valid URL'
            }
        },
        linkedin: {
            type: String,
            trim: true
        },
        github: {
            type: String,
            trim: true
        }
    },
    sections: {
        experience: [ExperienceSchema],
        education: [EducationSchema],
        skills: [{
            category: {
                type: String,
                default: 'General'
            },
            items: [{
                type: String,
                trim: true
            }]
        }],
        projects: [ProjectSchema],
        certifications: [CertificationSchema],
        languages: [{
            name: {
                type: String,
                required: true,
                trim: true
            },
            proficiency: {
                type: String,
                enum: ['Beginner', 'Intermediate', 'Advanced', 'Native'],
                default: 'Intermediate'
            }
        }],
        achievements: [{
            type: String,
            trim: true
        }],
        customSections: [CustomSectionSchema]
    },
    visibility: {
        type: String,
        enum: ['private', 'public', 'link-only'],
        default: 'private',
        index: true
    },
    shareToken: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    shareTokenExpiry: Date,
    version: {
        type: Number,
        default: 1,
        min: 1
    },
    previousVersions: [{
        version: Number,
        data: mongoose.Schema.Types.Mixed,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ResumeTemplate',
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    lastExportedAt: Date,
    exportCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
ResumeSchema.index({ user: 1, title: 1 });
ResumeSchema.index({ user: 1, updatedAt: -1 });
ResumeSchema.index({ visibility: 1, isActive: 1 });
ResumeSchema.index({ 'sections.skills.items': 'text', title: 'text', summary: 'text' });

// Virtual for calculating experience years
ResumeSchema.virtual('totalExperienceYears').get(function () {
    if (!this.sections.experience || this.sections.experience.length === 0) {
        return 0;
    }

    const totalMonths = this.sections.experience.reduce((total, exp) => {
        const start = new Date(exp.startDate);
        const end = exp.endDate ? new Date(exp.endDate) : new Date();
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        return total + months;
    }, 0);

    return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal place
});

// Pre-save middleware to generate share token
ResumeSchema.pre('save', function (next) {
    if (this.visibility === 'link-only' && !this.shareToken) {
        this.shareToken = crypto.randomBytes(32).toString('hex');
        this.shareTokenExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    }
    next();
});

// Pre-save middleware for versioning
ResumeSchema.pre('save', function (next) {
    if (this.isModified() && !this.isNew) {
        // Store previous version
        const previousVersion = {
            version: this.version,
            data: this.toObject(),
            createdAt: new Date()
        };

        // Remove the previousVersions from the data to avoid infinite nesting
        delete previousVersion.data.previousVersions;

        this.previousVersions.push(previousVersion);
        this.version += 1;

        // Keep only last 10 versions
        if (this.previousVersions.length > 10) {
            this.previousVersions = this.previousVersions.slice(-10);
        }
    }
    next();
});

// Instance methods
ResumeSchema.methods.generateShareToken = function () {
    this.shareToken = crypto.randomBytes(32).toString('hex');
    this.shareTokenExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    return this.shareToken;
};

ResumeSchema.methods.isShareTokenValid = function () {
    return this.shareToken && this.shareTokenExpiry && this.shareTokenExpiry > new Date();
};

ResumeSchema.methods.canBeViewed = function (userId) {
    if (this.visibility === 'public') return true;
    if (this.user.toString() === userId?.toString()) return true;
    if (this.visibility === 'link-only' && this.isShareTokenValid()) return true;
    return false;
};

ResumeSchema.methods.incrementViewCount = function () {
    this.viewCount += 1;
    return this.save({ validateBeforeSave: false });
};

ResumeSchema.methods.rollbackToVersion = function (targetVersion) {
    const versionData = this.previousVersions.find(v => v.version === targetVersion);
    if (!versionData) {
        throw new Error('Version not found');
    }

    // Restore the data
    Object.assign(this, versionData.data);
    this.version = targetVersion;
    this.updatedAt = new Date();

    return this.save();
};

// New instance method to add multiple experiences
ResumeSchema.methods.addMultipleExperiences = function (experiences) {
    if (!Array.isArray(experiences)) {
        experiences = [experiences];
    }
    this.sections.experience.push(...experiences);
    return this.save();
};

// New instance method to count experiences
ResumeSchema.methods.countExperiences = function () {
    return this.sections.experience.length;
};

// New instance method to find experiences by role
ResumeSchema.methods.findExperiencesByRole = function (role) {
    return this.sections.experience.filter(exp => exp.role.toLowerCase().includes(role.toLowerCase()));
};

// New instance method to add multiple projects
ResumeSchema.methods.addMultipleProjects = function (projects) {
    if (!Array.isArray(projects)) {
        projects = [projects];
    }
    this.sections.projects.push(...projects);
    return this.save();
};

// Static methods
ResumeSchema.statics.findByShareToken = function (token) {
    return this.findOne({
        shareToken: token,
        shareTokenExpiry: { $gt: new Date() },
        visibility: 'link-only',
        isActive: true
    });
};

ResumeSchema.statics.getUserStats = function (userId) {
    return this.aggregate([
        { $match: { user: mongoose.Types.ObjectId(userId), isActive: true } },
        {
            $group: {
                _id: null,
                totalResumes: { $sum: 1 },
                totalViews: { $sum: '$viewCount' },
                totalExports: { $sum: '$exportCount' },
                lastUpdated: { $max: '$updatedAt' },
                publicResumes: {
                    $sum: { $cond: [{ $eq: ['$visibility', 'public'] }, 1, 0] }
                },
                privateResumes: {
                    $sum: { $cond: [{ $eq: ['$visibility', 'private'] }, 1, 0] }
                },
                linkOnlyResumes: {
                    $sum: { $cond: [{ $eq: ['$visibility', 'link-only'] }, 1, 0] }
                }
            }
        }
    ]);
};

// New static method to find resumes with minimum number of experiences
ResumeSchema.statics.findResumesWithMultipleExperiences = function (minCount = 2) {
    return this.find({
        $expr: { $gte: [{ $size: '$sections.experience' }, minCount] }
    });
};

// New static method to find users with experience in a specific company
ResumeSchema.statics.findUsersWithExperienceIn = function (company) {
    return this.aggregate([
        { $match: { 'sections.experience.company': new RegExp(company, 'i') } },
        { $group: { _id: '$user' } }
    ]);
};

// New static method to get total number of experiences across all resumes
ResumeSchema.statics.getTotalExperiences = function () {
    return this.aggregate([
        { $unwind: '$sections.experience' },
        { $count: 'total' }
    ]).then(result => result[0]?.total || 0);
};

// New static method to find resumes by skill
ResumeSchema.statics.findResumesBySkill = function (skill) {
    return this.find({ $text: { $search: skill } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('Resume', ResumeSchema);