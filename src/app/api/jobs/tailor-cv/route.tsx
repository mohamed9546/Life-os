import { NextRequest, NextResponse } from "next/server";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { getJobById } from "@/lib/jobs/storage";
import { loadCandidateProfile } from "@/lib/profile/candidate-profile";
import { tailorCV } from "@/lib/ai/tasks/tailor-cv";

// ---- PDF styles (ATS-friendly: single column, no tables, no images) ----
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
    color: "#1a1a1a",
  },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  headline: { fontSize: 11, marginBottom: 2, color: "#444" },
  location: { fontSize: 10, color: "#666", marginBottom: 14 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginBottom: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#222",
  },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 12, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 10, color: "#333" },
  section: { marginBottom: 14 },
  tailoredNote: {
    fontSize: 8,
    color: "#999",
    marginTop: 6,
    fontStyle: "italic",
  },
});

function BulletList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function CVDocument({
  name, headline, location, summary, highlights, education, jobTitle, company,
}: {
  name: string;
  headline: string;
  location: string;
  summary: string;
  highlights: string[];
  education: string[];
  jobTitle: string;
  company: string;
}) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.name }, name),
      React.createElement(Text, { style: styles.headline }, headline),
      React.createElement(Text, { style: styles.location }, location),
      React.createElement(View, { style: styles.divider }),

      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Professional Summary"),
        React.createElement(Text, { style: styles.paragraph }, summary)
      ),

      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Experience Highlights"),
        React.createElement(BulletList, { items: highlights }),
        React.createElement(Text, { style: styles.tailoredNote },
          `Auto-tailored for: ${jobTitle} at ${company}`
        )
      ),

      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Education"),
        React.createElement(BulletList, { items: education })
      )
    )
  );
}

export async function POST(req: NextRequest) {
  let jobId: string;
  try {
    const body = (await req.json()) as { jobId?: string };
    if (!body.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    jobId = body.jobId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const [job, profile] = await Promise.all([
    getJobById(jobId),
    loadCandidateProfile(),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (!profile) {
    return NextResponse.json(
      { error: "No candidate profile found. Please set up your profile in Settings first." },
      { status: 422 }
    );
  }

  const parsedJob = job.parsed?.data;
  if (!parsedJob) {
    return NextResponse.json(
      { error: "Job has not been parsed yet. Please re-enrich the job." },
      { status: 422 }
    );
  }

  const tailoredHighlights = await tailorCV(parsedJob, profile);

  const safeFilename = `cv-${parsedJob.company.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.pdf`;

  try {
    const buffer = await renderToBuffer(
      React.createElement(CVDocument, {
        name: profile.fullName || "Candidate",
        headline: profile.headline || "",
        location: profile.location || "",
        summary: profile.summary || "",
        highlights: tailoredHighlights,
        education: profile.education || [],
        jobTitle: parsedJob.title,
        company: parsedJob.company,
      }) as any
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    console.error("[tailor-cv] PDF render error:", msg);
    return NextResponse.json({ error: `PDF generation failed: ${msg}` }, { status: 500 });
  }
}
