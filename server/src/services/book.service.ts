import { Types } from "mongoose";

import { BookModel, type BookDocument } from "../models/book.model.js";
import { ChapterModel } from "../models/chapter.model.js";
import { SubchapterModel } from "../models/subchapter.model.js";
import { UserModel, type UserDocument } from "../models/user.model.js";
import { HttpError } from "../utils/http-error.js";
import { uploadBufferToS3 } from "./s3.service.js";
import { triggerUploadPipeline } from "./flask.service.js";
import { slugify } from "../utils/slugify.js";
import { logger } from "../utils/logger.js";

export interface FilePayload {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
}

export interface UploadBookInput {
  user: UserDocument;
  bookTitle: string;
  visibility: "Public" | "Private";
  pdfFile: FilePayload;
  coverImage?: FilePayload;
  useOcr?: boolean;
}

export interface UploadBookResult {
  bookId: string;
  status: "queued" | "processing" | "complete";
  message: string;
}

export interface BookSummaryDto {
  id: string;
  bookTitle: string;
  visibility: "Public" | "Private";
  uploaderName: string;
  uploaderId: string;
  coverImageUrl?: string;
  chapterCount: number;
  isInLibrary: boolean;
}

export interface SubchapterDto {
  id: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  s3Link?: string;
}

export interface ChapterDto {
  id: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  subchapters: SubchapterDto[];
}

export interface BookDetailDto extends BookSummaryDto {
  chapters: ChapterDto[];
}

const buildBookSummary = (
  book: BookDocument,
  libraryIds: Set<string>
): BookSummaryDto => ({
  id: book._id.toString(),
  bookTitle: book.bookTitle,
  visibility: book.visibility,
  uploaderName: book.uploaderName ?? "Unknown",
  uploaderId: book.uploader.toString(),
  coverImageUrl: book.coverImageUrl,
  chapterCount: book.chapterIds.length,
  isInLibrary: libraryIds.has(book._id.toString()),
});

export async function getUserLibrarySummaries(user: UserDocument) {
  if (!user.libraryBookIDs.length) {
    return [] as BookSummaryDto[];
  }

  const libraryIdsSet = new Set(user.libraryBookIDs.map((id) => id.toString()));

  const books = await BookModel.find({ _id: { $in: user.libraryBookIDs } })
    .sort({ createdAt: -1 })
    .exec();

  return books.map((book) => buildBookSummary(book, libraryIdsSet));
}

export async function getPublicBookSummaries(user?: UserDocument) {
  const libraryIdsSet = new Set(user?.libraryBookIDs.map((id) => id.toString()) ?? []);
  const books = await BookModel.find({ visibility: "Public" }).sort({ bookTitle: 1 }).exec();
  return books.map((book) => buildBookSummary(book, libraryIdsSet));
}

export async function getBookDetail(bookId: string, user?: UserDocument) {
  if (!Types.ObjectId.isValid(bookId)) {
    throw new HttpError(400, "Invalid book ID");
  }
  const book = await BookModel.findById(bookId).exec();
  if (!book) {
    throw new HttpError(404, "Book not found");
  }

  if (book.visibility === "Private" && user && book.uploader.toString() !== user._id.toString()) {
    throw new HttpError(403, "You do not have access to this book");
  }

  const chapterDocs = await ChapterModel.find({ _id: { $in: book.chapterIds } }).exec();
  const chapterMap = new Map<string, ChapterDto>();

  for (const chapter of chapterDocs) {
    const orderedSubIds = chapter.subchapterIds.map((id) => id.toString());
    const subDocs = await SubchapterModel.find({ _id: { $in: orderedSubIds } }).exec();
    const subMap = new Map(subDocs.map((sub) => [sub._id.toString(), sub]));

    const subchapters: SubchapterDto[] = orderedSubIds
      .map((id) => subMap.get(id))
      .filter((sub): sub is typeof subDocs[number] => Boolean(sub))
      .map((sub) => ({
        id: sub._id.toString(),
        title: sub.subchapterTitle,
        pageStart: sub.pageStart,
        pageEnd: sub.pageEnd,
        s3Link: sub.s3Link,
      }));

    chapterMap.set(chapter._id.toString(), {
      id: chapter._id.toString(),
      title: chapter.chapterTitle,
      pageStart: chapter.pageStart,
      pageEnd: chapter.pageEnd,
      subchapters,
    });
  }

  const orderedChapters: ChapterDto[] = book.chapterIds
    .map((id) => chapterMap.get(id.toString()))
    .filter((chapter): chapter is ChapterDto => Boolean(chapter));

  const summary = buildBookSummary(book, new Set(user?.libraryBookIDs.map((id) => id.toString()) ?? []));

  const detail: BookDetailDto = {
    ...summary,
    chapters: orderedChapters,
  };

  return detail;
}

export async function addBookToLibrary(user: UserDocument, bookId: string) {
  if (!Types.ObjectId.isValid(bookId)) {
    throw new HttpError(400, "Invalid book ID");
  }

  const book = await BookModel.findById(bookId).exec();
  if (!book) {
    throw new HttpError(404, "Book not found");
  }

  if (book.visibility === "Private" && book.uploader.toString() !== user._id.toString()) {
    throw new HttpError(403, "You cannot add a private book you did not upload");
  }

  const updated = await UserModel.updateOne(
    { _id: user._id },
    {
      $addToSet: {
        libraryBookIDs: book._id,
      },
    }
  );

  const alreadyInLibrary = updated.modifiedCount === 0;
  return {
    status: "ok",
    message: alreadyInLibrary ? "Book already in your library" : "Book added to your library",
    alreadyInLibrary,
  };
}

export async function uploadBookAndTriggerPipeline({
  user,
  bookTitle,
  visibility,
  pdfFile,
  coverImage,
  useOcr = false,
}: UploadBookInput): Promise<UploadBookResult> {
  const safeTitle = bookTitle.trim();
  const slug = slugify(safeTitle) || `book-${Date.now()}`;
  const timestamp = Date.now();

  const pdfKey = `books/${user._id.toString()}/${slug}-${timestamp}.pdf`;
  const pdfUrl = await uploadBufferToS3({
    buffer: pdfFile.buffer,
    key: pdfKey,
    contentType: pdfFile.mimetype,
  });

  let coverUrl: string | undefined;
  if (coverImage) {
    const extension = coverImage.originalName.split(".").pop() ?? "jpg";
    const coverKey = `covers/${user._id.toString()}/${slug}-${timestamp}.${extension}`;
    try {
      coverUrl = await uploadBufferToS3({
        buffer: coverImage.buffer,
        key: coverKey,
        contentType: coverImage.mimetype,
      });
    } catch (error) {
      logger.warn("Failed to upload cover image", error);
    }
  }

  const pipelineResponse = await triggerUploadPipeline({
    book_name: safeTitle,
    s3_link: pdfUrl,
    visibility,
    uploader: user._id.toString(),
    use_ocr: useOcr,
  });

  const bookObjectId = new Types.ObjectId(pipelineResponse.book_id);

  await BookModel.updateOne(
    { _id: bookObjectId },
    {
      $set: {
        coverImageUrl: coverUrl,
        uploaderName: user.username,
      },
    }
  ).exec();

  await UserModel.updateOne(
    { _id: user._id },
    {
      $addToSet: {
        uploadedDocumentIDs: bookObjectId,
        libraryBookIDs: bookObjectId,
      },
    }
  ).exec();

  return {
    bookId: pipelineResponse.book_id,
    status: (pipelineResponse.status as UploadBookResult["status"]) ?? "queued",
    message: "Upload pipeline triggered",
  };
}
