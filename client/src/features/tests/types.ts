export type TestLibraryEntryType = "book" | "chapter" | "subchapter";

export type TestDifficultyKey = "easy" | "medium" | "hard";

export interface TestDifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface TestLibraryEntry {
  id: string;
  type: TestLibraryEntryType;
  name: string;
  bookId: string;
  chapterId?: string;
  subchapterId?: string;
}

export interface TestEntryAllocation extends TestLibraryEntry {
  questionCount: number;
  questionPercentage: number;
  difficulty: TestDifficultyDistribution;
}

export interface TestQuestionOrderItem {
  questionNumber: number;
  entryId: string;
  entryName: string;
  difficulty: TestDifficultyKey;
}

export interface CreateTestPayload {
  title: string;
  totalQuestions: number;
  entries: TestEntryAllocation[];
  questionOrder: TestQuestionOrderItem[];
}
