"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { countryFlag } from "@/lib/country-flags";

type Campus = { id: number; name: string; country?: string };

type Item = { value: string; label: string; tag?: string };
type Row =
  | { kind: "header"; label: string }
  | { kind: "option"; item: Item; optIdx: number };

type Props = {
  campuses: Campus[];
  currentCampus: string; // "all" ou l'id en chaîne
  myCampusId?: number;
  disabled?: boolean;
  onSelect: (value: string) => void;
};

export default function CampusPicker({
  campuses,
  currentCampus,
  myCampusId,
  disabled,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGlobal = currentCampus === "all";
  const currentLabel = isGlobal
    ? "🌍 Global (tous les campus)"
    : (campuses.find((c) => String(c.id) === currentCampus)?.name ??
      "Choisir un campus");

  const { rows, options } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => s.toLowerCase().includes(q);

    const rows: Row[] = [];
    const options: Item[] = [];
    const pushOption = (item: Item) => {
      rows.push({ kind: "option", item, optIdx: options.length });
      options.push(item);
    };

    // Épinglés en haut, hors regroupement par pays.
    if (q === "" || match("global tous les campus") || match("monde")) {
      pushOption({ value: "all", label: "🌍 Global (tous les campus)" });
    }
    const my = campuses.find((c) => c.id === myCampusId);
    if (my && (match(my.name) || match(my.country ?? ""))) {
      pushOption({ value: String(my.id), label: my.name, tag: "Ton campus" });
    }

    // Reste groupé par pays (ordre alphabétique).
    const rest = campuses.filter(
      (c) =>
        c.id !== myCampusId && (match(c.name) || match(c.country ?? "")),
    );
    const byCountry = new Map<string, Campus[]>();
    for (const c of rest) {
      const key = c.country?.trim() || "Autre";
      const arr = byCountry.get(key);
      if (arr) arr.push(c);
      else byCountry.set(key, [c]);
    }
    const countries = [...byCountry.keys()].sort((a, b) =>
      a.localeCompare(b, "fr"),
    );
    for (const country of countries) {
      rows.push({ kind: "header", label: country });
      for (const c of byCountry.get(country)!) {
        pushOption({ value: String(c.id), label: c.name });
      }
    }
    return { rows, options };
  }, [query, campuses, myCampusId]);

  // Recentre la sélection clavier quand la liste change.
  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(value: string) {
    setOpen(false);
    if (value !== currentCampus) onSelect(value);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = options[active];
      if (it) choose(it.value);
    }
  }

  return (
    <div className="campus-picker" ref={rootRef}>
      <button
        type="button"
        className="campus-trigger"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="campus-trigger-name">{currentLabel}</span>
        <span className={`campus-chevron ${open ? "up" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="campus-popover">
          <input
            ref={inputRef}
            className="campus-search"
            type="text"
            placeholder="Rechercher un campus…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <ul className="campus-list" role="listbox">
            {options.length === 0 && (
              <li className="campus-empty">Aucun campus trouvé</li>
            )}
            {rows.map((row) => {
              if (row.kind === "header") {
                return (
                  <li
                    key={`h-${row.label}`}
                    className="campus-country"
                    role="presentation"
                  >
                    <span className="campus-flag" aria-hidden>
                      {countryFlag(row.label)}
                    </span>
                    {row.label}
                  </li>
                );
              }
              const { item, optIdx } = row;
              const selected = item.value === currentCampus;
              return (
                <li
                  key={item.value}
                  role="option"
                  aria-selected={selected}
                  className={`campus-option${optIdx === active ? " active" : ""}${
                    selected ? " selected" : ""
                  }`}
                  onMouseEnter={() => setActive(optIdx)}
                  onClick={() => choose(item.value)}
                >
                  <span className="campus-option-name">{item.label}</span>
                  {item.tag && <span className="campus-tag">{item.tag}</span>}
                  {selected && <span className="campus-check">✓</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
