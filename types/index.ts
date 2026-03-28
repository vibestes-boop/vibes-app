export type VibePost = {
  id: string;
  author: string;
  caption: string;
  mediaUrl?: string;
  likes: number;
  comments: number;
  dwellTimeScore: number;
  createdAt: string;
  tags: string[];
};

export type GuildPost = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  reactions: number;
  replies: number;
  createdAt: string;
};

export type Guild = {
  id: string;
  name: string;
  memberCount: number;
  vibe: string;
  members: string[];
};

export type UserProfile = {
  id: string;
  username: string;
  bio: string;
  avatarUrl?: string;
  vibeVector: number[];
  guildId?: string;
  postCount: number;
};

export type VibeSettings = {
  exploreVibe: number;
  brainVibe: number;
};
