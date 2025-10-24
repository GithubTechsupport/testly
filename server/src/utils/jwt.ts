import jwt, { type JwtPayload as JwtPayloadType, type Secret, type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";

interface JwtPayload {
  sub: string;
  username: string;
  email: string;
}

const jwtSecret: Secret = env.jwtSecret;
const signOptions: SignOptions = {
  expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
};

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, jwtSecret, signOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, jwtSecret) as JwtPayload & JwtPayloadType;
}
