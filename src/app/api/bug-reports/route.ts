import { NextRequest, NextResponse } from "next/server";
import { eq, desc, inArray } from "drizzle-orm";
import { currentUser } from "@/lib/session/current-user";
import { db } from "@/lib/db/client";
import { bugReports, users } from "@/lib/db/schema";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";
import {
  uploadBugScreenshot,
  getBugScreenshotSignedUrl,
} from "@/lib/bug-reports/storage";
import { getUserProfile } from "@/lib/db/queries/user";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DESCRIPTION_CHARS = 2000;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/**
 * POST a new bug report. Multipart form-data:
 *   description (string, required, ≤2000 chars)
 *   route       (string, optional)
 *   userAgent   (string, optional)
 *   image[0..N] (File, optional, ≤4 files, ≤5MB each, image/* MIME)
 */
export async function POST(req: NextRequest) {
  const ident = getRateLimitIdentifier(req);
  // Per-IP: 20/h absorbs a shared office IP without opening spam floodgates.
  const rl = await rateLimit(`bug-report:${ident}`, { count: 20, window: "1 h" });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many reports. Try again in an hour." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart payload." },
      { status: 400 },
    );
  }

  const description = (form.get("description") ?? "").toString().trim();
  const route = (form.get("route") ?? "").toString().trim() || null;
  const userAgent = (form.get("userAgent") ?? "").toString().trim() || null;

  if (!description) {
    return NextResponse.json(
      { error: "Description is required." },
      { status: 400 },
    );
  }
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return NextResponse.json(
      { error: `Description too long (max ${MAX_DESCRIPTION_CHARS} chars).` },
      { status: 400 },
    );
  }

  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("image")) continue;
    if (value instanceof File && value.size > 0) {
      if (!ALLOWED_MIME.has(value.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${value.type}` },
          { status: 400 },
        );
      }
      if (value.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "Each image must be ≤ 5MB." },
          { status: 400 },
        );
      }
      files.push(value);
    }
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Max ${MAX_FILES} images per report.` },
      { status: 400 },
    );
  }

  const user = await currentUser();
  const userId = user?.id ?? null;

  // Upload screenshots before inserting so we either commit a complete row
  // or abort. If any single upload fails, we abort the whole request.
  const imagePaths: string[] = [];
  for (const file of files) {
    const ext = mimeExt(file.type);
    const key = `${userId ?? "anon"}/${Date.now()}-${randomId()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const upload = await uploadBugScreenshot(key, buf, file.type);
      if (upload.path) imagePaths.push(upload.path);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Image upload failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  const [row] = await db
    .insert(bugReports)
    .values({
      userId,
      description,
      imagePaths,
      route,
      userAgent,
    })
    .returning({ id: bugReports.id });

  return NextResponse.json({ ok: true, id: row?.id });
}

/** GET /api/bug-reports?status=open  (operator-only) */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getUserProfile(user.id);
  if (!profile?.isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";
  const validStatuses = ["open", "in_progress", "fixed", "wontfix", "duplicate", "all"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const rows =
    status === "all"
      ? await db
          .select()
          .from(bugReports)
          .orderBy(desc(bugReports.createdAt))
          .limit(200)
      : await db
          .select()
          .from(bugReports)
          .where(
            eq(
              bugReports.status,
              status as "open" | "in_progress" | "fixed" | "wontfix" | "duplicate",
            ),
          )
          .orderBy(desc(bugReports.createdAt))
          .limit(200);

  // Resolve image paths to signed URLs and join reporter email/name.
  const reporterIds = Array.from(
    new Set(rows.map((r) => r.userId).filter((x): x is string => !!x)),
  );
  const reporters = reporterIds.length
    ? await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, reporterIds))
    : [];
  const reporterById = new Map(reporters.map((u) => [u.id, u]));

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const imageUrls = await Promise.all(
        (r.imagePaths ?? []).map((p) => getBugScreenshotSignedUrl(p)),
      );
      return {
        ...r,
        imageUrls: imageUrls.filter((u): u is string => !!u),
        reporter: r.userId ? reporterById.get(r.userId) ?? null : null,
      };
    }),
  );

  return NextResponse.json({ reports: enriched });
}

function mimeExt(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

