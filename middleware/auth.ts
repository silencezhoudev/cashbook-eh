// 登录过滤
export default defineNuxtRouteMiddleware(async (to, from) => {
  console.log("Auth middleware - 检查路径:", to.path);
  
  // 需要登陆的地址，校验登陆状态
  const authCookie = useCookie("Authorization").value;
  console.log("Auth middleware - Authorization cookie:", authCookie ? authCookie.substring(0, 20) + "..." : "null");
  
  // 如果没有cookie，直接跳转登录
  if (!authCookie) {
    console.log("Auth middleware - 没有cookie，跳转登录");
    return navigateTo({ path: "/login", query: { callbackUrl: to.fullPath } });
  }
  
  const { data: res, error } = await useFetch<Result<UserInfo>>(
    "/api/checkuser",
    {
      method: "get",
      headers: {
        Authorization: authCookie,
      },
    }
  );
  
  console.log("Auth middleware - checkuser响应:", res.value);
  console.log("Auth middleware - checkuser错误:", error.value);
  
  if (error.value) {
    console.log("Auth middleware - 请求错误，跳转到500页面");
    return navigateTo({ path: "/500", query: { e: String(error.value) } });
  }
  
  // 检查响应状态码
  if (res.value && res.value.c == 200) {
    // 用户信息获取成功，正常跳转
    if (res.value.d) {
      console.log("Auth middleware - 用户认证成功:", res.value.d.username);
      GlobalUserInfo.value = res.value.d;
      return;
    } else {
      // 用户不存在，清除认证信息并跳转登录
      console.log("Auth middleware - 用户不存在，清除认证信息");
      if (process.client) {
        localStorage.removeItem("Authorization");
        localStorage.removeItem("bookName");
        localStorage.removeItem("bookId");
      }
      Alert.error("用户异常，请重新登录！");
      return navigateTo({ path: "/login", query: { callbackUrl: to.fullPath } });
    }
  } else if (res.value && res.value.c == 400) {
    // 认证失败，跳转登录
    console.log("Auth middleware - 认证失败，跳转登录");
    return navigateTo({
      path: "/login",
      query: { callbackUrl: to.fullPath },
    });
  } else {
    console.log("Auth middleware - 未知错误，跳转500页面");
    return navigateTo({ path: "/500", query: { e: JSON.stringify(res) } });
  }
});
