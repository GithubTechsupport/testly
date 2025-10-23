import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface BookCardSkeletonProps {
  className?: string;
}

export function BookCardSkeleton({ className }: BookCardSkeletonProps) {
  return (
    <Card className={cn("flex h-full flex-col animate-pulse overflow-hidden", className)}>
      <div className="h-48 w-full bg-slate-800/60" />
      <CardContent className="flex flex-1 flex-col space-y-3">
        <div className="h-5 w-3/4 rounded bg-slate-800/70" />
        <div className="h-4 w-1/2 rounded bg-slate-800/60" />
        <div className="mt-auto h-3 w-1/3 rounded bg-slate-800/50" />
      </CardContent>
      <CardFooter>
        <div className="h-10 w-full rounded bg-slate-800/60" />
      </CardFooter>
    </Card>
  );
}
