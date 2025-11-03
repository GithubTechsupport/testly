import type { Request, Response } from "express";

import {
  getBookDetail,
  getPublicBookSummaries,
  getUserLibrarySummaries,
  uploadBookAndTriggerPipeline,
} from "../services/book.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";
import { uploadBookSchema } from "../validators/book.validators.js";

export const getPublicBooksHandler = asyncHandler(async (req: Request, res: Response) => {
  const summaries = await getPublicBookSummaries(req.user);
  res.json({ books: summaries });
});

export const getMyBooksHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  const summaries = await getUserLibrarySummaries(user);
  res.json({ books: summaries });
});

export const getBookDetailHandler = asyncHandler(async (req: Request, res: Response) => {
  const { bookId } = req.params;
  const detail = await getBookDetail(bookId, req.user);
  res.json({ book: detail });
});

type UploadFields = Partial<Record<"pdfFile" | "coverImage", Express.Multer.File[]>>;

export const uploadBookHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  const { bookTitle, visibility, useOcr } = uploadBookSchema.parse(req.body);

  const files = req.files as UploadFields | undefined;
  const pdfFile = files?.pdfFile?.[0];

  if (!pdfFile) {
    throw new HttpError(400, "A PDF file is required");
  }

  if (!pdfFile.mimetype.includes("pdf")) {
    throw new HttpError(400, "Uploaded file must be a PDF");
  }

  const coverImage = files?.coverImage?.[0];

  const result = await uploadBookAndTriggerPipeline({
    user,
    bookTitle,
    visibility,
    pdfFile: {
      buffer: pdfFile.buffer,
      mimetype: pdfFile.mimetype,
      originalName: pdfFile.originalname,
    },
    coverImage: coverImage
      ? {
          buffer: coverImage.buffer,
          mimetype: coverImage.mimetype,
          originalName: coverImage.originalname,
        }
      : undefined,
    useOcr,
  });

  res.status(202).json(result);
});
