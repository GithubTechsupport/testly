import { config } from "dotenv";

config();

const required = <T extends string>(value: T | undefined, name: string): T => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required(process.env.MONGO_URI, "MONGO_URI"),
  jwtSecret: required(process.env.JWT_SECRET, "JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  flaskBaseUrl: process.env.FLASK_BASE_URL ?? "http://localhost:5001",
  awsRegion: required(process.env.AWS_REGION, "AWS_REGION"),
  awsBucketName: required(process.env.AWS_BUCKET_NAME, "AWS_BUCKET_NAME"),
  awsAccessKey: required(process.env.AWS_ACCESS_KEY_ID, "AWS_ACCESS_KEY_ID"),
  awsSecretKey: required(process.env.AWS_SECRET_ACCESS_KEY, "AWS_SECRET_ACCESS_KEY"),
};
