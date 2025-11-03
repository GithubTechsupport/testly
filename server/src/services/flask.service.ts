import axios from "axios";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { HttpError } from "../utils/http-error.js";

export interface UploadPipelineResponse {
  status: string;
  book_id: string;
  book_title: string;
  visibility: string;
  used_ocr: boolean;
}

export interface UploadPipelinePayload {
  book_id: string;
  use_ocr?: boolean;
}

export async function triggerUploadPipeline(payload: UploadPipelinePayload) {
  try {
    const response = await axios.post<{ status: string; book_id: string }>(
      `${env.flaskBaseUrl}/api/v1/pipelines/upload-embed`,
      payload,
      {
        // Flask returns immediately and processes in background
        timeout: 15 * 1000,
      }
    );

    if (!response.data.book_id) {
      throw new HttpError(502, "Pipeline response missing book ID");
    }

    return { status: response.data.status, book_id: response.data.book_id, book_title: "", visibility: "Private", used_ocr: Boolean((payload as any).use_ocr) } as unknown as UploadPipelineResponse;
  } catch (error) {
    logger.error("Upload pipeline failed", error);
    throw new HttpError(502, "Failed to execute upload pipeline", error);
  }
}
