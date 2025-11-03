import { Router } from "express";

import { authRouter } from "./auth.routes.js";
import { bookRouter } from "./book.routes.js";
import { healthRouter } from "./health.routes.js";

export const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/books", bookRouter);
