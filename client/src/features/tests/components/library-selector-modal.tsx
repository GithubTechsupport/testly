import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useBookDetail, useMyBooks } from "@/features/books/hooks";
import type {
  BookDetailDto,
  BookSummaryDto,
  ChapterDto,
  SubchapterDto,
} from "@/features/books/types";

import type { TestLibraryEntry, TestLibraryEntryType } from "../types";

interface LibrarySelectorModalProps {
  open: boolean;
  onClose: () => void;
  selectedEntries: TestLibraryEntry[];
  onApply: (entries: TestLibraryEntry[]) => void;
}

interface BookDetailCache {
  [bookId: string]: BookDetailDto;
}

export function LibrarySelectorModal({
  open,
  onClose,
  selectedEntries,
  onApply,
}: LibrarySelectorModalProps) {
  const { data: books, isLoading } = useMyBooks();
  const [selectionMap, setSelectionMap] = useState<Map<string, TestLibraryEntry>>(new Map());
  const [detailsCache, setDetailsCache] = useState<BookDetailCache>({});

  useEffect(() => {
    if (open) {
      const next = new Map<string, TestLibraryEntry>();
      selectedEntries.forEach((entry) => {
        next.set(buildEntryKey(entry.type, entry.id), entry);
      });
      setSelectionMap(next);
    }
  }, [open, selectedEntries]);

  const isSelected = useCallback(
    (type: TestLibraryEntryType, id: string) => selectionMap.has(buildEntryKey(type, id)),
    [selectionMap]
  );

  const toggleEntry = useCallback((entry: TestLibraryEntry) => {
    setSelectionMap((prev) => {
      const next = new Map(prev);
      const key = buildEntryKey(entry.type, entry.id);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, entry);
      }
      return next;
    });
  }, []);

  const handleDetailLoaded = useCallback((detail: BookDetailDto) => {
    setDetailsCache((prev) => {
      if (prev[detail.id]) {
        return prev;
      }
      return { ...prev, [detail.id]: detail };
    });
  }, []);

  const orderedSelection = useMemo(() => {
    if (!books || !books.length) {
      return Array.from(selectionMap.values());
    }
    return orderSelection(Array.from(selectionMap.values()), books, detailsCache);
  }, [books, detailsCache, selectionMap]);

  const handleApply = () => {
    onApply(orderedSelection);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add content from your library"
      description="Select books, chapters, or subchapters to include in the test."
      className="max-w-4xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">{selectionMap.size} entries selected</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/70 dark:bg-slate-950/60">
          <div className="max-h-[26rem] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex min-h-[12rem] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : books && books.length ? (
              <div className="space-y-3 pb-1">
                {books.map((book) => (
                  <LibraryBookItem
                    key={book.id}
                    book={book}
                    modalOpen={open}
                    isSelected={isSelected}
                    toggleEntry={toggleEntry}
                    cachedDetail={detailsCache[book.id]}
                    onDetailLoaded={handleDetailLoaded}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No books available in your library.</p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Selected items will appear in the test builder in the same order as shown here.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={selectionMap.size === 0} onClick={handleApply}>
              Use selection
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface LibraryBookItemProps {
  book: BookSummaryDto;
  modalOpen: boolean;
  isSelected: (type: TestLibraryEntryType, id: string) => boolean;
  toggleEntry: (entry: TestLibraryEntry) => void;
  cachedDetail?: BookDetailDto;
  onDetailLoaded: (detail: BookDetailDto) => void;
}

function LibraryBookItem({
  book,
  modalOpen,
  isSelected,
  toggleEntry,
  cachedDetail,
  onDetailLoaded,
}: LibraryBookItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useBookDetail(book.id, modalOpen && expanded);

  useEffect(() => {
    if (data) {
      onDetailLoaded(data);
    }
  }, [data, onDetailLoaded]);

  const detail = data ?? cachedDetail;
  const bookEntry = useMemo(() => createBookEntry(book), [book]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/60 dark:bg-slate-900/50">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-start gap-3 text-left text-slate-700 dark:text-slate-200"
        >
          {expanded ? (
            <ChevronDown className="mt-1 h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 text-slate-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{book.bookTitle}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {book.chapterCount} chapters • {book.visibility.toLowerCase()}
            </p>
          </div>
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={isSelected("book", book.id)}
            onChange={() => toggleEntry(bookEntry)}
            className="h-4 w-4 rounded border border-slate-400 bg-white text-brand focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          />
          <span>Select</span>
        </label>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3 pl-7">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : detail ? (
            detail.chapters.map((chapter) => (
              <LibraryChapterItem
                key={chapter.id}
                book={book}
                chapter={chapter}
                isSelected={isSelected}
                toggleEntry={toggleEntry}
              />
            ))
          ) : (
            <p className="text-xs text-slate-500">No chapters available.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface LibraryChapterItemProps {
  book: BookSummaryDto;
  chapter: ChapterDto;
  isSelected: (type: TestLibraryEntryType, id: string) => boolean;
  toggleEntry: (entry: TestLibraryEntry) => void;
}

function LibraryChapterItem({ book, chapter, isSelected, toggleEntry }: LibraryChapterItemProps) {
  const chapterEntry = useMemo(() => createChapterEntry(book, chapter), [book, chapter]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800/60 dark:bg-slate-900/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Layers className="mt-1 h-4 w-4 text-brand" />
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{chapter.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pages {chapter.pageStart} – {chapter.pageEnd}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={isSelected("chapter", chapter.id)}
            onChange={() => toggleEntry(chapterEntry)}
            className="h-4 w-4 rounded border border-slate-400 bg-white text-brand focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          />
          <span>Select</span>
        </label>
      </div>

      {chapter.subchapters.length ? (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800/60">
          {chapter.subchapters.map((subchapter) => (
            <LibrarySubchapterRow
              key={subchapter.id}
              book={book}
              chapter={chapter}
              subchapter={subchapter}
              isSelected={isSelected}
              toggleEntry={toggleEntry}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface LibrarySubchapterRowProps {
  book: BookSummaryDto;
  chapter: ChapterDto;
  subchapter: SubchapterDto;
  isSelected: (type: TestLibraryEntryType, id: string) => boolean;
  toggleEntry: (entry: TestLibraryEntry) => void;
}

function LibrarySubchapterRow({
  book,
  chapter,
  subchapter,
  isSelected,
  toggleEntry,
}: LibrarySubchapterRowProps) {
  const entry = useMemo(() => createSubchapterEntry(book, chapter, subchapter), [
    book,
    chapter,
    subchapter,
  ]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800/60 dark:bg-slate-950/40">
      <div>
        <p className="text-xs font-medium text-slate-900 dark:text-white">{subchapter.title}</p>
        <p className="text-[11px] text-slate-500">
          Pages {subchapter.pageStart} – {subchapter.pageEnd}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={isSelected("subchapter", subchapter.id)}
          onChange={() => toggleEntry(entry)}
          className="h-4 w-4 rounded border border-slate-400 bg-white text-brand focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />
        <span>Select</span>
      </label>
    </div>
  );
}

function buildEntryKey(type: TestLibraryEntryType, id: string): string {
  return `${type}:${id}`;
}

function createBookEntry(book: BookSummaryDto): TestLibraryEntry {
  return {
    id: book.id,
    type: "book",
    name: book.bookTitle,
    bookId: book.id,
  };
}

function createChapterEntry(book: BookSummaryDto, chapter: ChapterDto): TestLibraryEntry {
  return {
    id: chapter.id,
    type: "chapter",
    name: chapter.title,
    bookId: book.id,
    chapterId: chapter.id,
  };
}

function createSubchapterEntry(
  book: BookSummaryDto,
  chapter: ChapterDto,
  subchapter: SubchapterDto
): TestLibraryEntry {
  return {
    id: subchapter.id,
    type: "subchapter",
    name: subchapter.title,
    bookId: book.id,
    chapterId: chapter.id,
    subchapterId: subchapter.id,
  };
}

function orderSelection(
  entries: TestLibraryEntry[],
  books: BookSummaryDto[],
  details: BookDetailCache
): TestLibraryEntry[] {
  const ordered: TestLibraryEntry[] = [];
  const seen = new Set<string>();

  books.forEach((book) => {
    const bookKey = buildEntryKey("book", book.id);
    const bookEntry = entries.find((entry) => buildEntryKey(entry.type, entry.id) === bookKey);
    if (bookEntry) {
      ordered.push(bookEntry);
      seen.add(bookKey);
    }

    const detail = details[book.id];
    if (!detail) {
      return;
    }

    detail.chapters.forEach((chapter) => {
      const chapterKey = buildEntryKey("chapter", chapter.id);
      const chapterEntry = entries.find(
        (entry) => buildEntryKey(entry.type, entry.id) === chapterKey
      );
      if (chapterEntry) {
        ordered.push(chapterEntry);
        seen.add(chapterKey);
      }

      chapter.subchapters.forEach((subchapter) => {
        const subKey = buildEntryKey("subchapter", subchapter.id);
        const subEntry = entries.find(
          (entry) => buildEntryKey(entry.type, entry.id) === subKey
        );
        if (subEntry) {
          ordered.push(subEntry);
          seen.add(subKey);
        }
      });
    });
  });

  entries.forEach((entry) => {
    const key = buildEntryKey(entry.type, entry.id);
    if (!seen.has(key)) {
      ordered.push(entry);
    }
  });

  return ordered;
}
