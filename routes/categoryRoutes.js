import express from "express";
import Category from "../models/Category.js";
import { verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// ---------------- GET ALL CATEGORIES ----------------
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({})
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      categories
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ---------------- BULK IMPORT CATEGORIES ----------------
const MAX_BULK_CATEGORIES = 500;

router.post("/bulk-import", verifyAdmin, async (req, res) => {
  try {
    const raw = req.body?.categories ?? req.body;
    if (!Array.isArray(raw)) {
      return res.status(400).json({
        success: false,
        error: "Request body must be an array or { categories: [...] }",
      });
    }

    if (raw.length === 0) {
      return res.status(400).json({
        success: false,
        error: "categories array cannot be empty",
      });
    }

    if (raw.length > MAX_BULK_CATEGORIES) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_BULK_CATEGORIES} categories per request`,
      });
    }

    const inserted = [];
    const skipped = [];
    const errors = [];
    const seenNames = new Set();

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const name = typeof row?.name === "string" ? row.name.trim() : "";
      if (!name) {
        errors.push({ index: i, reason: "name is required" });
        continue;
      }

      const normalized = name.toLowerCase();
      if (seenNames.has(normalized)) {
        skipped.push({ index: i, name: normalized, reason: "duplicate in payload" });
        continue;
      }
      seenNames.add(normalized);

      const existing = await Category.findOne({ name: normalized });
      if (existing) {
        skipped.push({ index: i, name: normalized, reason: "already exists" });
        continue;
      }

      try {
        const doc = new Category({
          name: normalized,
          description:
            typeof row.description === "string" ? row.description.trim() : "",
          image: typeof row.image === "string" ? row.image.trim() : "",
          isActive: row.isActive !== undefined ? Boolean(row.isActive) : true,
        });
        await doc.save();
        inserted.push(doc);
      } catch (e) {
        if (e.code === 11000) {
          skipped.push({ index: i, name: normalized, reason: "already exists" });
        } else {
          errors.push({
            index: i,
            name: normalized,
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
        skipped: skipped.length,
        errors: errors.length,
      },
      inserted,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("❌ POST /api/categories/bulk-import ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Bulk import failed",
    });
  }
});

// ---------------- GET SINGLE CATEGORY ----------------
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found"
      });
    }

    res.json({
      success: true,
      category
    });
  } catch (err) {
    console.error("Error fetching category:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ---------------- CREATE CATEGORY ----------------
router.post("/", verifyAdmin, async (req, res) => {
  try {
    console.log("=== POST /api/categories ===");
    console.log("Body:", req.body);
    console.log("Admin:", req.admin);

    const { name, description, image, isActive } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Category name is required"
      });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({
      name: name.toLowerCase().trim()
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: "Category with this name already exists"
      });
    }

    // Create category
    const newCategory = new Category({
      name: name.toLowerCase().trim(),
      description: description?.trim() || "",
      image: image?.trim() || "",
      isActive: isActive !== undefined ? isActive : true
    });

    await newCategory.save();

    console.log("✅ Category created:", newCategory._id);
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category: newCategory
    });
  } catch (err) {
    console.error("❌ POST /api/categories ERROR:", err);

    // Handle validation errors
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors
      });
    }

    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Category with this name already exists"
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: "Failed to create category",
      message: err.message
    });
  }
});

// ---------------- UPDATE CATEGORY ----------------
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    console.log("=== PUT /api/categories/:id ===");
    console.log("ID:", req.params.id);
    console.log("Body:", req.body);

    const { name, description, image, isActive } = req.body;
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name.toLowerCase().trim();
    }
    if (description !== undefined) {
      updateData.description = description.trim();
    }
    if (image !== undefined) {
      updateData.image = image.trim();
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Check if name is being updated and if it conflicts with existing category
    if (updateData.name) {
      const existingCategory = await Category.findOne({
        name: updateData.name,
        _id: { $ne: req.params.id }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          error: "Category with this name already exists"
        });
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        error: "Category not found"
      });
    }

    console.log("✅ Category updated:", updatedCategory._id);
    res.json({
      success: true,
      message: "Category updated successfully",
      category: updatedCategory
    });
  } catch (err) {
    console.error("❌ Error updating category:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Category with this name already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ---------------- DELETE CATEGORY ----------------
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    console.log("=== DELETE /api/categories/:id ===");
    console.log("ID:", req.params.id);

    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({
        success: false,
        error: "Category not found"
      });
    }

    console.log("✅ Category deleted:", deletedCategory._id);
    res.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (err) {
    console.error("❌ Error deleting category:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;

