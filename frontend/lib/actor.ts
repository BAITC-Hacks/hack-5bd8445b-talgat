import { cookies } from "next/headers";
import { BUSINESS_COOKIE, TEAM_COOKIE } from "./actor-client";
import type { Business, Team } from "./types";

/**
 * Регистрации в MVP нет (вне рамок кейса): бизнес и команду выбирают в шапке,
 * выбор хранится в cookie. По умолчанию — первая компания и первая команда из сида.
 */
export async function currentActors(businesses: Business[], teams: Team[]) {
  const store = await cookies();
  const businessId = store.get(BUSINESS_COOKIE)?.value;
  const teamId = store.get(TEAM_COOKIE)?.value;
  return {
    business: businesses.find((b) => b.id === businessId) ?? businesses[0] ?? null,
    team: teams.find((t) => t.id === teamId) ?? teams[0] ?? null,
  };
}
