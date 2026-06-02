"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import CampusPicker from "./CampusPicker";

type Campus = { id: number; name: string; country?: string };

type Props = {
  campuses: Campus[];
  poolYears: string[];
  currentCampus: string;
  currentPoolYear: string;
  myCampusId?: number;
};

export default function Filters({
  campuses,
  poolYears,
  currentCampus,
  currentPoolYear,
  myCampusId,
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
