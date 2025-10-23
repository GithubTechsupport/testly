import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { getAxiosErrorMessage } from "@/lib/axios-error";

import {
  addBookToLibrary,
  fetchBookDetail,
  fetchMyBooks,
  fetchPublicBooks,
  uploadBook,
  type UploadBookPayload,
} from "./api";
import type {
  LibraryMutationResponse,
  UploadBookResponse,
} from "./types";

export function useMyBooks() {
  return useQuery({
    queryKey: ["books", "me"],
    queryFn: fetchMyBooks,
  });
}

export function usePublicBooks() {
  return useQuery({
    queryKey: ["books", "public"],
    queryFn: fetchPublicBooks,
  });
}

export function useBookDetail(bookId: string, enabled = true) {
  return useQuery({
    queryKey: ["books", bookId],
    queryFn: () => fetchBookDetail(bookId),
    enabled: Boolean(bookId) && enabled,
  });
}

export function useUploadBook() {
  const queryClient = useQueryClient();
  return useMutation<UploadBookResponse, unknown, UploadBookPayload>({
    mutationFn: (payload: UploadBookPayload) => uploadBook(payload),
    onSuccess: (data: UploadBookResponse) => {
      toast.success(data.message ?? "Upload started");
      queryClient.invalidateQueries({ queryKey: ["books", "me"] });
      queryClient.invalidateQueries({ queryKey: ["books", "public"] });
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error));
    },
  });
}

export function useLibraryMutation() {
  const queryClient = useQueryClient();
  return useMutation<LibraryMutationResponse, unknown, string>({
    mutationFn: (bookId: string) => addBookToLibrary(bookId),
    onSuccess: (data: LibraryMutationResponse, bookId: string) => {
      toast.success(data.message ?? "Book added to your library");
      queryClient.invalidateQueries({ queryKey: ["books", "me"] });
      queryClient.invalidateQueries({ queryKey: ["books", "public"] });
      queryClient.invalidateQueries({ queryKey: ["books", bookId] });
    },
    onError: (error: unknown) => {
      toast.error(getAxiosErrorMessage(error));
    },
  });
}
