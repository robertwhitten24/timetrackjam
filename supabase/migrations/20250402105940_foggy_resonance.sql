/*
  # Update Scheduled Reports Schema

  1. Changes
    - Add frequency column to scheduled_reports table
    - Update repeat_days to handle end of month (-1)
    - Remove unnecessary date columns
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add frequency column
ALTER TABLE scheduled_reports
ADD COLUMN frequency text NOT NULL DEFAULT 'weekly'
CHECK (frequency IN ('weekly', 'monthly', 'both'));

-- Update repeat_days constraint to allow -1 (end of month)
ALTER TABLE scheduled_reports
DROP CONSTRAINT valid_repeat_days;

ALTER TABLE scheduled_reports
ADD CONSTRAINT valid_repeat_days 
CHECK (repeat_days <@ ARRAY[-1, 0, 1, 2, 3, 4, 5, 6]);

-- Remove unnecessary date columns
ALTER TABLE scheduled_reports
DROP COLUMN start_date,
DROP COLUMN end_date;

-- Update calculate_next_send function to handle end of month
CREATE OR REPLACE FUNCTION calculate_next_send()
RETURNS trigger AS $$
DECLARE
  next_date date;
  current_month date;
BEGIN
  -- Handle end of month (-1)
  IF -1 = ANY(NEW.repeat_days) THEN
    -- Get the end of the current month
    current_month := date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day';
    
    -- If today is past the end of month or it's the same day but past send time
    IF CURRENT_DATE > current_month OR 
       (CURRENT_DATE = current_month AND CURRENT_TIME > NEW.send_time::time) THEN
      -- Use next month's end
      next_date := date_trunc('month', CURRENT_DATE + interval '1 month') + interval '1 month' - interval '1 day';
    ELSE
      -- Use this month's end
      next_date := current_month;
    END IF;
  ELSE
    -- Calculate next occurrence for weekly reports (using existing logic)
    next_date := (
      SELECT min(d)
      FROM (
        SELECT current_date + i AS d
        FROM generate_series(0, 7) i
        WHERE extract(dow from current_date + i) = ANY(NEW.repeat_days)
      ) dates
      WHERE d + NEW.send_time::time > CURRENT_TIMESTAMP
    );
  END IF;

  -- Set the next send timestamp
  NEW.next_send := next_date + NEW.send_time::time;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;