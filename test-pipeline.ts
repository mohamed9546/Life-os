import { DEFAULT_SEARCH_QUERIES } from "./src/lib/jobs/sources";
import { getActiveAdapters } from "./src/lib/jobs/sources";

async function main() {
  const adapters = await getActiveAdapters();
  console.log("Active adapters:", adapters.map(a => a.sourceId).join(", "));
  
  const adzuna = adapters.find(a => a.sourceId === "adzuna");
  if (!adzuna) { console.log("Adzuna not active"); return; }
  
  console.log("Fetching jobs from Adzuna...");
  const result = await adzuna.fetchJobs(DEFAULT_SEARCH_QUERIES[0]);
  console.log("Jobs fetched:", result.jobs.length);
  if (result.error) console.log("Error:", result.error);
}

main().catch(console.error);
