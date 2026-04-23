import { getActiveAdapters, getAllAdapters } from "./src/lib/jobs/sources";
import { getAppConfig } from "./src/lib/config/app-config";
import { readObject } from "./src/lib/storage";

async function main() {
  const config = await getAppConfig();
  console.log("Adzuna config in appConfig:", config.jobSources.adzuna);
  
  const all = getAllAdapters();
  const adzuna = all.find(a => a.sourceId === "adzuna");
  if (adzuna) {
    const isConf = await adzuna.isConfigured();
    console.log("Adzuna isConfigured:", isConf);
  }
}
main().catch(console.error);
