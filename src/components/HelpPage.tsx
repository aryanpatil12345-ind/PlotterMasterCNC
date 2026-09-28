import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Bot,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Send,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Cpu,
  Flame,
  Clock,
  Code,
  Sliders,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { ForumPost, ForumComment, ForumCategory, ChatMessage } from '../types/help';
import { INITIAL_FORUM_POSTS } from '../data/defaultForumPosts';

type SubTab = 'forum' | 'ai-help';

const CATEGORIES: ForumCategory[] = [
  'All',
  'GRBL & Firmware',
  'Servo & Pen Lift',
  'Dual-Y Steppers',
  'G-Code & Slicing',
  'Hardware & Wiring',
  '500x500 Bed Setup',
  'General',
];

const LOCAL_STORAGE_KEY = 'plottercraft_forum_posts_v1';

export const HelpPage: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('forum');

  // --- FORUM STATE ---
  const [posts, setPosts] = useState<ForumPost[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load forum posts from storage', e);
    }
    return INITIAL_FORUM_POSTS;
  });

  const [selectedCategory, setSelectedCategory] = useState<ForumCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'top' | 'newest' | 'comments'>('top');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // New post modal state
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<Exclude<ForumCategory, 'All'>>('Servo & Pen Lift');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newCodeSnippet, setNewCodeSnippet] = useState('');

  // Comment input per post
  const [commentInputs, setCommentInputs] = useState<Record<string, { author: string; content: string }>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Save forum posts to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(posts));
    } catch (e) {
      console.error('Failed to save forum posts to storage', e);
    }
  }, [posts]);

  // --- AI HELP STATE ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `👋 **Welcome to the PlotterCraft AI Engineering Assistant!**

I specialize in 500x500mm CNC pen plotters, Arduino Uno + CNC Shield V3, Dual-Y stepper kinematics, and SG90 servo pen-lift configurations.

**Common issues I can solve for you:**
- ⚡ **SG90 Servo Wiring:** Pin 11 PWM jitter, 5V regulator brownouts, and angle calibration.
- 🔄 **Dual-Y Stepper Alignment:** Reversing motor direction, syncing belts, and squaring the gantry.
- 📐 **GRBL Steps/mm ($100/$101):** Calibrating 16-tooth vs 20-tooth GT2 pulleys and microstepping.
- 🎯 **500x500mm Center Origin:** Setting up work offsets and the (0,0) center point.
- ✂️ **Single-Line Centerline:** Using skeleton thinning for Potato/Low/Medium modes.

Type your question below or click any of the quick-help chips!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuestion, setInputQuestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat internally without scrolling the window/page
  useEffect(() => {
    if (subTab === 'ai-help' && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, subTab]);

  // Copy helper
  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // --- FORUM ACTIONS ---
  const handleVotePost = (postId: string, direction: 'up' | 'down') => {
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id !== postId) return post;

        let newUp = post.upvotes;
        let newDown = post.downvotes;
        let newVote: 'up' | 'down' | null = direction;

        if (post.userVote === direction) {
          // Toggle off
          newVote = null;
          if (direction === 'up') newUp -= 1;
          else newDown -= 1;
        } else if (post.userVote === 'up' && direction === 'down') {
          newUp -= 1;
          newDown += 1;
        } else if (post.userVote === 'down' && direction === 'up') {
          newDown -= 1;
          newUp += 1;
        } else {
          // First time vote
          if (direction === 'up') newUp += 1;
          else newDown += 1;
        }

        return {
          ...post,
          upvotes: Math.max(0, newUp),
          downvotes: Math.max(0, newDown),
          userVote: newVote,
        };
      })
    );
  };

  const handleVoteComment = (postId: string, commentId: string, direction: 'up' | 'down') => {
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: post.comments.map((comment) => {
            if (comment.id !== commentId) return comment;

            let newUp = comment.upvotes;
            let newDown = comment.downvotes;
            let newVote: 'up' | 'down' | null = direction;

            if (comment.userVote === direction) {
              newVote = null;
              if (direction === 'up') newUp -= 1;
              else newDown -= 1;
            } else if (comment.userVote === 'up' && direction === 'down') {
              newUp -= 1;
              newDown += 1;
            } else if (comment.userVote === 'down' && direction === 'up') {
              newDown -= 1;
              newUp += 1;
            } else {
              if (direction === 'up') newUp += 1;
              else newDown += 1;
            }

            return {
              ...comment,
              upvotes: Math.max(0, newUp),
              downvotes: Math.max(0, newDown),
              userVote: newVote,
            };
          }),
        };
      })
    );
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const tagsArray = newTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      tags: tagsArray.length > 0 ? tagsArray : [newCategory.replace(/\s+/g, '')],
      author: newAuthor.trim() || 'Anonymous Maker',
      createdAt: 'Just now',
      upvotes: 1,
      downvotes: 0,
      userVote: 'up',
      codeSnippet: newCodeSnippet.trim() ? newCodeSnippet.trim() : undefined,
      comments: [],
    };

    setPosts([newPost, ...posts]);
    setNewTitle('');
    setNewContent('');
    setNewAuthor('');
    setNewTags('');
    setNewCodeSnippet('');
    setIsCreatingPost(false);
    setExpandedPostId(newPost.id);
  };

  const handleAddComment = (postId: string) => {
    const input = commentInputs[postId];
    if (!input || !input.content.trim()) return;

    const newComment: ForumComment = {
      id: `c-${Date.now()}`,
      postId,
      author: input.author.trim() || 'Maker Community Member',
      content: input.content.trim(),
      createdAt: 'Just now',
      upvotes: 0,
      downvotes: 0,
      userVote: null,
    };

    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: [...post.comments, newComment],
        };
      })
    );

    // Clear comment input
    setCommentInputs((prev) => ({
      ...prev,
      [postId]: { author: input.author, content: '' },
    }));
  };

  // --- FILTER & SORT POSTS ---
  const filteredPosts = posts
    .filter((post) => {
      const matchCat = selectedCategory === 'All' || post.category === selectedCategory;
      const matchSearch =
        searchQuery === '' ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        post.author.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'top') {
        const scoreA = a.upvotes - a.downvotes;
        const scoreB = b.upvotes - b.downvotes;
        return scoreB - scoreA;
      }
      if (sortBy === 'comments') {
        return b.comments.length - a.comments.length;
      }
      // 'newest' (assuming array order or simple id comparison)
      return b.id.localeCompare(a.id);
    });

  // --- AI HELP SUBMISSION ---
  const handleAskAi = async (questionText?: string) => {
    const query = (questionText || inputQuestion).trim();
    if (!query || isAiLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai/help-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: chatMessages.slice(-5),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'Here is the technical recommendation for your setup.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: data.isFallback,
      };

      setChatMessages((prev) => [...prev, aiReply]);
    } catch (err: any) {
      console.error('Error fetching AI help:', err);
      // Fallback response in case of network issue
      const fallbackReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: `### 🛠️ Hardware Diagnostic Check

I could not connect to the cloud AI service, but here is instant diagnostic advice for your 500x500mm CNC Pen Plotter:

1. **Servo on Pin 11:** Make sure your SG90 servo ground is shared with Arduino GND and power is supplied from a dedicated 5V 1A+ source.
2. **Dual-Y Steppers:** If the motors are fighting, invert the 4-pin plug of one motor 180 degrees.
3. **GRBL Settings:**
\`\`\`text
$100=80.000   ; X-axis steps/mm (20T GT2, 1/16 microstepping)
$101=80.000   ; Y-axis steps/mm
$32=0         ; Laser mode OFF (allows PWM for RC servo)
$30=1000      ; Max spindle RPM (PWM scaling)
\`\`\`
4. **Single-Line Centerline:** Use the Potato/Low/Medium toggle to thin thick shapes into single pen strokes and shrink by 65%.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: true,
      };
      setChatMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const quickPrompts = [
    { title: '⚡ Servo Jitter on Pin 11', q: 'How do I wire an SG90 micro servo to CNC Shield V3 Pin 11 and prevent motor jitter and brownouts?' },
    { title: '🔄 Dual Y-Steppers Fighting', q: 'My dual Y-steppers on the CNC Shield A-driver are moving in opposite directions or racking the gantry. How do I fix it?' },
    { title: '📐 Steps/mm Calibration ($100/$101)', q: 'How do I calculate and configure $100 and $101 steps/mm for 16-tooth vs 20-tooth GT2 pulleys on a 500x500mm bed?' },
    { title: '🎯 500x500mm Bed Center Origin (0,0)', q: 'How does the (0,0) center origin work on the 500x500mm bed and how do I zero the machine?' },
    { title: '✂️ Single-Line Centerline Mode', q: 'How does the Single-Line Centerline Thinning mode work on thick letters and logos in potato/low/medium qualities?' },
    { title: '🖊️ Pen Dragging During G0 Rapids', q: 'My pen is dragging on the paper when traveling between shapes with G0. How do I adjust servo pen lift delay?' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Sub-page Navigation Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <HelpCircle className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-neutral-100">
                PlotterCraft Help &amp; Community Center
              </h1>
            </div>
            <p className="text-xs text-neutral-400 max-w-2xl">
              Ask questions, discuss hardware configurations with other makers, or get instant AI-powered engineering diagnostics for your 500x500mm dual-Y CNC pen plotter.
            </p>
          </div>

          {/* Subpage Switcher Pills */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 self-start md:self-auto">
            <button
              onClick={() => setSubTab('forum')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'forum'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm font-bold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Community Forum</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-900/60 font-mono">
                {posts.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab('ai-help')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'ai-help'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm font-bold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>AI Plotter Assistant</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-medium">
                Live AI
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. COMMUNITY FORUM SUBPAGE                                                */}
      {/* ========================================================================= */}
      {subTab === 'forum' && (
        <div className="space-y-6">
          {/* Forum Toolbar: Search, Category Chips, Sort, and "Create Topic" Button */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search forum topics, keywords (e.g. Pin 11, Dual-Y, $100, SG90, G0)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400 transition-colors"
                />
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-400 whitespace-nowrap">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-400 cursor-pointer"
                >
                  <option value="top">🔥 Top Voted</option>
                  <option value="newest">🕒 Newest First</option>
                  <option value="comments">💬 Most Comments</option>
                </select>

                {/* Create Topic Button */}
                <button
                  type="button"
                  onClick={() => setIsCreatingPost(!isCreatingPost)}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ask for Help / New Topic</span>
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] text-neutral-500 font-semibold mr-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" />
                Category:
              </span>
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                        : 'bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* New Topic Creation Form (Collapsible) */}
          {isCreatingPost && (
            <form
              onSubmit={handleCreatePost}
              className="bg-neutral-900 border-2 border-amber-400/40 rounded-xl p-5 space-y-4 shadow-md transition-all animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-amber-400/20 text-amber-400">
                    <Plus className="w-4 h-4" />
                  </span>
                  <h2 className="text-sm font-bold text-neutral-100">
                    Create New Community Help Topic
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingPost(false)}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Topic Title <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Y-axis steps lose alignment during fast 3000mm/min rapids"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-hidden focus:border-amber-400 cursor-pointer"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Question Details / Description <span className="text-amber-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your plotter hardware, what you have tried, wiring setup, Arduino pinout, and symptoms..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Your Name / Handle
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex_Maker42"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SG90, Pin11, Jitter, GRBL"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-amber-400" />
                  <span>Optional G-code or Configuration Snippet</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. $100=80, $101=80, M3 S90"
                  value={newCodeSnippet}
                  onChange={(e) => setNewCodeSnippet(e.target.value)}
                  className="w-full bg-neutral-950 font-mono border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingPost(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  Publish Help Request
                </button>
              </div>
            </form>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {filteredPosts.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center space-y-3">
                <MessageSquare className="w-8 h-8 text-neutral-600 mx-auto" />
                <h3 className="text-sm font-semibold text-neutral-200">No matching topics found</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Try clearing your search query or category filter, or click &quot;Ask for Help&quot; to start the first thread on this topic!
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="text-xs text-amber-400 hover:underline inline-block mt-1"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isExpanded = expandedPostId === post.id;
                const score = post.upvotes - post.downvotes;
                const commentInput = commentInputs[post.id] || { author: '', content: '' };

                return (
                  <article
                    key={post.id}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700/80 transition-all shadow-sm"
                  >
                    {/* Post Card Main Content */}
                    <div className="p-4 sm:p-5 flex items-start gap-4">
                      {/* Voting Column */}
                      <div className="flex flex-col items-center justify-center bg-neutral-950/80 border border-neutral-800 rounded-lg p-1.5 shrink-0 min-w-[42px]">
                        <button
                          type="button"
                          onClick={() => handleVotePost(post.id, 'up')}
                          className={`p-1 rounded hover:bg-neutral-800 transition-colors ${
                            post.userVote === 'up'
                              ? 'text-emerald-400 font-bold'
                              : 'text-neutral-500 hover:text-neutral-200'
                          }`}
                          title="Upvote this question"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`text-xs font-mono font-bold my-0.5 ${
                            score > 0
                              ? 'text-emerald-400'
                              : score < 0
                              ? 'text-red-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {score}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleVotePost(post.id, 'down')}
                          className={`p-1 rounded hover:bg-neutral-800 transition-colors ${
                            post.userVote === 'down'
                              ? 'text-red-400 font-bold'
                              : 'text-neutral-500 hover:text-neutral-200'
                          }`}
                          title="Downvote"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Post Information */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            {post.category}
                          </span>

                          {post.isSolved && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Solved</span>
                            </span>
                          )}

                          <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.createdAt}
                          </span>
                          <span className="text-neutral-600">·</span>
                          <span className="text-[11px] text-neutral-400 font-medium">
                            by <span className="text-neutral-300">{post.author}</span>
                          </span>
                        </div>

                        {/* Title */}
                        <h2
                          onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                          className="text-sm sm:text-base font-bold text-neutral-100 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          {post.title}
                        </h2>

                        {/* Post description text */}
                        <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed">
                          {isExpanded
                            ? post.content
                            : post.content.length > 220
                            ? `${post.content.slice(0, 220)}...`
                            : post.content}
                        </p>

                        {/* Optional Code Snippet */}
                        {post.codeSnippet && (
                          <div className="relative mt-2 bg-neutral-950 border border-neutral-800 rounded-lg p-3 font-mono text-[11px] text-neutral-300 overflow-x-auto">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(post.codeSnippet!, post.id)}
                              className="absolute right-2 top-2 px-1.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 rounded text-[10px] text-neutral-300 flex items-center gap-1"
                            >
                              {copiedCodeId === post.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <pre className="text-neutral-300">{post.codeSnippet}</pre>
                          </div>
                        )}

                        {/* Tags and Expand/Comments bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {post.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>
                              {post.comments.length} {post.comments.length === 1 ? 'Comment' : 'Comments'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ========================================= */}
                    {/* EXPANDED COMMENTS / ANSWERS SECTION       */}
                    {/* ========================================= */}
                    {isExpanded && (
                      <div className="bg-neutral-950/70 border-t border-neutral-800 p-4 sm:p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-neutral-200 flex items-center gap-2">
                            <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Community Answers &amp; Replies ({post.comments.length})</span>
                          </h3>
                        </div>

                        {/* Existing Comments */}
                        {post.comments.length === 0 ? (
                          <div className="p-4 bg-neutral-900/50 rounded-lg text-center border border-neutral-800/60">
                            <p className="text-xs text-neutral-400">
                              No comments yet. Have advice or a solution? Be the first to answer below!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {post.comments.map((comment) => {
                              const cScore = comment.upvotes - comment.downvotes;
                              return (
                                <div
                                  key={comment.id}
                                  className="bg-neutral-900 border border-neutral-800 rounded-lg p-3.5 flex items-start gap-3"
                                >
                                  {/* Comment Vote */}
                                  <div className="flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded p-1 shrink-0 min-w-[34px]">
                                    <button
                                      type="button"
                                      onClick={() => handleVoteComment(post.id, comment.id, 'up')}
                                      className={`p-0.5 rounded ${
                                        comment.userVote === 'up'
                                          ? 'text-emerald-400'
                                          : 'text-neutral-500 hover:text-neutral-200'
                                      }`}
                                    >
                                      <ThumbsUp className="w-3 h-3" />
                                    </button>
                                    <span className="text-[10px] font-mono font-bold my-0.5 text-neutral-300">
                                      {cScore}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleVoteComment(post.id, comment.id, 'down')}
                                      className={`p-0.5 rounded ${
                                        comment.userVote === 'down'
                                          ? 'text-red-400'
                                          : 'text-neutral-500 hover:text-neutral-200'
                                      }`}
                                    >
                                      <ThumbsDown className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold text-neutral-200">
                                        {comment.author}
                                      </span>
                                      {comment.authorRole && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                          {comment.authorRole}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-neutral-500">
                                        {comment.createdAt}
                                      </span>
                                    </div>
                                    <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed">
                                      {comment.content}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add Comment Form */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2.5">
                          <span className="text-xs font-semibold text-neutral-200 block">
                            Leave an Answer or Tip
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <input
                              type="text"
                              placeholder="Your Name / Handle"
                              value={commentInput.author}
                              onChange={(e) =>
                                setCommentInputs((prev) => ({
                                  ...prev,
                                  [post.id]: {
                                    author: e.target.value,
                                    content: prev[post.id]?.content || '',
                                  },
                                }))
                              }
                              className="sm:col-span-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
                            />
                            <textarea
                              rows={2}
                              placeholder="Write your response, wiring instructions, or advice..."
                              value={commentInput.content}
                              onChange={(e) =>
                                setCommentInputs((prev) => ({
                                  ...prev,
                                  [post.id]: {
                                    author: prev[post.id]?.author || '',
                                    content: e.target.value,
                                  },
                                }))
                              }
                              className="sm:col-span-3 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleAddComment(post.id)}
                              disabled={!commentInput.content?.trim()}
                              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>Post Reply</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AI PLOTTER ASSISTANT & KNOWLEDGE HUB SUBPAGE                          */}
      {/* ========================================================================= */}
      {subTab === 'ai-help' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chat Interface (2 Cols) */}
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col h-[680px] shadow-sm overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-neutral-950 font-bold shadow-sm">
                  <Bot className="w-4 h-4 text-neutral-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-neutral-100">
                      PlotterCraft AI Engineer
                    </h2>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Gemini 3.8 Flash
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Real-time hardware, GRBL, G-code, and calibration support
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setChatMessages([
                    {
                      id: 'welcome-reset',
                      sender: 'assistant',
                      text: 'Chat history cleared. How can I assist with your 500x500mm CNC Pen Plotter build today?',
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
                className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800"
                title="Clear conversation"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Chat Messages Stream */}
            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatMessages.map((msg) => {
                const isAssistant = msg.sender === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      isAssistant ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {isAssistant && (
                      <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-xl p-3.5 text-xs leading-relaxed ${
                        isAssistant
                          ? 'bg-neutral-950 border border-neutral-800 text-neutral-200'
                          : 'bg-amber-400 text-neutral-950 font-medium'
                      }`}
                    >
                      <div className="whitespace-pre-line prose prose-invert prose-xs max-w-none">
                        {msg.text}
                      </div>
                      <div
                        className={`text-[9px] mt-1.5 flex items-center justify-between font-mono ${
                          isAssistant ? 'text-neutral-500' : 'text-neutral-800'
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                        {isAssistant && msg.isFallback && (
                          <span className="text-amber-500/80">Local Knowledge Engine</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAiLoading && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-neutral-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>PlotterCraft AI is synthesizing technical solution...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompts Selector */}
            <div className="px-4 py-2 bg-neutral-950/60 border-t border-neutral-800/80 overflow-x-auto flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-500 font-mono whitespace-nowrap flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Quick Ask:
              </span>
              {quickPrompts.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleAskAi(item.q)}
                  disabled={isAiLoading}
                  className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-300 hover:text-amber-300 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {item.title}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAi();
              }}
              className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about wiring, GRBL commands, servo flutter, steps/mm, or toolpaths..."
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                disabled={isAiLoading}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={isAiLoading || !inputQuestion.trim()}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-sm disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>

          {/* Side Knowledge Reference Cards (1 Col) */}
          <div className="space-y-4">
            {/* Quick Wiring Cheat Sheet */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-400/20 text-amber-400">
                  <Cpu className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-bold text-neutral-200">
                  CNC Shield V3 Pinout Guide
                </h3>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                  <div className="flex justify-between text-neutral-400">
                    <span>X Motor:</span>
                    <span className="text-amber-300">X-Axis Slot</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">1 Stepper for Pen Gantry</span>
                </div>

                <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                  <div className="flex justify-between text-neutral-400">
                    <span>Y Motors (Dual):</span>
                    <span className="text-amber-300">Y-Axis + A-Clone</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">Jumpers installed on A=Y headers</span>
                </div>

                <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                  <div className="flex justify-between text-neutral-400">
                    <span>SG90 Servo:</span>
                    <span className="text-amber-300">Pin 11 (Z+ / SpnEn)</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">Yellow = Sig, Red = 5V, Brown = GND</span>
                </div>
              </div>
            </div>

            {/* Essential GRBL Settings Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                  <Terminal className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-bold text-neutral-200">
                  Essential GRBL 1.1f Commands
                </h3>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                {[
                  { cmd: '$100=80', desc: 'X steps/mm (20T GT2, 1/16)' },
                  { cmd: '$101=80', desc: 'Y steps/mm (20T GT2, 1/16)' },
                  { cmd: '$32=0', desc: 'Laser mode OFF (Enables Servo)' },
                  { cmd: '$30=1000', desc: 'Max PWM spindle scale' },
                  { cmd: '$130=500', desc: 'Max X travel (500mm bed)' },
                  { cmd: '$131=500', desc: 'Max Y travel (500mm bed)' },
                  { cmd: 'M3 S0', desc: 'Pen UP travel position' },
                  { cmd: 'M3 S90', desc: 'Pen DOWN drawing position' },
                  { cmd: 'G92 X0 Y0', desc: 'Zero bed center origin' },
                ].map((row) => (
                  <div
                    key={row.cmd}
                    className="flex items-center justify-between p-1.5 rounded bg-neutral-950 border border-neutral-800/60"
                  >
                    <span className="text-amber-400 font-bold">{row.cmd}</span>
                    <span className="text-neutral-400 text-[10px]">{row.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Single-Line Centerline Info Box */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-400/20 text-amber-400">
                  <Sliders className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-bold text-neutral-200">
                  Single-Line Thinning &amp; Shrunk
                </h3>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                In Potato, Low, and Medium modes, the vectorizer applies morphological thinning to draw thick shapes with a single center stroke, and scales by 65% for rapid plotting. Toggle it in the Image Vectorizer!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
