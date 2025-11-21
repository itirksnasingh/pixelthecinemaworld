// BADGE SYSTEM
const BADGE_RULES = [
  { minScore: 0, id: "rookie", label: "Neon Rookie", color: "#7b5bff", description: "Completed Beginner Tier" },
  { minScore: 5, id: "strategist", label: "Cyber Strategist", color: "#00f5c4", description: "Dominated Intermediate Tier" },
  { minScore: 8, id: "oracle", label: "Pixel Oracle", color: "#ff4f81", description: "Perfect Mastery" },
];

export function determineBadge(score, total) {
  const rule = [...BADGE_RULES].reverse().find((r) => score >= r.minScore) || BADGE_RULES[0];
  return {
    ...rule,
    total,
    score,
    earnedAt: new Date().toISOString(),
  };
}

const STORAGE_KEY = "pixel_badges";

export function getSavedBadges() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (_) {
    return [];
  }
}

export function saveBadge(badge) {
  const badges = getSavedBadges();
  badges.push(badge);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(badges));
  return badges;
}
