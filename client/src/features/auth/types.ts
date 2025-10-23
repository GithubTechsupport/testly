export interface UserSummary {
  id: string;
  username: string;
  email: string;
  libraryBookIds: string[];
  uploadedDocumentIds: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthResult {
  user: UserSummary;
  tokens: AuthTokens;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface ApiMessage {
  status: "success" | "error";
  message: string;
}
