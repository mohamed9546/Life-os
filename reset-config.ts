import { writeObject } from "./src/lib/storage";
import { getDefaultAppConfig } from "./src/lib/config/app-config";

async function main() {
  console.log("Loading default config with hardcoded keys...");
  const config = getDefaultAppConfig();
  console.log("Saving to Supabase...");
  await writeObject("app-config", config);
  console.log("Done!");
}

main().catch(console.error);
