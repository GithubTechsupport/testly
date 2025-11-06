import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import { AddBookCard } from "@/features/books/components/add-book-card";
import { BookCard } from "@/features/books/components/book-card";
import { BookCardSkeleton } from "@/features/books/components/book-card-skeleton";
import { ChapterExplorerModal } from "@/features/books/components/chapter-explorer-modal";
import { UploadBookModal } from "@/features/books/components/upload-book-modal";
import { useDeleteBook, useMyBooks } from "@/features/books/hooks";
import type { BookSummaryDto } from "@/features/books/types";

export function MyBooksPage() {
  const { data, isLoading, error } = useMyBooks();
  const deleteMutation = useDeleteBook();
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [chapterTarget, setChapterTarget] = useState<{ id: string; title: string } | null>(
    null
  );

  const books: BookSummaryDto[] = data ?? [];
  const totalBooks = books.length;
  const publicBooks = useMemo(
    () => books.filter((book: BookSummaryDto) => book.visibility === "Public").length,
    [books]
  );

  const openChapters = (bookId: string) => {
    const book = books.find((item: BookSummaryDto) => item.id === bookId);
    if (book) {
      setChapterTarget({ id: book.id, title: book.bookTitle });
    }
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">My Books</h1>
        <p className="text-sm text-slate-400">
          Manage your private uploads and curated public titles. Launch the upload pipeline when you
          add new material.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-slate-700 px-3 py-1">
            Total books: <strong className="ml-1 text-slate-200">{totalBooks}</strong>
          </span>
          <span className="rounded-full border border-slate-700 px-3 py-1">
            Public titles: <strong className="ml-1 text-slate-200">{publicBooks}</strong>
          </span>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load your library. Please try again shortly.</span>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => <BookCardSkeleton key={index} />)
          : books.map((book: BookSummaryDto) => (
              <BookCard
                key={book.id}
                book={book}
                onShowChapters={openChapters}
                onDeleteBook={(id) => deleteMutation.mutate(id)}
              />
            ))}

        <AddBookCard onClick={() => setUploadOpen(true)} />
      </div>

      <UploadBookModal open={isUploadOpen} onClose={() => setUploadOpen(false)} />

      {chapterTarget ? (
        <ChapterExplorerModal
          open={!!chapterTarget}
          onClose={() => setChapterTarget(null)}
          bookId={chapterTarget.id}
          bookTitle={chapterTarget.title}
        />
      ) : null}
    </section>
  );
}
