import { z } from "zod";

const visibilitySchema = z
  .string({ required_error: "Visibility is required" })
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => value === "public" || value === "private", {
    message: "Visibility must be Public or Private",
  })
  .transform((value): "Public" | "Private" => (value === "public" ? "Public" : "Private"));

const booleanFromFormSchema = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return ["true", "1", "yes", "on"].includes(normalized);
    }
    return false;
  });

export const uploadBookSchema = z.object({
  bookTitle: z
    .string({ required_error: "Book title is required" })
    .trim()
    .min(1, "Book title is required")
    .max(200, "Book title is too long"),
  visibility: visibilitySchema,
  useOcr: booleanFromFormSchema,
});

export type UploadBookSchema = z.infer<typeof uploadBookSchema>;
