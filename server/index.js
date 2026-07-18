import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parsePlanRequest, createPlan, ucraveData } from "../lib/planner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.post("/api/plan", async (req, res) => {
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
});

app.listen(port, () => {
  console.log(`UCrave API listening at http://localhost:${port}`);
  console.log(
    `Loaded ${ucraveData.spots.length} spots across ${ucraveData.zones.length} zones.`,
  );
  console.log(
    `KEY LOADED: ${Boolean(process.env.OPENAI_API_KEY)} (${process.env.OPENAI_API_KEY?.length || 0} chars)`,
  );
});
