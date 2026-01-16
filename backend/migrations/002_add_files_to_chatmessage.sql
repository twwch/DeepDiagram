DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chatmessage' AND column_name = 'files'
    ) THEN
        ALTER TABLE chatmessage ADD COLUMN files JSON;
    END IF;
END $$;
