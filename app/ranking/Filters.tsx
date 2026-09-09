"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import CampusPicker from "./CampusPicker";
import { POOL_MONTHS, isPiscineCursus } from "@/lib/pool-months";

type Campus = { id: number; name: string; country?: string };
type Cursus = { id: number; name: string };

type Props = {
  campuses: Campus[];
  cursuses: Cursus[];
  poolYears: string[];
  currentCampus: string;
  currentCursus: string;
  currentPoolYear: string;
  currentPoolMonth: string;
  myCampusId?: number;
};

export default function Filters({
  campuses,
  cursuses,
  poolYears,
  currentCampus,
  currentCursus,
  currentPoolYear,
  currentPoolMonth,
  myCampusId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const currentCursusName =
    cursuses.find((c) => String(c.id) === currentCursus)?.name ?? "";
  const showPoolMonth = isPiscineCursus(currentCursusName);

  function update(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    params.delete("page");
    if (key === "cursus" && !isPiscineCursus(
      cursuses.find((c) => String(c.id) === value)?.name ?? "",
    )) {
      params.delete("month");
    }
    startTransition(() => {
      router.push(`/ranking?${params.toString()}`);
    });
  }

  return (
    <div className={`filters ${pending ? "pending" : ""}`}>
      <div className="filter-label">
        <span className="filter-k">Campus</span>
        <CampusPicker
          campuses={campuses}
          currentCampus={currentCampus}
          myCampusId={myCampusId}
          disabled={pending}
          onSelect={(v) => update("campus", v)}
        />
      </div>
      <label className="filter-label">
        <span className="filter-k">Cursus</span>
        <select
          className="filter-select"
          value={currentCursus}
          onChange={(e) => update("cursus", e.target.value)}
          disabled={pending}
        >
          {cursuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-label">
        <span className="filter-k">Annee de piscine</span>
        <select
          className="filter-select"
          value={currentPoolYear}
          onChange={(e) => update("pool", e.target.value)}
          disabled={pending}
        >
          {poolYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      {showPoolMonth && (
        <label className="filter-label">
          <span className="filter-k">Periode de piscine</span>
          <select
            className="filter-select"
            value={currentPoolMonth}
            onChange={(e) => update("month", e.target.value)}
            disabled={pending}
          >
            <option value="all">Toutes les periodes</option>
            {POOL_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
