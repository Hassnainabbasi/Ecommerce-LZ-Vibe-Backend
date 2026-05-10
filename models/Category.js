import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    default: ""
  },
  image: {
    type: String,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
categorySchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Category", categorySchema);

