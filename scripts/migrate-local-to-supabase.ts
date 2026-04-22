import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DATA_DIR = path.join(process.cwd(), 'data');

function readJsonFile(filename: string): any[] {
  const fp = path.join(DATA_DIR, filename);
  if (!existsSync(fp)) return [];
  try {
    const content = readFileSync(fp, 'utf-8');
    return JSON.parse(content) || [];
  } catch (err) {
    console.error(`Error reading ${filename}`, err);
    return [];
  }
}

async function migrateData() {
  console.log("Starting migration to Supabase...");

  const profiles = readJsonFile('career-profiles.json');
  if (profiles.length > 0) {
    const payload = profiles.map((p: any) => ({
      id: p.id,
      email: p.email,
      full_name: p.fullName,
      onboarding_completed: p.onboardingCompleted || false,
      target_role_tracks: p.targetRoleTracks || [],
      target_locations: p.targetLocations || [],
      remote_preference: p.remotePreference || 'flexible',
      preferred_seniority: p.preferredSeniority || 'entry-to-mid',
      notification_frequency: p.notificationFrequency || 'daily',
      is_admin: p.isAdmin || false,
      created_at: p.createdAt || new Date().toISOString(),
      updated_at: p.updatedAt || new Date().toISOString()
    }));
    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) console.error("Error migrating profiles:", error);
    else console.log(`Migrated ${profiles.length} profiles.`);
  }

  const savedSearches = readJsonFile('saved-searches.json');
  if (savedSearches.length > 0) {
    const payload = savedSearches.map((s: any) => ({
      id: s.id,
      user_id: s.userId,
      label: s.label,
      keywords: s.keywords || [],
      location: s.location || 'United Kingdom',
      remote_only: s.remoteOnly || false,
      radius: s.radius || 25,
      enabled: s.enabled !== false,
      created_at: s.createdAt || new Date().toISOString(),
      updated_at: s.updatedAt || new Date().toISOString()
    }));
    const { error } = await supabase.from('saved_searches').upsert(payload);
    if (error) console.error("Error migrating saved searches:", error);
    else console.log(`Migrated ${savedSearches.length} saved searches.`);
  }

  const sourcePreferences = readJsonFile('source-preferences.json');
  if (sourcePreferences.length > 0) {
    const payload = sourcePreferences.map((s: any) => ({
      id: s.id,
      user_id: s.userId,
      source_id: s.sourceId,
      enabled: s.enabled !== false,
      created_at: s.createdAt || new Date().toISOString(),
      updated_at: s.updatedAt || new Date().toISOString()
    }));
    const { error } = await supabase.from('source_configs').upsert(payload, { onConflict: 'user_id, source_id' });
    if (error) console.error("Error migrating source configs:", error);
    else console.log(`Migrated ${sourcePreferences.length} source configs.`);
  }

  const rawJobs = readJsonFile('jobs-raw.json');
  if (rawJobs.length > 0) {
    const payload = rawJobs.map((j: any) => ({
      id: j.id || j.raw?.sourceJobId || j.raw?.link,
      user_id: j.userId || profiles[0]?.id, // Default to first profile if missing
      source: j.raw?.source || 'unknown',
      dedupe_key: j.dedupeKey,
      payload: j.raw || {},
      fetched_at: j.raw?.fetchedAt || new Date().toISOString(),
      created_at: j.createdAt || new Date().toISOString(),
      updated_at: j.updatedAt || new Date().toISOString()
    })).filter((j: any) => j.id && j.user_id);
    
    // Batch upsert for raw jobs (could be large)
    for (let i = 0; i < payload.length; i += 1000) {
      const batch = payload.slice(i, i + 1000);
      const { error } = await supabase.from('raw_jobs').upsert(batch);
      if (error) console.error("Error migrating raw jobs batch:", error);
    }
    console.log(`Migrated ${payload.length} raw jobs.`);
  }

  const allJobs = [
    ...readJsonFile('jobs-inbox.json'),
    ...readJsonFile('jobs-ranked.json'),
    ...readJsonFile('jobs-enriched.json'),
    ...readJsonFile('jobs-rejected.json')
  ];

  if (allJobs.length > 0) {
    const payload = allJobs.map((j: any) => ({
      id: j.id,
      user_id: j.userId || profiles[0]?.id,
      status: j.status || 'inbox',
      dedupe_key: j.dedupeKey,
      raw: j.raw || {},
      parsed: j.parsed || null,
      fit: j.fit || null,
      user_notes: j.userNotes || null,
      source_query_id: j.sourceQueryId || null,
      created_at: j.createdAt || new Date().toISOString(),
      updated_at: j.updatedAt || new Date().toISOString()
    })).filter((j: any) => j.id && j.user_id);

    for (let i = 0; i < payload.length; i += 1000) {
      const batch = payload.slice(i, i + 1000);
      const { error } = await supabase.from('jobs').upsert(batch);
      if (error) console.error("Error migrating jobs batch:", error);
    }
    console.log(`Migrated ${payload.length} jobs.`);
  }

  const weeklyReviews = readJsonFile('weekly-reviews.json');
  if (weeklyReviews.length > 0) {
    const payload = weeklyReviews.map((r: any) => ({
      id: r.id || crypto.randomUUID(),
      user_id: r.userId || profiles[0]?.id,
      weekly_summary: r.weeklySummary || '',
      wins: r.wins || [],
      risks: r.risks || [],
      recommended_focus: r.recommendedFocus || [],
      what_to_ignore: r.whatToIgnore || [],
      energy_advice: r.energyAdvice || '',
      job_search_advice: r.jobSearchAdvice || '',
      money_advice: r.moneyAdvice || '',
      unfinished_loops: r.unfinishedLoops || [],
      next_week_operating_focus: r.nextWeekOperatingFocus || [],
      created_at: r.createdAt || new Date().toISOString()
    })).filter((r: any) => r.user_id);
    const { error } = await supabase.from('weekly_reviews').upsert(payload);
    if (error) console.error("Error migrating weekly reviews:", error);
    else console.log(`Migrated ${weeklyReviews.length} weekly reviews.`);
  }

  console.log("Migration complete!");
}

migrateData().catch(console.error);
