import express from "express";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { verifyAdmin } from "../middleware/auth.js";
import {
  cloudinary,
  uploadImageToCloudinary,
} from "../utils/cloudinaryUpload.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

const router = express.Router();
// ---------------- MULTER + CLOUDINARY STORAGE ----------------
// ---------------- CLOUDINARY STORAGE ----------------
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "products", // Cloudinary folder
      allowed_formats: ["jpg", "jpeg", "png", "webp"], // Allowed file types
      transformation: [{ width: 800, height: 800, crop: "limit" }], // Resize
    };
  },
});

// ---------------- MULTER ----------------
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    console.log("File filter:", file.mimetype);
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

console.log("✅ Multer + Cloudinary storage configured successfully");

// ---------------- ERROR HANDLER FOR MULTER ----------------
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  }
  next(err);
};
// Test Cloudinary connection
router.get("/cloudinary-test", async (req, res) => {
  try {
    // Simple upload test
    const result = await cloudinary.uploader.upload(
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PC9zdmc+",
      { folder: "test" }
    );
    res.json({ success: true, result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ---------------- TEST ROUTE ----------------
router.get("/test", async (req, res) => {
  try {
    const count = await Product.countDocuments();
    const sample = await Product.findOne().lean();
    
    res.json({
      success: true,
      message: "Products API is working",
      totalProducts: count,
      sample,
      env: {
        cloudinary: !!(
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
        ),
        jwt: !!process.env.JWT_SECRET,
        mongo: !!process.env.MONGO_URI,
      },
    });
  } catch (err) {
    console.error("Test route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- STATS COUNT ----------------
router.get("/stats/count", async (req, res) => {
  try {
    const count = await Product.countDocuments();
    res.json({ success: true, count });
  } catch (err) {
    console.error("Error counting products:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- GET ALL PRODUCTS ----------------
router.get("/getAllProducts", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, products });
  } catch (err) {
    console.error("Error retrieving all products:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- FILTERED GET ----------------
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;

    const products = await Product.find(filter)
      .sort({ category: 1, createdAt: -1 })
      .lean();

    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- BULK IMPORT PRODUCTS ----------------
const MAX_BULK_PRODUCTS = 500;

function normalizeFlavorForBulk(flavor) {
  if (flavor == null || flavor === "") return [];
  if (Array.isArray(flavor)) {
    return flavor.map(String).map((s) => s.trim()).filter(Boolean);
  }
  return String(flavor)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

router.post("/bulk-import", verifyAdmin, async (req, res) => {
  try {
    const raw = req.body?.products ?? req.body;
    if (!Array.isArray(raw)) {
      return res.status(400).json({
        success: false,
        error: "Request body must be an array or { products: [...] }",
      });
    }

    if (raw.length === 0) {
      return res.status(400).json({
        success: false,
        error: "products array cannot be empty",
      });
    }

    if (raw.length > MAX_BULK_PRODUCTS) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_BULK_PRODUCTS} products per request`,
      });
    }

    const activeCategories = await Category.find({ isActive: true })
      .select("name")
      .lean();
    const activeSet = new Set(activeCategories.map((c) => c.name));

    const inserted = [];
    const errors = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const name =
        typeof row?.name === "string" ? row.name.trim() : String(row?.name ?? "").trim();
      const categoryRaw = row?.category;
      const category =
        typeof categoryRaw === "string"
          ? categoryRaw.toLowerCase().trim()
          : String(categoryRaw ?? "")
              .toLowerCase()
              .trim();
      const numPrice = Number(row?.price);

      if (!name || !category || row?.price == null || row?.price === "") {
        errors.push({
          index: i,
          reason: "name, category, and price are required",
        });
        continue;
      }

      if (isNaN(numPrice) || numPrice <= 0) {
        errors.push({
          index: i,
          reason: "price must be a valid positive number",
          received: row?.price,
        });
        continue;
      }

      if (!activeSet.has(category)) {
        errors.push({
          index: i,
          reason: "invalid or inactive category",
          received: categoryRaw,
        });
        continue;
      }

      const weight =
        row.weight != null && row.weight !== ""
          ? String(row.weight).trim()
          : "";

      let image = "/images/placeholder.png";
      if (typeof row.image === "string" && row.image.trim()) {
        try {
          const uploaded = await uploadImageToCloudinary(
            row.image.trim(),
            "products"
          );
          if (uploaded) image = uploaded;
        } catch (e) {
          errors.push({
            index: i,
            reason: `image upload failed: ${e.message}`,
          });
          continue;
        }
      }

      let productId =
        typeof row.productId === "string" && row.productId.trim()
          ? row.productId.trim()
          : `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`;

      try {
        const doc = new Product({
          productId,
          name,
          category,
          price: numPrice,
          weight,
          flavor: normalizeFlavorForBulk(row.flavor),
          image,
        });
        await doc.save();
        inserted.push(doc);
      } catch (e) {
        if (e.code === 11000) {
          productId = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}-r`;
          try {
            const doc = new Product({
              productId,
              name,
              category,
              price: numPrice,
              weight,
              flavor: normalizeFlavorForBulk(row.flavor),
              image,
            });
            await doc.save();
            inserted.push(doc);
          } catch (e2) {
            errors.push({
              index: i,
              name,
              reason: e2.message || "duplicate productId, retry failed",
            });
          }
        } else {
          errors.push({
            index: i,
            name,
            reason: e.message || "save failed",
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Bulk import completed",
      summary: {
        total: raw.length,
        inserted: inserted.length,
        errors: errors.length,
      },
      inserted,
      errors,
    });
  } catch (err) {
    console.error("❌ POST /products/bulk-import ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Bulk import failed",
    });
  }
});

// ---------------- GET SINGLE PRODUCT ----------------
router.get("/:id", async (req, res) => {
  try {
    let product = await Product.findById(req.params.id).lean();

    if (!product) {
      product = await Product.findOne({ productId: req.params.id }).lean();
    }

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: "Product not found" 
      });
    }

    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- CREATE PRODUCT ----------------
router.post(
  "/",
  verifyAdmin,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("❌ Multer error:", err);
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log("=== POST /products ===");
      console.log("Body:", req.body);
      console.log("File:", req.file ? "Present" : "None");
      console.log("Admin:", req.admin);

      const { name, category, price, weight, flavor } = req.body;

      // Validation
      if (!name || !category || !price) {
        console.log("❌ Missing required fields");
        return res.status(400).json({
          success: false,
          error: "Name, category, and price are required",
          received: { name: !!name, category: !!category, price: !!price },
        });
      }

      // Validate price
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({
          success: false,
          error: "Price must be a valid positive number",
          received: price,
        });
      }

      // Validate category from database
      const cleanCategory = category.toLowerCase().trim();
      const categoryExists = await Category.findOne({ 
        name: cleanCategory,
        isActive: true 
      });
      
      if (!categoryExists) {
        // Get all active categories for error message
        const allCategories = await Category.find({ isActive: true })
          .select("name")
          .lean();
        const categoryNames = allCategories.map(cat => cat.name).join(", ");
        
        return res.status(400).json({
          success: false,
          error: `Invalid category. Category must exist in database and be active.`,
          received: category,
          availableCategories: categoryNames || "No categories available. Please create categories first.",
        });
      }

      // Create product
      const newProduct = new Product({
        productId: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        category: cleanCategory,
        price: numPrice,
        weight: weight?.trim() || "",
        flavor: flavor?.trim() || "",
        image: req.file?.path || null,
      });

      console.log("Saving product:", {
        name: newProduct.name,
        category: newProduct.category,
        price: newProduct.price,
        hasImage: !!newProduct.image,
      });

      await newProduct.save();

      console.log("✅ Product saved:", newProduct._id);
      res.status(201).json({
        success: true,
        message: "Product added successfully",
        product: newProduct,
      });
    } catch (err) {
      console.error("❌ POST /products ERROR:", err);
      console.error("Stack:", err.stack);

      // Handle validation errors
      if (err.name === "ValidationError") {
        const errors = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors,
        });
      }

      // Handle duplicate key error
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          error: "A product with this name already exists",
        });
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: "Failed to add product",
        message: err.message,
      });
    }
  }
);

// ---------------- UPDATE PRODUCT ----------------
router.put(
  "/:id",
  verifyAdmin,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log("=== PUT /products/:id ===");
      console.log("ID:", req.params.id);
      console.log("Body:", req.body);
      console.log("File:", req.file ? "Present" : "None");

      const updateData = { ...req.body };

      if (req.file) {
        updateData.image = req.file.path;
      } else if (
        updateData.image &&
        typeof updateData.image === "string" &&
        updateData.image.trim()
      ) {
        try {
          updateData.image = await uploadImageToCloudinary(
            updateData.image.trim(),
            "products"
          );
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: `Image upload failed: ${e.message}`,
          });
        }
      }

      if (updateData.price) {
        updateData.price = Number(updateData.price);
      }

      if (updateData.category) {
        const cleanCategory = updateData.category.toLowerCase().trim();
        const categoryExists = await Category.findOne({ 
          name: cleanCategory,
          isActive: true 
        });
        
        if (!categoryExists) {
          // Get all active categories for error message
          const allCategories = await Category.find({ isActive: true })
            .select("name")
            .lean();
          const categoryNames = allCategories.map(cat => cat.name).join(", ");
          
          return res.status(400).json({
            success: false,
            error: `Invalid category. Category must exist in database and be active.`,
            received: updateData.category,
            availableCategories: categoryNames || "No categories available. Please create categories first.",
          });
        }
        
        updateData.category = cleanCategory;
      }

      let updated = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updated) {
        updated = await Product.findOneAndUpdate(
          { productId: req.params.id },
          updateData,
          { new: true, runValidators: true }
        );
      }

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      console.log("✅ Product updated:", updated._id);
      res.json({ success: true, product: updated });
    } catch (err) {
      console.error("❌ Error updating product:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ---------------- DELETE PRODUCT ----------------
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    console.log("=== DELETE /products/:id ===");
    console.log("ID:", req.params.id);

    let removed = await Product.findByIdAndDelete(req.params.id);

    if (!removed) {
      removed = await Product.findOneAndDelete({ productId: req.params.id });
    }

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Delete image from Cloudinary
    if (removed.image) {
      try {
        const publicId = removed.image
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];
        await cloudinary.uploader.destroy(publicId);
        console.log("✅ Image deleted from Cloudinary");
      } catch (cloudErr) {
        console.error("⚠️ Failed to delete image:", cloudErr);
      }
    }

    console.log("✅ Product deleted:", removed._id);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting product:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Apply error handler
router.use(handleMulterError);

export default router;