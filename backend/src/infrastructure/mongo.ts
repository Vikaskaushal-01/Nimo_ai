import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

let connected = false;

export const connectMongo = async (): Promise<void> => {
  if (connected) return;
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    connected = true;
    logger.info("MongoDB connected", { uri: redact(env.MONGO_URI) });
  } catch (err) {
    logger.error("MongoDB connection failed", { error: String(err) });
    throw err;
  }

  mongoose.connection.on("disconnected", () => {
    connected = false;
    logger.warn("MongoDB disconnected");
  });
};

export const disconnectMongo = async (): Promise<void> => {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
};

export const mongoHealth = (): "up" | "down" =>
  mongoose.connection.readyState === 1 ? "up" : "down";

const redact = (uri: string): string => uri.replace(/\/\/([^@]+)@/, "//***@");
