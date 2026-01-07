-- Migration to add turn_index to chatmessage table
ALTER TABLE chatmessage ADD COLUMN turn_index INTEGER DEFAULT 0;
