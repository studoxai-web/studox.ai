const mongoose = require("mongoose");

async function connectDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log("MongoDB URI not provided. Using in-memory demo store.");
    return false;
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DB_NAME || "studox_ai",
    });
    console.log("MongoDB connected.");
    return true;
  } catch (error) {
    console.warn("MongoDB connection failed. Falling back to in-memory demo store.");
    console.warn(error.message);
    return false;
  }
}

module.exports = connectDatabase;
