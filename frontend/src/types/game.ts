// All shared TypeScript types mirroring backend dataclasses

export type GameStatus =
  | 'LOBBY'
  | 'IN_ROUND'
  | 'ROUND_REVEAL'
  | 'BETWEEN_ROUNDS'
  | 'GAME_OVER';

export type MediaType = 'image' | 'video';

export interface GameSettings {
  rounds: number;
  vote_timer_seconds: number;
  leaderboard_time_seconds: number;
  videos_allowed: boolean;
}

export interface PlayerInfo {
  player_id: string;
  name: string;
  is_host: boolean;
  is_ready: boolean;
  photo_count: number;
  score: number;
  streak: number;
}

export interface UploadedPhoto {
  photo_id: string;
  filename: string;
  media_type: MediaType;
  url: string;
}

export interface VoteInfo {
  voter_id: string;
  voter_name: string;
  voted_for_id: string | null;
  voted_for_name: string | null;
  correct: boolean;
  points_earned: number;
  elapsed_ms?: number | null;
}

export interface LeaderboardEntry {
  player_id: string;
  name: string;
  score: number;
  streak: number;
  delta: number;
}

export interface RoundStartData {
  round_idx: number;
  round_number: number;
  total_rounds: number;
  media_url: string;
  media_type: MediaType;
}

export interface RoundEndData {
  round_number: number;
  owner_id: string;
  owner_name: string;
  media_url: string;
  media_type: MediaType;
  votes: VoteInfo[];
  scores_delta: Record<string, number>;
  leaderboard: LeaderboardEntry[];
}

export interface RoomState {
  game_code: string;
  status: GameStatus;
  settings: GameSettings;
  players: PlayerInfo[];
  current_round_number?: number;
  total_rounds?: number;
  current_media_url?: string;
  current_media_type?: MediaType;
  round_elapsed_ms?: number;
  my_vote?: string | null;
  my_selected_photos?: UploadedPhoto[];
  my_uploaded_photos?: UploadedPhoto[];
  has_swap_pool?: boolean;
}

export interface PhotoSwappedData {
  old_photo_id: string;
  new_photo: UploadedPhoto;
  selected_photos: UploadedPhoto[];
  has_swap_pool: boolean;
}

export interface UploadResponse {
  photo_id: string;
  uploaded_count: number;
  selected_photos: UploadedPhoto[];
  has_swap_pool: boolean;
}
