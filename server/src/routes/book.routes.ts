import { Router } from "express";

import {
  getBookDetailHandler,
  getMyBooksHandler,
  getPublicBooksHandler,
  uploadBookHandler,
  deleteBookHandler,
} from "../controllers/book.controller.js";
import { authenticate, optionalAuthenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

export const bookRouter = Router();

bookRouter.get("/public", optionalAuthenticate, getPublicBooksHandler);
bookRouter.get("/me", authenticate, getMyBooksHandler);
bookRouter.post(
  "/upload",
  authenticate,
  upload.fields([
    { name: "pdfFile", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  uploadBookHandler,
);
bookRouter.get("/:bookId", optionalAuthenticate, getBookDetailHandler);
bookRouter.delete("/:bookId", authenticate, deleteBookHandler);