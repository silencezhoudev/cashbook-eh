import {
  success,
  error,
  encryptBySHA256,
  getUserId,
} from "~/server/utils/common";
import { RuleBootstrapService } from "~/server/utils/ruleBootstrapService";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const adminAccount = body?.adminAccount?.trim?.();
    const adminPassword = body?.adminPassword;

    const runtimeConfig = useRuntimeConfig();
    const adminTokenHeader = getHeader(event, "Admin");
    const expectedAdminToken = encryptBySHA256(
      runtimeConfig.adminUsername,
      runtimeConfig.adminPassword
    );
    const hasAdminSession =
      adminTokenHeader && adminTokenHeader === expectedAdminToken;

    const authUserId = await getUserId(event);
    let targetUserId = Number(body?.userId);
    if ((!targetUserId || Number.isNaN(targetUserId)) && authUserId) {
      targetUserId = authUserId;
    }

    if (!targetUserId || Number.isNaN(targetUserId)) {
      return error("缺少有效的用户ID");
    }

    if (!hasAdminSession) {
      if (!adminAccount || !adminPassword) {
        return error("需要提供管理员账号和密码");
      }

      const hashedInput = encryptBySHA256(adminAccount, adminPassword);

      if (
        runtimeConfig.adminUsername !== adminAccount ||
        runtimeConfig.adminPassword !== hashedInput
      ) {
        return error("管理员认证失败");
      }
    }

    const result = await RuleBootstrapService.ensureInitialRules(targetUserId, {
      force: true,
    });

    return success({
      success: true,
      targetUserId,
      ...result,
    });
  } catch (err: any) {
    console.error("[admin/rules/bootstrap] 触发规则初始化失败:", err);
    return error(err?.message || "触发规则初始化失败");
  }
});

