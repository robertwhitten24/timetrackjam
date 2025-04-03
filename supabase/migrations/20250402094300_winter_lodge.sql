/*
  # Add scheduled reports functionality

  1. New Tables
    - `scheduled_reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `client_id` (uuid, references clients)
      - `name` (text)
      - `start_date` (date)
      - `end_date` (date)
      - `repeat_days` (integer[])
      - `repeat_every` (integer)
      - `send_time` (time)
      - `recipient_email` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `last_sent` (timestamp)
      - `next_send` (timestamp)
    
  2. Security
    - Enable RLS on scheduled_reports table
    - Add policies for managing scheduled reports
*/

-- Create scheduled_reports table
CREATE TABLE scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  repeat_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 0 = Sunday, 1 = Monday, etc.
  repeat_every integer NOT NULL DEFAULT 1,
  send_time time NOT NULL,
  recipient_email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_sent timestamptz,
  next_send timestamptz NOT NULL,
  CONSTRAINT valid_repeat_days CHECK (repeat_days <@ ARRAY[0,1,2,3,4,5,6])
);

-- Enable RLS
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own scheduled reports"
ON scheduled_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled reports"
ON scheduled_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled reports"
ON scheduled_reports
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled reports"
ON scheduled_reports
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create function to calculate next send time
CREATE OR REPLACE FUNCTION calculate_next_send()
RETURNS trigger AS $$
BEGIN
  -- Calculate the next send time based on repeat_days and send_time
  NEW.next_send := (
    SELECT min(d)::timestamptz + NEW.send_time::time
    FROM (
      SELECT current_date + i AS d
      FROM generate_series(0, 7) i
      WHERE extract(dow from current_date + i) = ANY(NEW.repeat_days)
    ) dates
    WHERE d::timestamptz + NEW.send_time::time > COALESCE(NEW.last_sent, now())
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update next_send
CREATE TRIGGER update_next_send
  BEFORE INSERT OR UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION calculate_next_send();