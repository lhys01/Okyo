# Okyo Supabase development schema

This directory is the versioned source of truth for the development database
schema. The configured hosted target is the development-only project
`pdaqegoiopdbclwmwtjv` (`okyo-development`).

Do not place personal access tokens, database passwords, service-role keys, or
other credentials in this directory. Copy `.env.example` to an ignored local
environment file only when running the Supabase CLI locally.

The mobile application will use only the project URL and publishable key. All
application table mutations are performed by the Okyo API after it verifies the
user's Supabase JWT. Food images remain transient request data and are not
represented by any database column.

Migrations must be reviewed locally before being applied. Applying a migration
to the hosted development project requires explicit approval.
