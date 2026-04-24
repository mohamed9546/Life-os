function truthy(value?: string | null): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

export function isLocalOnlyMode(): boolean {
  return truthy(process.env.LIFE_OS_LOCAL_ONLY) || truthy(process.env.NEXT_PUBLIC_LIFE_OS_LOCAL_ONLY);
}

