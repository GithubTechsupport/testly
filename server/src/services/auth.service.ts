import { HttpError } from "../utils/http-error.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { UserModel, type UserDocument } from "../models/user.model.js";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthResult {
  user: UserSummary;
  tokens: AuthTokens;
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  libraryBookIds: string[];
  uploadedDocumentIds: string[];
}

const normalize = (value: string) => value.trim().toLowerCase();

const toUserSummary = (user: UserDocument): UserSummary => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  libraryBookIds: user.libraryBookIDs.map((id) => id.toString()),
  uploadedDocumentIds: user.uploadedDocumentIDs.map((id) => id.toString()),
});

const buildAuthResult = (user: UserDocument): AuthResult => {
  const tokens: AuthTokens = {
    accessToken: signAccessToken({
      sub: user._id.toString(),
      username: user.username,
      email: user.email,
    }),
  };

  return {
    user: toUserSummary(user),
    tokens,
  };
};

export async function registerUser(payload: RegisterInput) {
  const usernameNormalized = normalize(payload.username);
  const emailNormalized = normalize(payload.email);

  const existingUser = await UserModel.findOne({
    $or: [{ usernameNormalized }, { email: emailNormalized }],
  });

  if (existingUser) {
    throw new HttpError(409, "Username or email already in use");
  }

  const passwordHash = await hashPassword(payload.password);

  const user = await UserModel.create({
    username: payload.username.trim(),
    usernameNormalized,
    email: emailNormalized,
    passwordHash,
    uploadedDocumentIDs: [],
    libraryBookIDs: [],
  });

  return buildAuthResult(user);
}

export async function loginUser({ identifier, password }: LoginInput) {
  const normalized = normalize(identifier);
  const user = await UserModel.findOne({
    $or: [{ usernameNormalized: normalized }, { email: normalized }],
  });

  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const passwordMatch = await verifyPassword(password, user.passwordHash);
  if (!passwordMatch) {
    throw new HttpError(401, "Invalid credentials");
  }

  return buildAuthResult(user);
}

export async function getUserById(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  return user;
}

export { toUserSummary };
