import { Schema, model, type Document, type Types } from "mongoose";

export interface ChapterDocument extends Document {
  _id: Types.ObjectId;
  bookID: Types.ObjectId;
  chapterTitle: string;
  subchapterIds: Types.ObjectId[];
  pageStart: number;
  pageEnd: number;
}

const chapterSchema = new Schema<ChapterDocument>(
  {
    bookID: { type: Schema.Types.ObjectId, ref: "books", required: true },
    chapterTitle: { type: String, required: true },
    subchapterIds: [{ type: Schema.Types.ObjectId, ref: "subchapters" }],
    pageStart: { type: Number, required: true },
    pageEnd: { type: Number, required: true },
  },
  {
    collection: "chapters",
  }
);

export const ChapterModel = model<ChapterDocument>("Chapter", chapterSchema);
