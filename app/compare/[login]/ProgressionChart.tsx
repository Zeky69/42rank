"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { LevelPoint } from "@/lib/ft-api";

type Props = {
  myLogin: string;
  theirLogin: string;
  myUserId: number;
  theirUserId: number;
  initialMyPoints: LevelPoint[] | null;
  initialTheirPoints: LevelPoint[] | null;
};

type Progress = { done: number; total: number };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "jan","fév","mar","avr","mai","jun",
    "jul","aoû","sep","oct","nov","déc",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function streamExperiences(
  userId: number,
  onProgress: (done: number, total: number) => void,
): Promise<LevelPoint[]> {
  const res = await fetch(`/api/experiences/${userId}`);
  if (!res.ok || !res.body) throw new Error(`fetch /api/experiences/${userId} failed`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let points: LevelPoint[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "total") onProgress(0, event.pages);
      else if (event.type === "progress") onProgress(event.done, event.total);
      else if (event.type === "data") points = event.points;
      else if (event.type === "error") throw new Error(event.message);
    }
  }

  return points;
}

function buildChartData(
  myPoints: LevelPoint[],
  theirPoints: LevelPoint[],
): { date: string; me: number; them: number }[] {
  const dates = Array.from(
    new Set([...myPoints.map((p) => p.date), ...theirPoints.map((p) => p.date)]),
  ).sort();

  let myLevel = 0;
  let myIdx = 0;
  let theirLevel = 0;
  let theirIdx = 0;

  return dates.map((date) => {
    while (myIdx < myPoints.length && myPoints[myIdx].date <= date) {
      myLevel = myPoints[myIdx].level;
      myIdx++;
    }
    while (theirIdx < theirPoints.length && theirPoints[theirIdx].date <= date) {
      theirLevel = theirPoints[theirIdx].level;
      theirIdx++;
    }
    return { date, me: parseFloat(myLevel.toFixed(2)), them: parseFloat(theirLevel.toFixed(2)) };
  });
}

export default function ProgressionChart({
  myLogin,
  theirLogin,
  myUserId,
  theirUserId,
  initialMyPoints,
  initialTheirPoints,
}: Props) {
  const [myPoints, setMyPoints] = useState<LevelPoint[] | null>(initialMyPoints);
  const [theirPoints, setTheirPoints] = useState<LevelPoint[] | null>(initialTheirPoints);
  const [myProg, setMyProg] = useState<Progress>({ done: 0, total: 1 });
  const [theirProg, setTheirProg] = useState<Progress>({ done: 0, total: 1 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialMyPoints && initialTheirPoints) return;

    let cancelled = false;

    Promise.all([
      initialMyPoints
        ? Promise.resolve(initialMyPoints)
        : streamExperiences(myUserId, (done, total) => {
            if (!cancelled) setMyProg({ done, total: Math.max(total, 1) });
          }),
      initialTheirPoints
        ? Promise.resolve(initialTheirPoints)
        : streamExperiences(theirUserId, (done, total) => {
            if (!cancelled) setTheirProg({ done, total: Math.max(total, 1) });
          }),
    ])
      .then(([mp, tp]) => {
        if (!cancelled) {
          setMyPoints(mp);
          setTheirPoints(tp);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [myUserId, theirUserId, initialMyPoints, initialTheirPoints]);

  const totalPages = myProg.total + theirProg.total;
  const donePages = myProg.done + theirProg.done;
  const pct = totalPages > 0 ? Math.round((donePages / totalPages) * 100) : 0;

  if (error) {
    return (
      <section className="progression-section">
        <p className="muted">Graphique indisponible : {error}</p>
      </section>
    );
  }

  if (!myPoints || !theirPoints) {
    return (
      <section className="progression-section">
        <h2 className="progression-title">Évolution du niveau</h2>
        <div className="chart-loading">
          <div className="chart-progress-bar">
            <div className="chart-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="chart-progress-label">{pct}% — chargement de la progression…</p>
        </div>
      </section>
    );
  }

  if (myPoints.length === 0 && theirPoints.length === 0) {
    return (
      <section className="progression-section">
        <p className="muted">Pas de données de progression disponibles.</p>
      </section>
    );
  }

  const data = buildChartData(myPoints, theirPoints);

  return (
    <section className="progression-section">
      <h2 className="progression-title">Évolution du niveau</h2>
      <div className="progression-chart-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              minTickGap={60}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: 8,
                fontSize: 13,
              }}
              labelFormatter={(label: unknown) =>
                typeof label === "string" ? fmtDate(label) : String(label)
              }
              formatter={(value: unknown, name: unknown) => [
                typeof value === "number" ? value.toFixed(2) : String(value),
                name === "me" ? myLogin : theirLogin,
              ] as [string, string]}
            />
            <Legend
              formatter={(value: string) => (value === "me" ? myLogin : theirLogin)}
            />
            <Line
              type="monotone"
              dataKey="me"
              stroke="#4f8ef7"
              dot={false}
              strokeWidth={2}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="them"
              stroke="#f78f4f"
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
