DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chatmessage' AND column_name = 'file_context'
    ) THEN
        ALTER TABLE chatmessage ADD COLUMN file_context TEXT;
    END IF;
END $$;
