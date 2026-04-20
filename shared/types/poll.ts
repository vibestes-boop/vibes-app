export interface LivePoll {
  id: string;
  session_id: string;
  host_id: string; // Author-ID (ab v1.27.4 Host ODER CoHost ODER Moderator)
  question: string;
  options: string[];
  closed_at: string | null;
  created_at: string;
}

export interface LivePollVote {
  poll_id: string;
  user_id: string;
  option_index: number;
  voted_at: string;
}

export interface LivePollWithVotes extends LivePoll {
  vote_counts: number[];
  total_votes: number;
  my_vote: number | null;
}
