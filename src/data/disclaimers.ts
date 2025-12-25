export interface DisclaimerConfig {
	type: string;
	title: string;
	content: string;
	icon?: string;
}

export const disclaimers: Record<string, DisclaimerConfig> = {
	暴论: {
		type: "此即暴论",
		title: "此即暴论",
		content:
			"本文涉及可能引起争议的观点和话题，内容仅代表我发癫时的个人立场，有极大概率是不中肯、不客观、不完善的，不构成任何形式的建议或倡导。",
		icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"%3E%3C/path%3E%3Cpath d="M12 9v4"%3E%3C/path%3E%3Cpath d="m12 17 .01 0"%3E%3C/path%3E%3C/svg%3E',
	},
	免责声明: {
		type: "免责声明",
		title: "免责声明",
		content:
			"本文内容仅供参考，不构成任何形式的专业建议。作者对因使用本文信息而产生的任何后果不承担责任。",
		icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Ccircle cx="12" cy="12" r="10"%3E%3C/circle%3E%3Cpath d="M8 12h8"%3E%3C/path%3E%3C/svg%3E',
	},
	过时内容: {
		type: "过时内容",
		title: "内容时效性提醒",
		content:
			"本篇博客完成日期距现在已大于一年，内容可能已过时，相关技术、政策或情况可能已发生变化，建议读者查证最新信息。",
		icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Ccircle cx="12" cy="12" r="10"%3E%3C/circle%3E%3Cpolyline points="12,6 12,12 16,14"%3E%3C/polyline%3E%3C/svg%3E',
	},
};

/**
 * 根据声明类型获取声明配置
 * @param types 声明类型数组或逗号分隔的字符串
 * @returns 声明配置数组
 */
export function getDisclaimers(types: string | string[]): DisclaimerConfig[] {
	if (!types) return [];

	const typeArray = Array.isArray(types)
		? types
		: types.split(",").map((t) => t.trim());

	return typeArray
		.filter((type) => disclaimers[type])
		.map((type) => disclaimers[type]);
}
