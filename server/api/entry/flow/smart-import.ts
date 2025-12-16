import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";
import { detectStatementFormat } from "~/server/utils/statementFormatDetector";
import {
  parseStatementFileRaw,
  categorizeFlows,
} from "~/server/utils/flowParser";
import type { ParsedFlow } from "~/server/utils/flowParser";

/**
 * @swagger
 * /api/entry/flow/smart-import:
 *   post:
 *     summary: 智能导入流水（第一步：检测格式并解析，返回流水列表供用户选择）
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             files: File[] 账单文件（CSV、XLSX、XLS格式）
 *             bookIds: string JSON字符串，账本ID数组（可选，用于后续分类）
 *     responses:
 *       200:
 *         description: 解析成功，返回流水列表
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: {
 *                   success: boolean,
 *                   detectedFormats: Array<{fileName: string, format: string}>,
 *                   normalFlows: Array<Flow>,
 *                   specialFlows: {
 *                     refunds: Array<Flow>,
 *                     familyAccount: Array<Flow>,
 *                     partialRefunds: Array<Flow>
 *                   }
 *                 }
 *       400:
 *         description: 解析失败
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  try {
    const formdata = await readFormData(event);

    // 1. 获取文件列表
    const files: File[] = formdata.getAll("files") as File[];
    if (!files || files.length === 0) {
      return error("请至少上传一个文件");
    }

    // 2. 验证文件格式
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const invalidFiles: string[] = [];
    for (const file of files) {
      const fileName = file.name.toLowerCase();
      const isValid = validExtensions.some((ext) => fileName.endsWith(ext));
      if (!isValid) {
        invalidFiles.push(file.name);
      }
    }
    if (invalidFiles.length > 0) {
      return error(`以下文件格式不支持: ${invalidFiles.join(", ")}`);
    }

    // 3. 获取账本ID列表（可选，用于后续分类）
    let bookIds: string[] = [];
    const bookIdsStr = formdata.get("bookIds");
    if (bookIdsStr) {
      try {
        bookIds = JSON.parse(bookIdsStr as string);
      } catch (e) {
        // 账本ID格式错误不影响解析，只是后续分类可能不准确
        console.warn("账本ID格式错误，将跳过分类步骤");
      }
    }

    // 6. 创建临时目录保存文件
    const runtimeConfig = useRuntimeConfig();
    const tempDir = path.join(
      runtimeConfig.dataPath || process.cwd(),
      "temp",
      `smart-import-${Date.now()}-${userId}`
    );
    await fs.promises.mkdir(tempDir, { recursive: true });

    // 7. 保存文件到临时目录
    const savedFiles: string[] = [];
    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(tempDir, file.name);
      await fs.promises.writeFile(filePath, fileBuffer);
      savedFiles.push(filePath);
    }

    // 8. 检测文件格式并解析
    const detectedFormats: Array<{ fileName: string; format: string }> = [];
    const allRawFlows: ParsedFlow[] = [];

    for (const filePath of savedFiles) {
      try {
        // 检测格式
        const formatResult = await detectStatementFormat(filePath);
        const fileName = path.basename(filePath);
        detectedFormats.push({
          fileName,
          format: formatResult.format,
        });

        // 解析文件
        const rawFlows = await parseStatementFileRaw(filePath, formatResult);
        allRawFlows.push(...rawFlows);
      } catch (e: any) {
        console.error(`处理文件失败 ${filePath}:`, e);
        // 继续处理其他文件
      }
    }

    // 9. 清理临时文件（延迟清理，或者保留到用户确认导入后再清理）
    // 这里先不清理，等用户确认导入后再清理
    // await cleanupTempDir(tempDir);

    // 10. 返回解析结果
    const categorizeResult = categorizeFlows(allRawFlows);
    const totalFlows = categorizeResult.displayFlows.length;

    if (totalFlows === 0) {
      await cleanupTempDir(tempDir);
      return error("未找到可导入的流水数据，请检查文件格式");
    }

    return success({
      success: true,
      message: `成功解析 ${totalFlows} 条流水，请选择要导入的流水`,
      detectedFormats,
      displayFlows: categorizeResult.displayFlows,
      tempDir, // 返回临时目录，用于后续导入
    });
  } catch (err: any) {
    console.error("智能导入失败:", err);
    return error(err?.message || "智能导入失败，请重试");
  }
});

/**
 * 调用Python脚本处理文件
 * @param pythonScriptPath Python脚本路径
 * @param inputDataPath 输入数据JSON文件路径
 * @param tempDir 临时目录
 * @returns Python程序返回的结果
 */
async function callPythonScript(
  pythonScriptPath: string,
  inputDataPath: string,
  tempDir: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    // 配置Python解释器路径（可以是 python 或 python3）
    const pythonCommand = process.env.PYTHON_COMMAND || "python3"; // 或 "python"

    // 传递环境变量给Python进程
    // 确保Python脚本能找到项目根目录的.env文件
    const projectRoot = process.cwd();
    const env = {
      ...process.env,
      // 确保Python脚本能读取到.env文件中的配置
      PYTHONPATH: process.env.PYTHONPATH || "",
      // 传递项目根目录，Python脚本会尝试从那里加载.env
      PROJECT_ROOT: projectRoot,
    };

    const pythonProcess = spawn(pythonCommand, [pythonScriptPath, inputDataPath], {
      cwd: tempDir,
      env: env,
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Python脚本执行失败:", stderr);
        reject(new Error(`Python脚本执行失败，退出码: ${code}, 错误: ${stderr}`));
        return;
      }

      try {
        // Python程序应该将结果写入 output.json 文件
        const outputPath = path.join(tempDir, "output.json");
        if (fs.existsSync(outputPath)) {
          const outputData = fs.readFileSync(outputPath, "utf-8");
          const result = JSON.parse(outputData);
          resolve(result);
        } else {
          // 如果没有输出文件，尝试从stdout解析
          if (stdout.trim()) {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } else {
            reject(new Error("Python程序未返回有效结果"));
          }
        }
      } catch (e: any) {
        console.error("解析Python程序结果失败:", e);
        reject(new Error(`解析Python程序结果失败: ${e.message}`));
      }
    });

    pythonProcess.on("error", (err) => {
      console.error("启动Python进程失败:", err);
      reject(new Error(`启动Python进程失败: ${err.message}`));
    });
  });
}

/**
 * 从数据库获取账本详细信息
 */
async function getBookDetailsFromDB(bookIds: string[], userId: number): Promise<any[]> {
  const books = await prisma.book.findMany({
    where: {
      bookId: { in: bookIds },
      userId,
    },
    select: {
      bookId: true,
      bookName: true,
    } as any,
  });

  const results = await Promise.all(
    books.map(async (book) => {
      // 查询该账本的所有不同的交易类型（flowType）
      const flowWhere: any = {
        bookId: book.bookId,
      };
      const flowTypesResult = await prisma.flow.findMany({
        where: flowWhere,
        select: { flowType: true },
        orderBy: { flowType: "asc" },
      });

      // 查询该账本的所有不同的收支类型（industryType）
      const industryWhere: any = {
        bookId: book.bookId,
        industryType: {
          not: null,
        },
      };
      const industryTypesResult = await prisma.flow.findMany({
        where: industryWhere,
        select: { industryType: true },
        orderBy: { industryType: "asc" },
      });

      // 去重并过滤null值
      const flowTypesSet = new Set<string>();
      flowTypesResult.forEach((item) => {
        if (item.flowType) {
          flowTypesSet.add(item.flowType);
        }
      });
      const flowTypes = Array.from(flowTypesSet).sort();

      const industryTypesSet = new Set<string>();
      industryTypesResult.forEach((item) => {
        if (item.industryType) {
          industryTypesSet.add(item.industryType);
        }
      });
      const industryTypes = Array.from(industryTypesSet).sort();

      return {
        bookId: book.bookId,
        bookName: book.bookName,
        description: "",
        flowTypes,
        industryTypes,
      };
    })
  );

  return results;
}

/**
 * 清理临时目录
 */
async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch (e) {
    console.error("清理临时目录失败:", e);
    // 清理失败不影响主流程
  }
}

