export type ForumCategory =
  | 'All'
  | 'GRBL & Firmware'
  | 'Servo & Pen Lift'
  | 'Dual-Y Steppers'
  | 'G-Code & Slicing'
  | 'Hardware & Wiring'
  | '500x500 Bed Setup'
  | 'General';

export interface ForumComment {
  id: string;
  postId: string;
  author: string;
  authorRole?: string;
  content: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  userVote?: 'up' | 'down' | null;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: Exclude<ForumCategory, 'All'>;
  tags: string[];
  author: string;
  authorAvatar?: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  userVote?: 'up' | 'down' | null;
  comments: ForumComment[];
  isSolved?: boolean;
  codeSnippet?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isFallback?: boolean;
}
