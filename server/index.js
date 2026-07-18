import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '../ucrave-spots.json');
const ucraveData = JSON.parse(readFileSync(dataPath, 'utf8'));
const openAiApiKey = process.env.OPENAI_API_KEY;

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.post('/api/plan', (req, res) => {
  const { budget, minutes, zone, craving } = req.body ?? {};

  if ([budget, minutes, zone, craving].some((value) => value === undefined || value === '')) {
    return res.status(400).json({ error: 'budget, minutes, zone, and craving are required.' });
  }

  // The planner will use OPENAI_API_KEY server-side in a later iteration.
  // It is deliberately never sent to the browser.
  return res.json({
    status: 'placeholder',
    message: 'Your UCrave plan will appear here once the planner is connected.',
    request: { budget: Number(budget), minutes: Number(minutes), zone, craving },
    dataset: {
      spotsLoaded: ucraveData.spots.length,
      zonesLoaded: ucraveData.zones.length
    },
    plan: {
      title: `A ${craving} stop near ${zone}`,
      note: 'This is a stub response to confirm the request → response flow.'
    }
  });
});

app.listen(port, () => {
  console.log(`UCrave API listening at http://localhost:${port}`);
  console.log(`Loaded ${ucraveData.spots.length} spots across ${ucraveData.zones.length} zones.`);
  console.log(`OpenAI key configured: ${Boolean(openAiApiKey)}`);
});
