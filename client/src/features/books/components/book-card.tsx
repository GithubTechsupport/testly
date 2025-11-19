import { memo } from "react";
import { Bookmark, Check, Library, Layers, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import type { BookSummaryDto } from "../types";

interface BookCardProps {
  book: BookSummaryDto;
  onShowChapters?: (bookId: string) => void;
  onAddToLibrary?: (bookId: string) => void;
  onDeleteBook?: (bookId: string) => void;
  isAdding?: boolean;
  variant?: "library" | "catalog";
}

const placeholderCover = [
  "bg-gradient-to-br from-indigo-100 via-white to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950",
  "bg-gradient-to-br from-purple-100 via-white to-slate-50 dark:from-indigo-800 dark:via-slate-900 dark:to-slate-950",
  "bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-purple-800 dark:via-slate-900 dark:to-slate-950",
];

export const BookCard = memo(function BookCard({
  book,
  onShowChapters,
  onAddToLibrary,
  onDeleteBook,
  isAdding = false,
  variant = "library",
}: BookCardProps) {
  const fallbackIndex = book.bookTitle.length % placeholderCover.length;
  const initials = book.bookTitle
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const isProcessing = book.state === "processing";
  return (
    <Card className={cn("group relative flex h-full flex-col overflow-hidden", isProcessing && "opacity-60 grayscale")}
      aria-disabled={isProcessing}
    >
      <div className="relative">
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt={`${book.bookTitle} cover`}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className={cn(
              "flex h-48 w-full items-center justify-center text-3xl font-semibold text-slate-500 dark:text-slate-200",
              placeholderCover[fallbackIndex]
            )}
            aria-hidden
          >
            {initials}
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm dark:bg-slate-950/80 dark:text-slate-300">
          {book.visibility}
        </span>
        {isProcessing ? (
          <span className="absolute right-4 top-4 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
            Processing…
          </span>
        ) : null}

        {onDeleteBook && !isProcessing ? (
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 backdrop-blur transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 dark:hover:text-red-200"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteBook(book.id);
            }}
            aria-label="Delete book"
            disabled={false}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <CardContent className="flex flex-1 flex-col space-y-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">
            {book.bookTitle}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">by {book.uploaderName}</p>
        </div>

        <div className="mt-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Layers className="h-4 w-4" />
          <span>{book.chapterCount} chapters</span>
        </div>
      </CardContent>

      <CardFooter className="mt-auto gap-3">
        {onShowChapters ? (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onShowChapters(book.id)}
            disabled={isProcessing}
            leftIcon={<Bookmark className="h-4 w-4" />}
          >
            Chapters
          </Button>
        ) : null}

        {variant === "catalog" && onAddToLibrary ? (
          <Button
            variant={book.isInLibrary ? "ghost" : "primary"}
            size="icon"
            className={cn(
              "shrink-0",
              book.isInLibrary
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : ""
            )}
            onClick={() => onAddToLibrary(book.id)}
            disabled={isProcessing}
            isLoading={isAdding}
            aria-label={
              book.isInLibrary ? "Already in your library" : "Add to My Books"
            }
          >
            {book.isInLibrary ? <Check className="h-5 w-5" /> : <Library className="h-5 w-5" />}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
});
