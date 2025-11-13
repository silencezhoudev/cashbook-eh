/**
 * 账本颜色验证工具
 */

export const validateBookColor = (color: string): boolean => {
  // 验证颜色格式：支持 #RRGGBB 格式
  const colorRegex = /^#[0-9A-Fa-f]{6}$/;
  return colorRegex.test(color);
};

export const getDefaultBookColors = (): string[] => {
  return [
    '#3B82F6', // 蓝色
    '#EF4444', // 红色
    '#10B981', // 绿色
    '#F59E0B', // 黄色
    '#8B5CF6', // 紫色
    '#EC4899', // 粉色
    '#06B6D4', // 青色
    '#84CC16'  // 青绿色
  ];
};

export const assignDefaultColor = (index: number): string => {
  const colors = getDefaultBookColors();
  return colors[index % colors.length];
};
