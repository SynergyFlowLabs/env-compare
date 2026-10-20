/**
 * Sample data used by "See an example" and by the docs screenshots.
 * Every value is obviously fake — nothing here is a real credential.
 */

export const SAMPLE_EXAMPLE = `# --- Database ---
DATABASE_URL=postgresql://user:password@localhost:5432/app

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=changeme

# --- Payments ---
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=

# --- Email ---
RESEND_API_KEY=re_xxxxxxxxxxxx

# --- Optional ---
# SENTRY_DSN=
`;

export const SAMPLE_TARGET = `# copied from the README, then edited by hand
DATABASE_URL=postgresql://user:password@localhost:5432/app
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample.signature
SUPABASE_SERVICE_ROLE_KEY=changeme
STRIPE_WEBHOOK_SECRET=
LEGACY_GA_ID=UA-000000-2
`;

/**
 * A sample `.env` in the shape people actually paste (issue #13): a banner
 * comment, section headings, blank lines, a duplicate key, a placeholder, and a
 * password inside a URL. Every value is fake.
 */
export const SAMPLE_ENV = `# ============================================
# ZeroExam v3 — Environment Variables
# Copy to .env, then fill in the values. Never commit .env to git.
# ============================================

# --- Auth ---
BETTER_AUTH_SECRET=dev-only-not-a-real-secret-0123456789
BETTER_AUTH_URL=https://app.example.com

# --- AI providers ---
GOOGLE_GENERATIVE_AI_API_KEY=AIzaFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE
LANGFUSE_PUBLIC_KEY=pk-lf-1234567890
LANGFUSE_SECRET_KEY=sk-lf-abcdefabcdefabcdef

# --- Database ---
DATABASE_URL=postgresql://user:hunter2@localhost:5432/zeroexam
REDIS_URL=redis://localhost:6379

# Repeated on purpose: the last one wins, and the page should say so.
LOG_LEVEL=debug
LOG_LEVEL=info

PORT=3000
NODE_ENV=production
`;
