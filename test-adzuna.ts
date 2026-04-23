import { getAllAdapters, DEFAULT_SEARCH_QUERIES } from "./src/lib/jobs/sources";

async function main() {
  const all = getAllAdapters();
  const adzuna = all.find(a => a.sourceId === "adzuna");
  if (!adzuna) {
    console.log("Adzuna adapter not found");
    return;
  }
  console.log("Fetching jobs from Adzuna...");
  const result = await adzuna.fetchJobs(DEFAULT_SEARCH_QUERIES[0]);
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
