import { getTeamUser } from "@/lib/team-auth";
import { searchCourtCases } from "@/lib/court-providers/ecourts-india";

export const dynamic = "force-dynamic";

function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeCaseNumber(value: string) {
  const text = value.trim();

  const match = text.match(/(\d+)\s*\/\s*(\d{2,4})/);

  if (!match) {
    return text;
  }

  const number = match[1];
  let year = match[2];

  if (year.length === 2) {
    const shortYear = Number(year);
    year = String(shortYear <= 30 ? 2000 + shortYear : 1900 + shortYear);
  }

  return `${number}/${year}`;
}

function courtCodeFor(court: string) {
  const value = court.toUpperCase();

  // Current PLG Bengaluru City Civil matters.
  // We will expand this mapping as we verify additional courts.
  if (
    value.includes("CH 44") ||
    value.includes("CH44") ||
    value.includes("CITY CIVIL")
  ) {
    return "KABC01";
  }

  return undefined;
}

export async function POST(req: Request) {
  try {
    const user = await getTeamUser(req);

    if (!user) {
      return reply({ error: "Sign in to search court records." }, 401);
    }

    const origin = req.headers.get("origin");

    if (!origin || origin !== new URL(req.url).origin) {
      return reply({ error: "Request origin is not allowed." }, 403);
    }

    const text = await req.text();

    if (text.length > 5000) {
      return reply({ error: "Search request is too large." }, 413);
    }

    const body = JSON.parse(text) as {
      caseNumber?: unknown;
      court?: unknown;
    };

    if (
      typeof body.caseNumber !== "string" ||
      body.caseNumber.trim().length === 0
    ) {
      return reply({ error: "Case number is required." }, 400);
    }

    const caseNumber = normalizeCaseNumber(body.caseNumber);

    const court =
      typeof body.court === "string"
        ? body.court.trim()
        : "";

    const courtCode = courtCodeFor(court);

    if (!courtCode) {
      return reply(
        {
          error:
            "This court has not been mapped for automatic CNR search yet.",
        },
        400,
      );
    }

    const result = await searchCourtCases(caseNumber, courtCode);

    return reply({
      query: {
        caseNumber,
        courtCode,
      },
      totalHits: result.totalHits,
      candidates: result.results,
    });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Court search could not be completed.",
      },
      502,
    );
  }
}