import type { Metadata } from "next";
import { Sofia_Sans, Sofia_Sans_Extra_Condensed } from "next/font/google";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import { currentActors } from "@/lib/actor";
import { api } from "@/lib/api";
import type { Business, Team } from "@/lib/types";
import "./globals.css";

const text = Sofia_Sans({ subsets: ["latin", "cyrillic"], variable: "--font-text", display: "swap" });
const cond = Sofia_Sans_Extra_Condensed({ subsets: ["latin", "cyrillic"], weight: ["700", "800", "900"], variable: "--font-cond", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Задачник — задачи бизнеса для студенческих команд", template: "%s · Задачник" },
  description: "Бизнес описывает задачу, ИИ помогает уточнить её до готовой карточки, рейтинг готовности определяет место в открытом каталоге, студенческие команды откликаются, а бизнес сам выбирает, с кем работать.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let businesses: Business[] = [];
  let teams: Team[] = [];
  try {
    [businesses, teams] = await Promise.all([api.businesses(), api.teams()]);
  } catch {
    // API недоступен — страница покажет понятную ошибку сама
  }
  const actors = await currentActors(businesses, teams);

  return (
    <html lang="ru" className={`${text.variable} ${cond.variable}`}>
      <body>
        <a className="skip" href="#main">К содержимому</a>
        <ToastProvider>
          <Header businesses={businesses} teams={teams} businessId={actors.business?.id ?? null} teamId={actors.team?.id ?? null} />
          <main id="main">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
