import { getProgressPayload } from "~/server/utils/progressStore";
import { success } from "~/server/utils/common";

export default defineEventHandler(async (event) => {
  const token = getQuery(event)?.token;
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return success({ progress: null });
  }
  const progress = getProgressPayload(token.trim());
  return success({ progress });
});

