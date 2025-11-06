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

export interface BookSummaryDto {
  id: string;
  bookTitle: string;
  coverImageUrl?: string | null;
  visibility: "Public" | "Private";
  uploaderName: string;
  uploaderId: string;
  state?: "processing" | "finished";
  chapterCount: number;
  isInLibrary?: boolean;
}

export interface BookDetailDto extends BookSummaryDto {
  chapters: ChapterDto[];
}

export interface UploadBookResponse {
  bookId: string;
  status: "queued" | "processing" | "complete";
  message: string;
}

export type VisibilityOption = "Public" | "Private";

export interface LibraryMutationResponse {
  status: string;
  message: string;
  alreadyInLibrary?: boolean;
}

export interface DeleteBookResponse {
  status: "accepted";
  message: string;
}
