import { Schema, model, type Document, type Types } from "mongoose";

export interface BookDocument extends Document {
  _id: Types.ObjectId;
  bookTitle: string;
  subchapterIds: Types.ObjectId[];
  chapterIds: Types.ObjectId[];
  visibility: "Public" | "Private";
  uploader: Types.ObjectId;
  uploaderName?: string;
  s3Link: string;
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<BookDocument>(
  {
    bookTitle: { type: String, required: true },
    subchapterIds: [{ type: Schema.Types.ObjectId, ref: "subchapters" }],
    chapterIds: [{ type: Schema.Types.ObjectId, ref: "chapters" }],
    visibility: { type: String, enum: ["Public", "Private"], default: "Private" },
    uploader: { type: Schema.Types.ObjectId, ref: "users", required: true },
    uploaderName: { type: String },
    s3Link: { type: String, required: true },
    coverImageUrl: { type: String },
  },
  {
    timestamps: true,
    collection: "books",
  }
);

export const BookModel = model<BookDocument>("Book", bookSchema);
