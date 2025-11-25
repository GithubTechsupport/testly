import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { getAxiosErrorMessage } from "@/lib/axios-error";
import { useUploadBook } from "@/features/books/hooks";
import type { VisibilityOption } from "@/features/books/types";
import { toast } from "react-hot-toast";

const uploadSchema = z.object({
  bookTitle: z.string().min(1, "Book title is required"),
  visibility: z.enum(["Public", "Private"] satisfies [VisibilityOption, VisibilityOption]),
  pdfFile: z
    .instanceof(File, { message: "A PDF file is required" })
    .refine((file: File) => file.type === "application/pdf", "File must be a PDF"),
  coverImage: z
    .instanceof(File)
    .or(z.literal(null))
    .optional()
    .default(null),
});

export type UploadFormData = z.infer<typeof uploadSchema>;

interface UploadBookModalProps {
  open: boolean;
  onClose: () => void;
}

export function UploadBookModal({ open, onClose }: UploadBookModalProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      bookTitle: "",
      visibility: "Private",
      pdfFile: undefined,
      coverImage: null,
    },
  });

  const uploadMutation = useUploadBook();

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = (values: UploadFormData) => {
    uploadMutation.mutate(values, {
      onSuccess: () => {
        toast.success("Upload pipeline triggered successfully");
        onClose();
      },
      onError: (error: unknown) => {
        toast.error(getAxiosErrorMessage(error));
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!uploadMutation.isPending) {
          onClose();
        }
      }}
      title="Upload a new book"
      description="Provide the book details and we will process it into your library."
      className="max-w-3xl"
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="bookTitle">Book title</Label>
          <Input
            id="bookTitle"
            placeholder="Introduction to Quantum Mechanics"
            {...register("bookTitle")}
          />
          {errors.bookTitle && (
            <p className="text-xs text-red-500 dark:text-red-400">{errors.bookTitle.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select id="visibility" {...register("visibility")}>
              <option value="Private">Private</option>
              <option value="Public">Public</option>
            </Select>
            {errors.visibility && (
              <p className="text-xs text-red-500 dark:text-red-400">{errors.visibility.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pdfFile">Book PDF</Label>
            <Controller
              control={control}
              name="pdfFile"
              render={({ field: { name, onChange, onBlur, ref } }) => (
                <Input
                  id="pdfFile"
                  type="file"
                  accept="application/pdf"
                  name={name}
                  onBlur={onBlur}
                  ref={ref}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? undefined;
                    onChange(file);
                  }}
                />
              )}
            />
            {errors.pdfFile && (
              <p className="text-xs text-red-500 dark:text-red-400">{errors.pdfFile.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover image (optional)</Label>
            <Controller
              control={control}
              name="coverImage"
              render={({ field: { name, onChange, onBlur, ref } }) => (
                <Input
                  id="coverImage"
                  type="file"
                  accept="image/png,image/jpeg"
                  name={name}
                  onBlur={onBlur}
                  ref={ref}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    onChange(file);
                  }}
                />
              )}
            />
            {errors.coverImage && (
              <p className="text-xs text-red-500 dark:text-red-400">{errors.coverImage.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            leftIcon={<Upload className="h-4 w-4" />}
            isLoading={uploadMutation.isPending}
          >
            Start upload
          </Button>
        </div>
      </form>
    </Modal>
  );
}
