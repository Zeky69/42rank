"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Campus = { id: number; name: string };

type Props = {
  campuses: Campus[];
  poolYears: string[];
  currentCampusId: number;
  currentPoolYear: string;
};

export default function Filters({
  campuses,
  poolYears,
  currentCampusId,
  currentPoolYear,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    params.delete("page");
    startTransition(() => {
      router.push(`/ranking?${params.toString()}`);
    });
  }

  return (
    <div className={`filters ${pending ? "pending" : ""}`}>
      <label className="filter-label">
        <span className="filter-k">Campus</span>
        <select
          className="filter-select"
          value={currentCampusId}
          onChange={(e) => update("campus", e.target.value)}
          disabled={pending}
        >
          {campuses.map((c) => (
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
    </div>
  );
}
