import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: false,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  // support multiple images per product
  image: {
    type: [String],
    default: ["/images/placeholder.png"],
  },
  category: {
    type: String,
    required: true,
    index: true,
  },
  flavor: {
    type: [String],
    default: [],
  },
  // Inventory and variant fields for admin dashboard
  stockQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  sizes: {
    type: [String],
    default: [],
  },
  colors: {
    type: [String],
    default: [],
  },
  weight: {
    type: String,
    default: "",
  },
  compareAtPrice: {
    type: Number,
    default: 0,
  },
  discountPercent: {
    type: Number,
    default: 0,
  },
  isWeeklyOffer: {
    type: Boolean,
    default: false,
  },
  offerLabel: {
    type: String,
    default: "",
  },
  offerEndsAt: {
    type: Date,
    default: null,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ProductSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model("Product", ProductSchema);
