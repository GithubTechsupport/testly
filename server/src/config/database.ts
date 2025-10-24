import mongoose from "mongoose";

import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDatabase() {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.mongoUri);
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error("Failed to connect to MongoDB", error);
    process.exit(1);
  }
}
