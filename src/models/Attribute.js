const mongoose = require("mongoose");

const attributeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    variants: [
      {
        name: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          lowercase: true,
          enum: ["show", "hide"],
          default: "show",
        },
        additionalInfo: {
          type: String,
          default: "", // Additional information about the variant
        },
        image: {
          type: String,
          default: "", // Image URL for the variant (if applicable)
        },
        priceAdjustment: {
          type: Number,
          default: 0, // Price adjustment for the variant
        },
        sku: {
          type: String,
          default: "", // Stock Keeping Unit for the variant
        },
        stockQuantity: {
          type: Number,
          default: 0, // Quantity in stock for the variant
        },
        isDefault: {
          type: Boolean,
          default: false, // Indicates if this is the default variant
        },
        colorCode: {
          type: String,
          default: "", // Hex code for color variants
        },
        size: {
          type: String,
          default: "", // Size information for clothing, etc.
        },
        weight: {
          type: Number,
          default: 0, // Weight of the variant (if applicable)
        },
        dimensions: {
          length: {
            type: Number,
            default: 0, // Length of the variant
          },
          width: {
            type: Number,
            default: 0, // Width of the variant
          },
          height: {
            type: Number,
            default: 0, // Height of the variant
          },
        },
      },
    ],
    option: {
      type: String,
      enum: ["Dropdown", "Radio", "Checkbox"],
      required: true,
    },
    type: {
      type: String,
      lowercase: true,
      default: "attribute",
      enum: ["attribute", "extra"],
    },
    status: {
      type: String,
      lowercase: true,
      enum: ["show", "hide"],
      default: "show",
    },
    sortOrder: {
      type: Number,
      default: 0, // Order for displaying attributes
    },
    isGlobal: {
      type: Boolean,
      default: false, // Indicates if the attribute is global across products
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model (who created the attribute)
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model (who last updated the attribute)
    },

    meta: {
      tags: {
        type: [String],
        default: [], // Tags associated with the attribute for categorization
      },
      notes: {
        type: String,
        default: "", // Additional notes for internal use
      },
    },
    isActive: {
      type: Boolean,
      default: true, // Indicates if the attribute is currently active
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product", // Reference to products this attribute applies to
      },
    ],
    associatedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category", // Reference to categories this attribute belongs to
      },
    ],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

const Attribute = mongoose.model("Attribute", attributeSchema);

module.exports = Attribute;
