-- Create users table
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL DEFAULT 'google',
    user_info JSONB,
    password VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_user_id ON "user" (user_id);
