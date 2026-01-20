-- Add user_id column to chatsession table for data isolation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chatsession' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE chatsession ADD COLUMN user_id VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_chatsession_user_id ON chatsession (user_id);
    END IF;
END $$;
