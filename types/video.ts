export interface Video {
  id: string;
  videoUrl: string;
  thumbnail: string;
  username: string;
  userAvatar: string;
  description: string;
  likes: number;
  comments: number;
  shares: number;
  tags: string[];
}

export interface Comment {
  id: string;
  username: string;
  text: string;
  timestamp: string;
  likes: number;
  avatar: string;
}