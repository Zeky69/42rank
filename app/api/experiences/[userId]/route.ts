import { getSession } from "@/lib/session";
import {
  fetchExperiencePage,
  computeLevelPoints,
  getXpCache,
  setXpCache,
  TokenExpiredError,
} from "@/lib/ft-api";

const CURSUS_ID = 21;

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const session = await getSession();
  if (!session.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = parseInt(params.userId, 10);
  if (isNaN(userId)) return new Response("Bad Request", { status: 400 });

  const token = session.accessToken;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const cached = getXpCache(userId, CURSUS_ID);
        if (cached) {
          send({ type: "total", pages: 0 });
          send({ type: "data", points: computeLevelPoints(cached) });
          return;
        }

        const { events: firstBatch, total } = await fetchExperiencePage(
          userId,
          CURSUS_ID,
          1,
          token,
        );

        const totalPages = Math.max(1, Math.ceil(total / 100));
        send({ type: "total", pages: totalPages });

        const allEvents = [...firstBatch];
        send({ type: "progress", done: 1, total: totalPages });

        for (let page = 2; page <= totalPages; page++) {
          const { events } = await fetchExperiencePage(
            userId,
            CURSUS_ID,
            page,
            token,
          );
          allEvents.push(...events);
          send({ type: "progress", done: page, total: totalPages });
        }

        setXpCache(userId, CURSUS_ID, allEvents);
        send({ type: "data", points: computeLevelPoints(allEvents) });
      } catch (e) {
        if (e instanceof TokenExpiredError) {
          send({ type: "error", message: "token_expired" });
        } else {
          send({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
