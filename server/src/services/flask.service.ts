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
  book_name: string;
  s3_link: string;
  visibility: "Public" | "Private";
  uploader: string;
  use_ocr?: boolean;
}

export async function triggerUploadPipeline(payload: UploadPipelinePayload) {
  try {
    const response = await axios.post<{ status: string; book_id: string; book_title: string }>(
      `${env.flaskBaseUrl}/api/v1/pipelines/upload-embed`,
      payload,
      {
        timeout: 5 * 60 * 1000,
      }
    );

    if (!response.data.book_id) {
      throw new HttpError(502, "Pipeline response missing book ID");
    }

    return response.data as UploadPipelineResponse;
  } catch (error) {
    logger.error("Upload pipeline failed", error);
    throw new HttpError(502, "Failed to execute upload pipeline", error);
  }
}
