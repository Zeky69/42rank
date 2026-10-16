// Avatars de secours générés à partir du login (toujours le même pour un login donné),
// utilisés quand le CDN de 42 refuse la photo de profil.

type Rng = () => number;

function seedFrom(str: string): number {
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: Rng, list: readonly T[]): T =>
  list[Math.floor(rng() * list.length)];

// Couleurs des coalitions + le turquoise 42
const BACKGROUNDS = ["#4180db", "#33c47f", "#a061d1", "#ff6950", "#00babc"];
const SKINS = ["#f5d0a9", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#9be37a"];

type Eyes = "dots" | "tired" | "dead" | "happy" | "shades";
type Mouth = "smile" | "flat" | "o" | "wavy" | "grin";

type Accessory = {
  title: string;
  eyes?: Eyes;
  mouth?: Mouth;
  draw: (skin: string) => string;
};

const ACCESSORIES: Accessory[] = [
  {
    title: "Rescapé de la Piscine",
    draw: () =>
      `<rect x="26" y="46" width="48" height="6" rx="3" fill="#111"/>` +
      `<circle cx="39" cy="50" r="8" fill="#7dd3fc" stroke="#111" stroke-width="3"/>` +
      `<circle cx="61" cy="50" r="8" fill="#7dd3fc" stroke="#111" stroke-width="3"/>` +
      `<path d="M78 40 v28 h-6" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>`,
    eyes: "dots",
  },
  {
    title: "Fan inconditionnel de 42",
    draw: () =>
      `<rect x="22" y="30" width="56" height="11" rx="4" fill="#111"/>` +
      `<text x="50" y="39.5" font-family="monospace" font-weight="700" font-size="10" fill="#00babc" text-anchor="middle">42</text>`,
  },
  {
    title: "Carbure au café de la cafet'",
    eyes: "tired",
    draw: () =>
      `<rect x="68" y="70" width="16" height="18" rx="2" fill="#fff" stroke="#111" stroke-width="2"/>` +
      `<path d="M84 74 q6 0 6 5 t-6 5" fill="none" stroke="#111" stroke-width="2"/>` +
      `<rect x="70" y="72" width="12" height="4" fill="#6b3e1d"/>` +
      `<path d="M72 66 q2 -3 0 -6 M78 66 q2 -3 0 -6" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    title: "Victime de la Moulinette",
    eyes: "dead",
    mouth: "wavy",
    draw: () =>
      `<rect x="60" y="12" width="30" height="16" rx="4" fill="#ef4444"/>` +
      `<text x="75" y="24" font-family="monospace" font-weight="700" font-size="11" fill="#fff" text-anchor="middle">-42</text>`,
  },
  {
    title: "Blackhole dans 3 jours",
    mouth: "o",
    draw: () =>
      `<ellipse cx="50" cy="14" rx="20" ry="6" fill="none" stroke="#f97316" stroke-width="2.5"/>` +
      `<circle cx="50" cy="14" r="8" fill="#000"/>`,
  },
  {
    title: "Segmentation fault (core dumped)",
    eyes: "dead",
    mouth: "flat",
    draw: () =>
      `<path d="M76 10 l-8 14 h7 l-6 14" fill="none" stroke="#facc15" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M22 22 l4 4 M26 22 l-4 4" stroke="#fff" stroke-width="2"/>`,
  },
  {
    title: "Ennemi juré de la Norminette",
    mouth: "grin",
    draw: () =>
      `<rect x="6" y="66" width="30" height="20" rx="3" fill="#fff" stroke="#111" stroke-width="2"/>` +
      `<text x="21" y="75" font-family="monospace" font-size="6" fill="#111" text-anchor="middle">NORME</text>` +
      `<text x="21" y="83" font-family="monospace" font-weight="700" font-size="7" fill="#ef4444" text-anchor="middle">KO</text>`,
  },
  {
    title: "Habitué du Bocal",
    eyes: "shades",
    mouth: "smile",
    draw: () =>
      `<path d="M24 36 q26 -26 52 0 z" fill="#111"/>` +
      `<rect x="44" y="34" width="38" height="5" rx="2" fill="#111"/>` +
      `<text x="50" y="30" font-family="monospace" font-weight="700" font-size="9" fill="#00babc" text-anchor="middle">42</text>`,
  },
  {
    title: "Push à 4h du mat'",
    eyes: "tired",
    mouth: "flat",
    draw: () =>
      `<text x="72" y="26" font-family="sans-serif" font-weight="700" font-size="10" fill="#fff">z</text>` +
      `<text x="80" y="18" font-family="sans-serif" font-weight="700" font-size="13" fill="#fff">Z</text>`,
  },
  {
    title: "Debug au canard en plastique",
    eyes: "happy",
    draw: () =>
      `<ellipse cx="78" cy="82" rx="11" ry="7" fill="#facc15"/>` +
      `<circle cx="80" cy="71" r="6" fill="#facc15"/>` +
      `<path d="M85 71 l6 1 -6 2 z" fill="#f97316"/>` +
      `<circle cx="81" cy="70" r="1.2" fill="#111"/>`,
  },
  {
    title: "Correcteur sans pitié",
    eyes: "shades",
    mouth: "flat",
    draw: () =>
      `<rect x="68" y="66" width="18" height="22" rx="2" fill="#fff" stroke="#111" stroke-width="2"/>` +
      `<path d="M72 73 h10 M72 78 h10 M72 83 h6" stroke="#9ca3af" stroke-width="1.5"/>` +
      `<text x="77" y="64" font-family="sans-serif" font-weight="700" font-size="9" fill="#ef4444" text-anchor="middle">0</text>`,
  },
  {
    title: "Freeze activé",
    mouth: "o",
    draw: () =>
      `<path d="M14 18 v16 M6 26 h16 M8.5 20.5 l11 11 M19.5 20.5 l-11 11" stroke="#e0f2fe" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M30 78 q4 6 0 10" stroke="#7dd3fc" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
];

function drawEyes(eyes: Eyes): string {
  switch (eyes) {
    case "tired":
      return (
        `<path d="M33 50 h12 M55 50 h12" stroke="#111" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M34 55 q5 3 10 0 M56 55 q5 3 10 0" stroke="#7c3aed" stroke-width="2" fill="none" opacity="0.6"/>`
      );
    case "dead":
      return `<path d="M34 45 l9 9 M43 45 l-9 9 M57 45 l9 9 M66 45 l-9 9" stroke="#111" stroke-width="3" stroke-linecap="round"/>`;
    case "happy":
      return `<path d="M33 52 q6 -7 12 0 M55 52 q6 -7 12 0" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case "shades":
      return (
        `<rect x="29" y="44" width="18" height="11" rx="4" fill="#111"/>` +
        `<rect x="53" y="44" width="18" height="11" rx="4" fill="#111"/>` +
        `<path d="M47 48 h6" stroke="#111" stroke-width="3"/>`
      );
    default:
      return `<circle cx="39" cy="50" r="4" fill="#111"/><circle cx="61" cy="50" r="4" fill="#111"/>`;
  }
}

function drawMouth(mouth: Mouth): string {
  switch (mouth) {
    case "flat":
      return `<path d="M42 70 h16" stroke="#111" stroke-width="3" stroke-linecap="round"/>`;
    case "o":
      return `<ellipse cx="50" cy="70" rx="5" ry="6" fill="#111"/>`;
    case "wavy":
      return `<path d="M38 71 q3 -4 6 0 t6 0 t6 0 t6 0" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case "grin":
      return (
        `<path d="M36 64 q14 14 28 0 z" fill="#111"/>` +
        `<path d="M40 65 h20" stroke="#fff" stroke-width="2"/>`
      );
    default:
      return `<path d="M38 66 q12 10 24 0" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
}

const cache = new Map<string, { src: string; title: string }>();

export function funnyAvatar(login: string): { src: string; title: string } {
  const hit = cache.get(login);
  if (hit) return hit;

  const rng = mulberry32(seedFrom(login));
  const bg = pick(rng, BACKGROUNDS);
  const skin = pick(rng, SKINS);
  const acc = pick(rng, ACCESSORIES);
  const eyes = acc.eyes ?? pick(rng, ["dots", "tired", "happy", "dots"] as const);
  const mouth = acc.mouth ?? pick(rng, ["smile", "grin", "flat", "o"] as const);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${bg}"/>` +
    `<path d="M14 104 q36 -34 72 0 z" fill="#111" opacity="0.35"/>` +
    `<circle cx="50" cy="56" r="28" fill="${skin}"/>` +
    `<circle cx="32" cy="63" r="4" fill="#f87171" opacity="0.35"/>` +
    `<circle cx="68" cy="63" r="4" fill="#f87171" opacity="0.35"/>` +
    drawEyes(eyes) +
    drawMouth(mouth) +
    acc.draw(skin) +
    `</svg>`;

  const result = {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    title: acc.title,
  };
  cache.set(login, result);
  return result;
}
