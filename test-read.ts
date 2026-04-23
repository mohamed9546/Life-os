import { readObject } from "./src/lib/storage";
async function main() {
  const data = await readObject<any>("app-config");
  console.log(JSON.stringify(data.jobSources.adzuna, null, 2));
}
main().catch(console.error);
