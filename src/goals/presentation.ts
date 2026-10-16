const CATEGORY_LABELS: Record<string, string> = { health: '健康', relationship: '关系', finance: '财务', other: '其他' };
export const goalCategoryLabel = (category: string) => CATEGORY_LABELS[category] ?? category;
