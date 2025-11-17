-- Create a table for WebRTC signaling messages
CREATE TABLE IF NOT EXISTS public.signaling_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL DEFAULT 'main-room',
  sender_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signaling_messages ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read and write signaling messages (public meeting)
CREATE POLICY "Anyone can read signaling messages"
ON public.signaling_messages
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert signaling messages"
ON public.signaling_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.signaling_messages;

-- Create index for performance
CREATE INDEX idx_signaling_room ON public.signaling_messages(room_id, created_at DESC);