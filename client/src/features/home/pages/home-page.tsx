import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  selectCurrentUser,
  selectIsAuthenticated,
  useAuthStore,
} from "@/features/auth/store";

export function HomePage() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore(selectCurrentUser);

  return (
    <section className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-light">
            Exams orchestrated by AI
          </p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Craft tailored exam sets from the textbooks that matter.
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Testly turns your PDFs into a smart, searchable library and lets you
            blend chapters across books to generate engaging assessments. Upload,
            explore, curate, and launch exams in minutes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAuthenticated ? (
            <Button asChild size="lg">
              <Link to="/my-books">Go to your library</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link to="/register">Create a Testly account</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link to="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-slate-900/90 to-slate-950/90">
          <CardContent className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              {isAuthenticated && user ? `Welcome back, ${user.username}!` : "What you can do"}
            </h2>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>• Upload and embed your textbooks instantly.</li>
              <li>• Mix & match chapters across your library.</li>
              <li>• Generate AI-powered exam sets customized to your needs.</li>
              <li>• Keep public titles in sync with your personal collection.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-brand/20 bg-slate-900/70">
          <CardContent className="space-y-3 text-sm text-slate-300">
            <h3 className="text-base font-semibold text-white">How it works</h3>
            <ol className="space-y-2">
              <li>
                <span className="font-semibold text-slate-200">1. Upload</span> –
                Drop PDFs or pick curated textbooks.
              </li>
              <li>
                <span className="font-semibold text-slate-200">2. Curate</span> –
                Select books, chapters, and subchapters.
              </li>
              <li>
                <span className="font-semibold text-slate-200">3. Generate</span> –
                Let Testly craft an exam that fits your brief.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
