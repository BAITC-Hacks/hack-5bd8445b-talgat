"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { rememberActor } from "@/lib/actor-client";
import type { Business, Team } from "@/lib/types";

const BUSINESS_TABS = [
  { href: "/business/new", label: "Новая задача" },
  { href: "/business", label: "Кабинет" },
];
const TEAM_TABS = [
  { href: "/catalog", label: "Таблица задач" },
  { href: "/team", label: "Профиль команды" },
];

export function Header(props: { businesses: Business[]; teams: Team[]; businessId: string | null; teamId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = pathname.startsWith("/business") ? "business" : pathname.startsWith("/catalog") || pathname.startsWith("/team") ? "team" : null;
  const tabs = role === "business" ? BUSINESS_TABS : role === "team" ? TEAM_TABS : [];
  const isCurrent = (href: string) => (href === "/business" ? pathname === "/business" || pathname.startsWith("/business/tasks") : pathname.startsWith(href));

  function switchActor(kind: "business" | "team", id: string) {
    rememberActor(kind, id);
    if (kind === "business" && pathname.startsWith("/business/tasks")) router.push("/business");
    router.refresh();
  }

  return (
    <header className="bar">
      <div className="bar-in">
        <Link className="brand" href="/" aria-label="Задачник — на главную">
          <span className="brand-badge" aria-hidden="true">#1</span>
          <span className="brand-word">Задачник</span>
        </Link>

        <nav className="roles" aria-label="Роль">
          <Link href="/business" className={`role${role === "business" ? " is-on" : ""}`} aria-current={role === "business" ? "true" : undefined}>
            Бизнес
          </Link>
          <Link href="/catalog" className={`role${role === "team" ? " is-on" : ""}`} aria-current={role === "team" ? "true" : undefined}>
            Команда
          </Link>
        </nav>

        <nav className="tabs" aria-label="Разделы">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={isCurrent(t.href) ? "is-current" : undefined} aria-current={isCurrent(t.href) ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
          <Link href="/ai" className={pathname === "/ai" ? "is-current" : undefined}>
            Как работает ИИ
          </Link>
        </nav>

        {role === "business" && props.businesses.length > 0 && (
          <label className="acct">
            <span>Компания</span>
            <select value={props.businessId ?? ""} onChange={(e) => switchActor("business", e.target.value)}>
              {props.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {role === "team" && props.teams.length > 0 && (
          <label className="acct">
            <span>Команда</span>
            <select value={props.teamId ?? ""} onChange={(e) => switchActor("team", e.target.value)}>
              {props.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </header>
  );
}
