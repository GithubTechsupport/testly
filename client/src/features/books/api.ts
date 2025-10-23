import { apiClient } from "@/lib/api-client";

import type {
  BookDetailDto,
  BookSummaryDto,
  LibraryMutationResponse,
  UploadBookResponse,
  VisibilityOption,
} from "./types";

export async function fetchMyBooks() {
  const response = await apiClient.get<{ books: BookSummaryDto[] }>("/books/me");
  return response.data.books;
}

export async function fetchPublicBooks() {
  const response = await apiClient.get<{ books: BookSummaryDto[] }>("/books/public");
  return response.data.books;
}

export async function fetchBookDetail(bookId: string) {
  const response = await apiClient.get<{ book: BookDetailDto }>(`/books/${bookId}`);
  return response.data.book;
}

export interface UploadBookPayload {
  bookTitle: string;
  visibility: VisibilityOption;
  pdfFile: File;
  coverImage?: File | null;
}

export async function uploadBook(payload: UploadBookPayload) {
  const formData = new FormData();
  formData.append("bookTitle", payload.bookTitle);
  formData.append("visibility", payload.visibility);
  formData.append("pdfFile", payload.pdfFile);
  if (payload.coverImage) {
    formData.append("coverImage", payload.coverImage);
  }

  const response = await apiClient.post<UploadBookResponse>('/books/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function addBookToLibrary(bookId: string) {
  const response = await apiClient.post<LibraryMutationResponse>(
    `/books/${bookId}/library`
  );
  return response.data;
}
