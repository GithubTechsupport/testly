import { PlusCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface AddBookCardProps {
  onClick: () => void;
}

export function AddBookCard({ onClick }: AddBookCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group h-full w-full"
    >
      <Card className="flex h-full flex-col items-center justify-center border-dashed border-slate-700 bg-slate-900/40 text-slate-400 transition hover:border-brand/60 hover:text-white">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
          <PlusCircle className="h-10 w-10 text-brand" />
          <span className="text-sm font-medium uppercase tracking-wide">
            Upload new book
          </span>
        </CardContent>
      </Card>
    </button>
  );
}
