import { useMemo, useState } from "react";
import { AlertCircle, Filter } from "lucide-react";

import { BookCard } from "@/features/books/components/book-card";
import { BookCardSkeleton } from "@/features/books/components/book-card-skeleton";
import { ChapterExplorerModal } from "@/features/books/components/chapter-explorer-modal";
import { useLibraryMutation, usePublicBooks } from "@/features/books/hooks";
import type { BookSummaryDto } from "@/features/books/types";

export function BrowsePage() {
  const { data, isLoading, error } = usePublicBooks();
  const libraryMutation = useLibraryMutation();
  const [chapterTarget, setChapterTarget] = useState<{ id: string; title: string } | null>(
    null
  );

  const books: BookSummaryDto[] = useMemo(() => data ?? [], [data]);

  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => a.bookTitle.localeCompare(b.bookTitle));
  }, [books]);

  const handleAdd = (bookId: string) => {
    const book = books.find((item) => item.id === bookId);
    if (book?.isInLibrary) return;
    libraryMutation.mutate(bookId);
  };

  const handleChapters = (bookId: string) => {
    const book = books.find((item) => item.id === bookId);
    if (book) {
      setChapterTarget({ id: book.id, title: book.bookTitle });
    }
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Browse catalog</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Explore curated public textbooks and bring them into your personal library.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span className="rounded-full border border-slate-300 px-3 py-1 dark:border-slate-700">
            <Filter className="mr-2 inline h-4 w-4" /> {sortedBooks.length} available titles
          </span>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to fetch the catalog. Please retry.</span>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => <BookCardSkeleton key={index} />)
          : sortedBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onShowChapters={handleChapters}
                onAddToLibrary={handleAdd}
                isAdding={libraryMutation.isPending && libraryMutation.variables === book.id}
                variant="catalog"
              />
            ))}
      </div>

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
