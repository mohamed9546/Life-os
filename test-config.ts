import { getAppConfig } from "./src/lib/config/app-config";

async function main() {
  const config = await getAppConfig();
  console.log("Adzuna config:", config.jobSources.adzuna);
}

main().catch(console.error);
