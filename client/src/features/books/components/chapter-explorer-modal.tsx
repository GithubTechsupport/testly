import { useMemo, useState } from "react";
import { Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useBookDetail } from "@/features/books/hooks";
import type { ChapterDto } from "@/features/books/types";

interface ChapterExplorerModalProps {
  bookId: string;
  bookTitle: string;
  open: boolean;
  onClose: () => void;
}

export function ChapterExplorerModal({
  bookId,
  bookTitle,
  open,
  onClose,
}: ChapterExplorerModalProps) {
  const { data, isLoading } = useBookDetail(bookId, open);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const selectedChapter = useMemo(() => {
    if (!selectedChapterId || !data) return null;
    return (
      data.chapters.find((chapter: ChapterDto) => chapter.id === selectedChapterId) ??
      null
    );
  }, [selectedChapterId, data]);

  const closeSubchapter = () => setSelectedChapterId(null);

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          closeSubchapter();
          onClose();
        }}
        title={`Chapters in ${bookTitle}`}
        description="Inspect the chapter list and drill down to subchapters."
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            {data.chapters.map((chapter: ChapterDto) => (
              <div
                key={chapter.id}
                className="flex items-start justify-between rounded-xl border border-slate-800/70 bg-slate-900/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <Layers className="mt-1 h-5 w-5 text-brand" />
                  <div>
                    <p className="font-semibold text-slate-100">{chapter.title}</p>
                    <p className="text-xs text-slate-400">
                      Pages {chapter.pageStart} – {chapter.pageEnd}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {chapter.subchapters.length} subchapters
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedChapterId(chapter.id)}
                >
                  View subchapters
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No chapters found for this book.</p>
        )}
      </Modal>

      {selectedChapter ? (
        <Modal
          open={!!selectedChapter}
          onClose={closeSubchapter}
          title={selectedChapter.title}
          description={`Subchapters for ${selectedChapter.title}`}
        >
          <SubchapterList chapter={selectedChapter} />
        </Modal>
      ) : null}
    </>
  );
}

function SubchapterList({ chapter }: { chapter: ChapterDto }) {
  if (!chapter.subchapters.length) {
    return <p className="text-sm text-slate-400">No subchapters available.</p>;
  }

  return (
    <ol className="space-y-3">
      {chapter.subchapters.map((sub) => (
        <li
          key={sub.id}
          className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-4"
        >
          <p className="text-sm font-medium text-white">{sub.title}</p>
          <p className="text-xs text-slate-400">
            Pages {sub.pageStart} – {sub.pageEnd}
          </p>
        </li>
      ))}
    </ol>
  );
}
