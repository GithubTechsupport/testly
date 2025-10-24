import { Schema, model, type Document, type Types } from "mongoose";

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  username: string;
  usernameNormalized: string;
  email: string;
  passwordHash: string;
  uploadedDocumentIDs: Types.ObjectId[];
  libraryBookIDs: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, trim: true },
    usernameNormalized: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    uploadedDocumentIDs: [{ type: Schema.Types.ObjectId, ref: "books" }],
    libraryBookIDs: [{ type: Schema.Types.ObjectId, ref: "books" }],
  },
  {
    timestamps: true,
    collection: "users",
  }
);

userSchema.pre<UserDocument>("save", function preSave(next) {
  if (this.isModified("username") && this.username) {
    this.usernameNormalized = this.username.toLowerCase();
  }
  next();
});

export const UserModel = model<UserDocument>("User", userSchema);
