import { SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  accessToken?: string;
  login?: string;
  userId?: number;
  campusId?: number;
  campusName?: string;
  poolYear?: string;
  cursusId?: number;
  image?: string;
  level?: number;
};

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "ft_rank_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}
