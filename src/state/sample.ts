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
