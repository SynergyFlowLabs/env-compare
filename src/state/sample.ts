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
 * A CSV export of the same kind of data (issue #10): a key column and a value
 * column, with one secret repeated so the masking page can show that duplicates
 * still line up after masking. Every value is fake.
 */
export const SAMPLE_CSV = `key,value,environment
DATABASE_URL,postgresql://user:password@localhost:5432/app,development
STRIPE_SECRET_KEY,sk_test_51H8xQ2LkdIwHu7ixFAKEFAKEFAKEFAKE,production
RESEND_API_KEY,re_123456789_abcdefghijklmnop,production
SESSION_SECRET,dev-only-not-a-real-secret-0123456789,development
CDN_BASE_URL,https://cdn.example.com/assets,production
STRIPE_WEBHOOK_SECRET,whsec_FAKEFAKEFAKEFAKEFAKEFAKEFAKE,production
SMTP_PASSWORD,hunter2-but-obviously-fake,staging
API_TIMEOUT_MS,30000,production
LOG_LEVEL,info,production
`;
