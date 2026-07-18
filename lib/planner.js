import OpenAI from "openai";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ucraveData = require("../ucrave-spots.json");

const MODEL_ID = "gpt-5.6-terra";
// ₱ tiers: minimum realistic spend per tier — a spot qualifies if its cheapest
// meal fits the budget, not its ceiling (₱100 should still surface ₱-tier spots).
const PRICE_TIER_FLOORS = { 1: 0, 2: 151, 3: 301 };
const MAX_STOPS = 3;
const MAX_CANDIDATES = 24;

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "stops", "note"],
  properties: {
    title: { type: "string" },
    stops: {
      type: "array",
      minItems: 1,
      maxItems: MAX_STOPS,
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

// 138 of the 204 surveyed spots carry no zone_slug — only lat/lng. Derive the
// zone geometrically: nearest zone center, within 1.5× the zone radius.
const toRad = (deg) => (deg * Math.PI) / 180;

function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function deriveZoneSlug(spot) {
  if (spot.zone_slug) return spot.zone_slug;
  if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) return null;
  let bestZone = null;
  let bestDistance = Infinity;
  for (const zone of ucraveData.zones) {
    const distance = distanceMeters(
      spot.lat,
      spot.lng,
      zone.center_lat,
      zone.center_lng,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestZone = zone;
    }
  }
  return bestZone && bestDistance <= bestZone.radius_m * 1.5
    ? bestZone.slug
    : null;
}

const spotsWithZones = ucraveData.spots.map((spot) => ({
  ...spot,
  zone_slug: deriveZoneSlug(spot),
}));

function priceTierFloor(priceRange) {
  if (priceRange === "1") return PRICE_TIER_FLOORS[1];
  const pesoSigns = (priceRange?.match(/₱/g) || []).length;
  return pesoSigns ? (PRICE_TIER_FLOORS[pesoSigns] ?? 0) : 0;
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
  return spotsWithZones
    .filter(
      (spot) =>
        spot.zone_slug === zoneSlug &&
        priceTierFloor(spot.price_range) <= budget,
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
    .slice(0, MAX_CANDIDATES);
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
  const stops = plan.stops.slice(0, MAX_STOPS).map((stop) => {
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

export function parsePlanRequest(body) {
  const {
    budget: rawBudget,
    minutes: rawMinutes,
    zone_slug: zoneSlug,
    craving,
  } = body ?? {};
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
    return null;
  }
  return { budget, minutes, zoneSlug, craving: craving.trim() };
}

export async function createPlan({ budget, minutes, zoneSlug, craving }) {
  const candidates = filterCandidates({ budget, zoneSlug });
  if (!candidates.length) {
    const zoneHasSpots = spotsWithZones.some(
      (spot) => spot.zone_slug === zoneSlug,
    );
    return {
      title: "Nothing fits just yet",
      stops: [],
      note: zoneHasSpots
        ? "Nothing fits those constraints. Try widening your budget or time."
        : "We haven't surveyed enough spots in this zone yet — U-Belt / Sampaloc has the deepest coverage for now.",
    };
  }

  const prompt = [
    "Compose a concrete campus meal plan using only the candidate spots provided.",
    "Pick one to three distinct spots, in the order the student should visit them.",
    "When the craving has multiple parts (e.g. a meal then coffee, or food then dessert) and the budget and minutes comfortably allow it, plan a separate stop per part — that ordered route is the whole point. Collapse to a single stop only when time or money is genuinely tight.",
    "The combined spend across all stops must fit within the user's budget, and the whole route must be doable in the available minutes.",
    "Give exactly one short reason per pick, tied to the user budget, available time, and craving.",
    "Use the candidate name and price range exactly as supplied. Do not invent places, prices, or details.",
    `User request: ${JSON.stringify({ budget_pesos: budget, minutes, zone_slug: zoneSlug, craving })}`,
    `Candidates: ${JSON.stringify(candidates)}`,
  ].join("\n\n");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error("OPENAI_API_KEY was not loaded by the server process.");
  const openai = new OpenAI({ apiKey });

  const response = await openai.responses.create({
    model: MODEL_ID,
    store: false,
    max_output_tokens: 600,
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

  return validatePlan(JSON.parse(response.output_text), candidates);
}

export { ucraveData };
