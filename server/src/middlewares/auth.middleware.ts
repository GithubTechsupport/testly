import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { verifyAccessToken } from "../utils/jwt.js";
import { HttpError } from "../utils/http-error.js";
import { UserModel } from "../models/user.model.js";

const getTokenFromHeader = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      throw new HttpError(401, "Authentication required");
    }

    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.sub).exec();
    if (!user) {
      throw new HttpError(401, "Invalid token");
    }

    req.user = user;
    next();
  } catch (error) {
    // Map JWT errors to 401 Unauthorized instead of generic 500s
    if (error instanceof (jwt as any).TokenExpiredError) {
      return next(new HttpError(401, "Token expired"));
    }
    if (error instanceof (jwt as any).JsonWebTokenError) {
      return next(new HttpError(401, "Invalid token"));
    }
    return next(error);
  }
}

export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return next();
    }
    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.sub).exec();
    if (user) {
      req.user = user;
    }
    return next();
  } catch (error) {
    return next();
  }
}
