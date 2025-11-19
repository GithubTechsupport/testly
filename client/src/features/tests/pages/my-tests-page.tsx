import { useState } from "react";
import { toast } from "react-hot-toast";

import { AddTestCard } from "@/features/tests/components/add-test-card";
import { AddTestModal } from "@/features/tests/components/add-test-modal";
import type { CreateTestPayload } from "@/features/tests/types";

export function MyTestsPage() {
  const [isModalOpen, setModalOpen] = useState(false);

  const handleCreateTest = (payload: CreateTestPayload) => {
    // Placeholder integration: store payload or forward to API once ready.
    console.info("Draft test payload", payload);
    toast.success("Test draft prepared");
    setModalOpen(false);
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">My Tests</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Curate assessments, balance their composition, and preview the resulting sequence before
          publishing.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AddTestCard onClick={() => setModalOpen(true)} />
      </div>

      <AddTestModal open={isModalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreateTest} />
    </section>
  );
}
