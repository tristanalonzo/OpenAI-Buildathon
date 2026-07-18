import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, "../ucrave-spots.json");
dotenv.config({ path: resolve(__dirname, "../.env") });
const ucraveData = JSON.parse(readFileSync(dataPath, "utf8"));
const openAiApiKey = process.env.OPENAI_API_KEY;

const app = express();
const port = process.env.PORT || 3001;
const PRICE_RANGE_CAPS = { 1: 150, 2: 300, 3: 500 };

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "stops", "note"],
  properties: {
    title: { type: "string" },
    stops: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "reason", "price_range"],
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          price_range: { type: "string" },
        },
      },
    },
    note: { type: "string" },
  },
};

app.use(express.json());

function priceRangeCap(priceRange) {
  if (priceRange === "1") return PRICE_RANGE_CAPS[1];
  const pesoSigns = (priceRange?.match(/₱/g) || []).length;
  return pesoSigns ? (PRICE_RANGE_CAPS[pesoSigns] ?? Infinity) : Infinity;
}

function getHoursText(hours) {
  return typeof hours === "string" ? hours : hours?.daily || "";
}

function timeToMinutes(hour, minute, meridiem) {
  let normalizedHour = Number(hour) % 12;
  if (meridiem.toLowerCase() === "pm") normalizedHour += 12;
  return normalizedHour * 60 + Number(minute || 0);
}

function isOpenNow(hours) {
  const hoursText = getHoursText(hours).toLowerCase();
  if (!hoursText) return null;
  if (hoursText.includes("24/7") || hoursText.includes("24 hours")) return true;

  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const now =
    Number(nowParts.find((part) => part.type === "hour")?.value) * 60 +
    Number(nowParts.find((part) => part.type === "minute")?.value);
  const ranges = [
    ...hoursText.matchAll(
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/g,
    ),
  ];

  if (!ranges.length) return null;
  return ranges.some(
    ([
      ,
      startHour,
      startMinute,
      startMeridiem,
      endHour,
      endMinute,
      endMeridiem,
    ]) => {
      const start = timeToMinutes(startHour, startMinute, startMeridiem);
      const end = timeToMinutes(endHour, endMinute, endMeridiem);
      return start <= end
        ? now >= start && now <= end
        : now >= start || now <= end;
    },
  );
}

function filterCandidates({ budget, zoneSlug }) {
  return ucraveData.spots
    .filter(
      (spot) =>
        spot.zone_slug === zoneSlug &&
        priceRangeCap(spot.price_range) <= budget,
    )
    .map((spot) => ({
      name: spot.name,
      price_range: spot.price_range,
      vibe_tags: spot.vibe_tags || [],
      hours: getHoursText(spot.hours) || null,
      open_now: isOpenNow(spot.hours),
      enriched: Boolean(spot.enriched),
      address: spot.address || null,
    }))
    .sort((left, right) => {
      const score = (spot) =>
        (spot.enriched ? 2 : 0) + (spot.open_now === true ? 1 : 0);
      return score(right) - score(left) || left.name.localeCompare(right.name);
    })
    .slice(0, 24);
}

function validatePlan(plan, candidates) {
  if (
    !plan ||
    typeof plan.title !== "string" ||
    typeof plan.note !== "string" ||
    !Array.isArray(plan.stops)
  ) {
    throw new Error("The model returned an invalid plan.");
  }

  const candidateByName = new Map(
    candidates.map((candidate) => [candidate.name, candidate]),
  );
  const stops = plan.stops.slice(0, 2).map((stop) => {
    const candidate = candidateByName.get(stop.name);
    if (!candidate || typeof stop.reason !== "string")
      throw new Error("The model selected a spot outside the candidates.");
    return {
      name: candidate.name,
      reason: stop.reason,
      price_range: candidate.price_range,
    };
  });

  if (!stops.length) throw new Error("The model did not select any spots.");
  return { title: plan.title, stops, note: plan.note };
}

function createOpenAIClient() {
  return openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;
}

app.post("/api/plan", async (req, res) => {
  const {
    budget: rawBudget,
    minutes: rawMinutes,
    zone_slug: zoneSlug,
    craving,
  } = req.body ?? {};
  const budget = Number(rawBudget);
  const minutes = Number(rawMinutes);

  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    !zoneSlug ||
    !craving?.trim()
  ) {
    return res
      .status(400)
      .json({ error: "budget, minutes, zone_slug, and craving are required." });
  }

  const candidates = filterCandidates({ budget, zoneSlug });
  if (!candidates.length) {
    return res.json({
      title: "Nothing fits just yet",
      stops: [],
      note: "Nothing fits those constraints. Try widening your budget or time.",
    });
  }

  const prompt = [
    "Compose a concrete campus meal plan using only the candidate spots provided.",
    "Pick one or two distinct spots and put them in visit order.",
    "Give exactly one short reason per pick, tied to the user budget, available time, and craving.",
    "Use the candidate name and price range exactly as supplied. Do not invent places, prices, or details.",
    `User request: ${JSON.stringify({ budget_pesos: budget, minutes, zone_slug: zoneSlug, craving: craving.trim() })}`,
    `Candidates: ${JSON.stringify(candidates)}`,
  ].join("\n\n");

  try {
    const openai = createOpenAIClient();
    if (!openai)
      throw new Error("OPENAI_API_KEY was not loaded by the server process.");

    const response = await openai.responses.create({
      model: "gpt-5.6-terra",
      store: false,
      max_output_tokens: 400,
      input: [
        {
          role: "system",
          content:
            "You are UCrave, a precise campus food planner. Return only the requested JSON.",
        },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ucrave_meal_plan",
          strict: true,
          schema: planSchema,
        },
      },
    });

    return res.json(validatePlan(JSON.parse(response.output_text), candidates));
  } catch (error) {
    const status = error?.status || error?.statusCode || 500;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`UCrave planner error [${status}]: ${message}`);
    return res
      .status(status >= 400 && status < 600 ? status : 500)
      .json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`UCrave API listening at http://localhost:${port}`);
  console.log(
    `Loaded ${ucraveData.spots.length} spots across ${ucraveData.zones.length} zones.`,
  );
  console.log(
    `KEY LOADED: ${Boolean(openAiApiKey)} (${openAiApiKey?.length || 0} chars)`,
  );
});
