import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session.accessToken) redirect("/ranking");

  return (
    <main style={{ textAlign: "center", paddingTop: 80 }}>
      <h1>42 FightRank</h1>
      <p style={{ color: "#9ca3af", marginBottom: 32 }}>
        Vois ton classement parmi les etudiants de ta promo
      </p>
      <a className="btn" href="/api/auth/login">
        Se connecter avec 42
      </a>
    </main>
  );
}
