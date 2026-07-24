const mongoose = require("mongoose");

function normalizedDatabaseName(value = "studox_ai") {
  const normalized = String(value)
    .trim()
    .replace(/[\s./\\$"'<>:|?*]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "studox_ai";
}

async function connectDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log("MongoDB URI not provided. Using in-memory demo store.");
    return false;
  }

  try {
    await mongoose.connect(uri, {
      dbName: normalizedDatabaseName(process.env.MONGO_DB_NAME),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
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
module.exports.normalizedDatabaseName = normalizedDatabaseName;
