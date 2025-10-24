import { Schema, model, type Document, type Types } from "mongoose";

export interface SubchapterDocument extends Document {
  _id: Types.ObjectId;
  bookID: Types.ObjectId;
  chapterID: Types.ObjectId;
  subchapterTitle: string;
  pageStart: number;
  pageEnd: number;
  s3Link?: string;
}

const subchapterSchema = new Schema<SubchapterDocument>(
  {
    bookID: { type: Schema.Types.ObjectId, ref: "books", required: true },
    chapterID: { type: Schema.Types.ObjectId, ref: "chapters", required: true },
    subchapterTitle: { type: String, required: true },
    pageStart: { type: Number, required: true },
    pageEnd: { type: Number, required: true },
    s3Link: { type: String },
  },
  {
    collection: "subchapters",
  }
);

export const SubchapterModel = model<SubchapterDocument>("Subchapter", subchapterSchema);
