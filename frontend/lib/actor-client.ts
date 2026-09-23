export const BUSINESS_COOKIE = "zd_business";
export const TEAM_COOKIE = "zd_team";

export function rememberActor(kind: "business" | "team", id: string) {
  const name = kind === "business" ? BUSINESS_COOKIE : TEAM_COOKIE;
  document.cookie = `${name}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
