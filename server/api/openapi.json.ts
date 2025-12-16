// server/api/openapi.json.ts
import { getSwaggerSpec } from "../utils/swagger";

/**
 * @swagger
 * /api/openapi.json:
 *   get:
 *     summary: 获取OpenAPI规范文档
 *     tags: ["Base"]
 *     responses:
 *       200:
 *         description: OpenAPI规范文档
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: OpenAPI规范对象
 *               }
 */
export default defineEventHandler((event) => {
  // 设置响应头为 JSON
  setHeader(event, "Content-Type", "application/json");
  return getSwaggerSpec();
});
