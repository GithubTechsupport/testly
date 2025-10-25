import type { Request, Response } from "express";

import { registerUser, loginUser } from "../services/auth.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { loginSchema, registerSchema } from "../validators/auth.validators.js";

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const payload = registerSchema.parse(req.body);
  const result = await registerUser(payload);
  res.status(201).json({ data: result });
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const result = await loginUser(payload);
  res.json({ data: result });
});
