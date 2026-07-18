import { parsePlanRequest, createPlan } from "../lib/planner.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const input = parsePlanRequest(req.body);
  if (!input) {
    return res
      .status(400)
      .json({ error: "budget, minutes, zone_slug, and craving are required." });
  }

  try {
    return res.json(await createPlan(input));
  } catch (error) {
    const status = error?.status || error?.statusCode || 500;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`UCrave planner error [${status}]: ${message}`);
    return res
      .status(status >= 400 && status < 600 ? status : 500)
      .json({ error: message });
  }
}
