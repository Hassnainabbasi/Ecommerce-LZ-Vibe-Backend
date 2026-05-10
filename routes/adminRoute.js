import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";
import { verifyAdmin } from "../middleware/auth.js";

dotenv.config();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "MY_SECRET_KEY";
const COOKIE_NAME = "adminToken";

// =============== LOGIN ROUTE ===============
router.post("/login", async (req, res) => {
  try {
  const { email, password } = req.body;
console.log("🔐 Login attempt:", email);

const admin = await Admin.findOne({ email });

    if (!admin) {
      console.log("❌ Admin not found");
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log("❌ Password incorrect");
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

const token = jwt.sign(
  { id: admin._id, email: admin.email, isAdmin: true },
  JWT_SECRET,
  { expiresIn: "7d" }
);


    const isProduction = process.env.NODE_ENV === "production";

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    console.log("✅ Login successful, cookie set");

res.json({
  success: true,
  message: "Login successful",
  admin: { id: admin._id, email: admin.email, name: admin.name },
  token,
});
  
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// =============== VERIFY ROUTE ===============
router.get("/verify", (req, res) => {
  console.log("🔍 Verify route hit");
  console.log("Cookies:", req.cookies);

  const token =
    req.cookies[COOKIE_NAME] ||
    req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "No token found" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, admin: decoded });
  } catch (err) {
    res.status(401).json({ success: false, error: "Invalid token" });
  }
});

// ✅ LOGOUT ROUTE
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  return res.json({ message: "Logged out successfully" });
});

// =============== CREATE ADMIN ROUTE ===============
router.post("/create", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    console.log("🔐 Admin creation attempt:", email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: "Admin with this email already exists"
      });
    }

    // Create new admin
    const newAdmin = new Admin({
      email: email.trim(),
      password,
      name: name?.trim() || ""
    });

    await newAdmin.save();

    console.log("✅ Admin created successfully:", newAdmin._id);

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        name: newAdmin.name
      }
    });
  } catch (err) {
    console.error("❌ Admin creation error:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Admin with this email already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create admin",
      message: err.message
    });
  }
});

// =============== GET ALL ADMINS ROUTE ===============
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const admins = await Admin.find({})
      .select("-password") // Don't send password
      .sort({ createdAt: -1 })
      .lean();
    
    const count = admins.length;

    res.json({
      success: true,
      count,
      admins
    });
  } catch (err) {
    console.error("❌ Error fetching admins:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// =============== GET ALL ADMINS ROUTE (alias for /all) ===============
router.get("/all", verifyAdmin, async (req, res) => {
  try {
    const admins = await Admin.find({})
      .select("-password") // Don't send password
      .sort({ createdAt: -1 })
      .lean();
    
    const count = admins.length;

    res.json({
      success: true,
      count,
      admins
    });
  } catch (err) {
    console.error("❌ Error fetching admins:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// =============== GET SINGLE ADMIN ROUTE ===============
router.get("/:id", verifyAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id)
      .select("-password") // Don't send password
      .lean();

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found"
      });
    }

    res.json({
      success: true,
      admin
    });
  } catch (err) {
    console.error("❌ Error fetching admin:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// =============== UPDATE ADMIN ROUTE ===============
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    console.log("=== PUT /api/admin/:id ===");
    console.log("ID:", req.params.id);
    console.log("Body:", req.body);

    const { email, password, name } = req.body;
    const updateData = {};

    if (email !== undefined) {
      updateData.email = email.trim();
    }
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (password !== undefined && password.trim() !== "") {
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
    }

    // Check if email is being updated and if it conflicts with existing admin
    if (updateData.email) {
      const existingAdmin = await Admin.findOne({
        email: updateData.email,
        _id: { $ne: req.params.id }
      });

      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          error: "Admin with this email already exists"
        });
      }
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found"
      });
    }

    console.log("✅ Admin updated:", updatedAdmin._id);
    res.json({
      success: true,
      message: "Admin updated successfully",
      admin: updatedAdmin
    });
  } catch (err) {
    console.error("❌ Error updating admin:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Admin with this email already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
