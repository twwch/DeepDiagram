-- Migration to add turn_index to chatmessage table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chatmessage' AND column_name = 'turn_index'
    ) THEN
        ALTER TABLE chatmessage ADD COLUMN turn_index INTEGER DEFAULT 0;
    END IF;
END $$;
