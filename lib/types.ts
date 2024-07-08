// types.ts
import { RealtimeChannel } from "@supabase/supabase-js";

export interface Participant {
  user_id: string;
  username: string;
  online_at: string;
  presence_ref: string;
}

export interface ChatMessage {
  message: string;
  user: string;
}

export interface Stream {
  userId: string;
  stream: MediaStream;
}
