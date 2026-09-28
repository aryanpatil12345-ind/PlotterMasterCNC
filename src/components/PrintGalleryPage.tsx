import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Users,
  Compass,
  Search,
  Upload,
  Play,
  Sliders,
  Check,
  Heart,
  Tag,
  ExternalLink,
  Layers,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  ChevronRight,
  PlusCircle,
  X,
  FileCode,
  Image as ImageIcon,
  Palette,
  Maximize2
} from 'lucide-react';
import { GalleryItem, MachineConfig, ImageProcessingConfig } from '../types/plotter';
import { initializeGalleryData, DEFAULT_CLASSICS, COMMUNITY_ITEMS } from '../utils/galleryData';
import { generateContourPaths, generateHatchingPaths, optimizePaths } from '../utils/imageVectorizer';
import { generateGCode } from '../utils/gcodeGenerator';

interface PrintGalleryPageProps {
  onSelectImageForPlot: (imageUrl: string, title: string, directToController?: boolean) => void;
  onOpenVectorizerWithImage: (imageUrl: string, title: string) => void;
  machineConfig: MachineConfig;
  imageConfig: ImageProcessingConfig;
}

const STYLE_OPTIONS = [
  { id: 'line_art', name: 'Clean Vector Line Art', desc: 'Sharp black contours on white, zero fill' },
  { id: 'single_line', name: 'Continuous Single Line', desc: 'Unbroken fluid stroke with zero pen lifts' },
  { id: 'blueprint', name: 'Technical Blueprint', desc: 'Architectural precision schematics & dimensions' },
  { id: 'sketch', name: 'Da Vinci Engineering Sketch', desc: 'Technical mechanical line drawings & notes' },
  { id: 'mandala', name: 'Sacred Mandala / Geometric', desc: 'High-symmetry geometric lines & circles' },
  { id: 'stipple', name: 'Stipple & Dotwork Engraving', desc: 'Pen plotter micro-hatching and dot density' },
  { id: 'woodcut', name: 'Vintage Woodcut & Linocut', desc: 'Bold vintage woodblock relief lines' },
];

const PROMPT_SUGGESTIONS = [
  'Leonardo Da Vinci mechanical catapult blueprint with gears and pulleys',
  'Intricate sacred geometry 16-fold mandala with overlapping petals',
  'Continuous single line drawing of a galloping wild mustang horse',
  'Botanical fern frond illustration with roots and botanical leaves',
  'Steampunk pocket watch with exposed escapement and balance wheel',
  'Japanese Hokusai cresting ocean wave in clean woodcut lines',
  'Cyberpunk drone quadcopter schematic with dimension lines and motors',
  'Minimalist Picasso-style single line facial portrait',
];

export const PrintGalleryPage: React.FC<PrintGalleryPageProps> = ({
  onSelectImageForPlot,
  onOpenVectorizerWithImage,
  machineConfig,
  imageConfig,
}) => {
  // Navigation tabs inside the gallery
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'ai' | 'community' | 'defaults'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Gallery items state
  const [defaultItems, setDefaultItems] = useState<GalleryItem[]>([]);
  const [communityItems, setCommunityItems] = useState<GalleryItem[]>([]);
  const [customUploads, setCustomUploads] = useState<GalleryItem[]>([]);
  const [likedItemIds, setLikedItemIds] = useState<Set<string>>(new Set());

  // AI Generation State
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('line_art');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '16:9'>('1:1');
  const [qualityLevel, setQualityLevel] = useState<'potato' | 'low' | 'medium' | 'high'>('medium');
  const [singleLineShrunk, setSingleLineShrunk] = useState(true);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<{
    imageUrl: string;
    prompt: string;
    timestamp: string;
    style: string;
  } | null>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Engineering & Mechanics');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadImageFile, setUploadImageFile] = useState<string | null>(null);

  const refImageInputRef = useRef<HTMLInputElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize built-in and community items
  useEffect(() => {
    const data = initializeGalleryData();
    setDefaultItems(data.defaults);
    setCommunityItems(data.community);

    // Load user custom uploads from localStorage
    try {
      const stored = localStorage.getItem('plotter_custom_community_uploads');
      if (stored) {
        setCustomUploads(JSON.parse(stored));
      }
      const storedLikes = localStorage.getItem('plotter_liked_items');
      if (storedLikes) {
        setLikedItemIds(new Set(JSON.parse(storedLikes)));
      }
    } catch (e) {
      console.error('Error loading custom uploads:', e);
    }
  }, []);

  // Save likes to localStorage
  const toggleLike = (id: string) => {
    setLikedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('plotter_liked_items', JSON.stringify(Array.from(next)));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  // Combine items for filtering
  const allItems = useMemo(() => {
    return [...defaultItems, ...customUploads, ...communityItems];
  }, [defaultItems, customUploads, communityItems]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => set.add(item.category));
    return ['All', ...Array.from(set)];
  }, [allItems]);

  // Filtered items based on active sub-tab, search, and category
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Tab filter
      if (activeSubTab === 'defaults' && item.source !== 'default') return false;
      if (activeSubTab === 'community' && item.source !== 'community' && !item.id.startsWith('custom_')) return false;
      if (activeSubTab === 'ai') return false; // AI tab has its own dedicated generator view

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesAuthor = item.author.toLowerCase().includes(q);
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesAuthor && !matchesTags) return false;
      }

      return true;
    });
  }, [allItems, activeSubTab, selectedCategory, searchQuery]);

  // Client-side fallback image synthesizer when API key is missing or offline
  const generateProceduralFallback = (promptText: string, styleId: string): string => {
    const c = document.createElement('canvas');
    c.width = 500;
    c.height = 500;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 500, 500);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;

    const lower = promptText.toLowerCase();

    if (lower.includes('mandala') || lower.includes('sacred') || styleId === 'mandala') {
      // Procedural 16-fold mandala
      const cx = 250, cy = 250;
      [220, 170, 120, 70, 30].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI * 2) / 16;
        ctx.beginPath();
        ctx.arc(cx + 120 * Math.cos(a), cy + 120 * Math.sin(a), 35, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (lower.includes('gear') || lower.includes('blueprint') || lower.includes('motor') || styleId === 'blueprint') {
      // Procedural schematic with dimension lines
      ctx.strokeRect(60, 60, 380, 380);
      ctx.strokeRect(100, 100, 300, 300);
      ctx.beginPath();
      ctx.arc(250, 250, 90, 0, Math.PI * 2);
      ctx.arc(250, 250, 35, 0, Math.PI * 2);
      ctx.stroke();
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(250, 250);
        ctx.lineTo(250 + 130 * Math.cos(ang), 250 + 130 * Math.sin(ang));
        ctx.stroke();
      }
    } else {
      // Flowing continuous line art
      ctx.beginPath();
      ctx.moveTo(100, 250);
      for (let x = 100; x <= 400; x += 15) {
        const y = 250 + Math.sin(x * 0.04) * 80 + Math.cos(x * 0.08) * 40;
        ctx.lineTo(x, y);
      }
      for (let r = 40; r <= 160; r += 30) {
        ctx.moveTo(250 + r, 250);
        ctx.arc(250, 250, r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    return c.toDataURL('image/png');
  };

  // Handle AI generation
  const handleGenerateAI = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setAiError(null);

    try {
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: selectedStyle,
          aspectRatio,
          referenceImage,
          quality: qualityLevel,
          singleLineShrunk,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.imageUrl) {
        setGeneratedResult({
          imageUrl: data.imageUrl,
          prompt,
          timestamp: new Date().toLocaleTimeString(),
          style: selectedStyle,
        });
      } else {
        // Check if API key missing or model error -> Use smart client procedural synthesizer fallback
        console.warn('Backend API note:', data.error);
        const fallbackUrl = generateProceduralFallback(prompt, selectedStyle);
        setGeneratedResult({
          imageUrl: fallbackUrl,
          prompt,
          timestamp: new Date().toLocaleTimeString(),
          style: selectedStyle,
        });
        if (data.isKeyMissing) {
          setAiError('Note: Connected using client vector synthesis. To activate cloud Gemini 3.1 Flash Image models, configure GEMINI_API_KEY in AI Studio Secrets.');
        } else {
          setAiError(`Note: ${data.error || 'Switched to local vector synthesis.'}`);
        }
      }
    } catch (err: any) {
      console.warn('Network or server error, generating local vector rendering:', err);
      const fallbackUrl = generateProceduralFallback(prompt, selectedStyle);
      setGeneratedResult({
        imageUrl: fallbackUrl,
        prompt,
        timestamp: new Date().toLocaleTimeString(),
        style: selectedStyle,
      });
      setAiError('Synthesized locally using plotter vector engine.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Add generated result to Community list
  const handleSaveToCommunity = () => {
    if (!generatedResult) return;
    const newItem: GalleryItem = {
      id: `custom_ai_${Date.now()}`,
      title: generatedResult.prompt.slice(0, 45) + (generatedResult.prompt.length > 45 ? '...' : ''),
      category: 'AI Generated',
      source: 'community',
      description: `Generated with prompt: "${generatedResult.prompt}" using style: ${generatedResult.style}`,
      author: '@you (AI Maker)',
      imageUrl: generatedResult.imageUrl,
      tags: ['AI', 'Generated', generatedResult.style, 'CustomPlot'],
      complexity: 'Medium',
      aspectRatio,
      likes: 1,
      dateAdded: 'Just now',
    };

    const updated = [newItem, ...customUploads];
    setCustomUploads(updated);
    try {
      localStorage.setItem('plotter_custom_community_uploads', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setActiveSubTab('community');
  };

  // Submit custom user upload
  const handleCreateCustomUpload = () => {
    if (!uploadTitle.trim() || !uploadImageFile) return;

    const tagsArray = uploadTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const newItem: GalleryItem = {
      id: `custom_user_${Date.now()}`,
      title: uploadTitle.trim(),
      category: uploadCategory,
      source: 'community',
      description: `Uploaded by maker ${uploadAuthor || '@anonymous'}. Ready for vector plotting.`,
      author: uploadAuthor.trim() ? (uploadAuthor.startsWith('@') ? uploadAuthor : `@${uploadAuthor}`) : '@maker_community',
      imageUrl: uploadImageFile,
      tags: tagsArray.length > 0 ? tagsArray : ['MakerUpload', 'VectorPlot'],
      complexity: 'Medium',
      aspectRatio: '1:1',
      likes: 1,
      dateAdded: 'Just now',
    };

    const updated = [newItem, ...customUploads];
    setCustomUploads(updated);
    try {
      localStorage.setItem('plotter_custom_community_uploads', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    // Reset form & close modal
    setIsUploadModalOpen(false);
    setUploadTitle('');
    setUploadAuthor('');
    setUploadTags('');
    setUploadImageFile(null);
    setActiveSubTab('community');
  };

  return (
    <div className="flex flex-col gap-5 text-xs">
      {/* Hero Header & Gallery Navigation */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-md mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Art &amp; Print Gallery</span>
            </div>
            <h2 className="text-xl font-bold text-neutral-100 tracking-tight">
              Create AI Artwork, Discover Community Plots, or Print Verified Classics
            </h2>
            <p className="text-neutral-400 text-xs mt-1 max-w-2xl leading-relaxed">
              Generate custom vector-ready line art with Gemini AI, explore community shared artwork, or print certified Arduino Uno calibration standards with one click.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg text-xs transition-colors border border-neutral-700"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Share Image to Community</span>
            </button>

            <button
              onClick={() => setActiveSubTab('ai')}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create with AI</span>
            </button>
          </div>
        </div>

        {/* Sub-Tab Switcher & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-neutral-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeSubTab === 'all'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Artwork ({allItems.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeSubTab === 'ai'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Image Generator &amp; Editor</span>
            </button>

            <button
              onClick={() => setActiveSubTab('community')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeSubTab === 'community'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Community Uploads ({communityItems.length + customUploads.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('defaults')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeSubTab === 'defaults'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Default Classics ({defaultItems.length})</span>
            </button>
          </div>

          {activeSubTab !== 'ai' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search title, tag, or maker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-hidden focus:border-amber-500 w-48 sm:w-64"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-hidden focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* VIEW A: AI Image Generator & Editor */}
      {activeSubTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Generator Prompts & Controls (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-200">
                    Prompt-to-Plot: Generate or Edit with Gemini AI
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Gemini 3.1 Pro (Deep Thinking)
                  </span>
                </div>
              </div>

              {/* Quality Levels: Potato, Low, Medium, High */}
              <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-200">Quality Level:</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {qualityLevel === 'potato' && 'Fast Draft · Instant'}
                    {qualityLevel === 'low' && 'Quick Preview · Standard'}
                    {qualityLevel === 'medium' && 'Balanced Precision · Enhanced'}
                    {qualityLevel === 'high' && 'Extended Reasoning · Museum Masterpiece'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'potato', label: 'Potato', icon: '🥔', desc: 'Fast Draft' },
                    { id: 'low', label: 'Low', icon: '⚡', desc: 'Quick Test' },
                    { id: 'medium', label: 'Medium', icon: '⚖️', desc: 'Balanced' },
                    { id: 'high', label: 'High', icon: '💎', desc: 'Deep Think' },
                  ].map((q) => {
                    const active = qualityLevel === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setQualityLevel(q.id as any);
                          if (q.id === 'high') {
                            setSingleLineShrunk(false);
                          } else {
                            setSingleLineShrunk(true);
                          }
                        }}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-neutral-100 ring-1 ring-amber-400/50 shadow-xs'
                            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <span className="text-sm block">{q.icon}</span>
                        <span className={`block text-[11px] font-bold mt-0.5 ${active ? 'text-amber-300' : 'text-neutral-300'}`}>
                          {q.label}
                        </span>
                        <span className="block text-[9px] text-neutral-500 mt-0.5">{q.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Toggleable Single-Line Centerline & Shrunk Mode */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <div className="p-2.5 bg-neutral-900/90 border border-neutral-800 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">✂️</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-neutral-200">
                            Single-Line Centerline & Shrunk Mode
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Potato · Low · Medium
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug">
                          Thick areas collapse into a single center pen stroke and the image is shrunk for fast, clean plotting.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSingleLineShrunk((prev) => !prev)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        singleLineShrunk ? 'bg-amber-500' : 'bg-neutral-700'
                      }`}
                      title={singleLineShrunk ? 'Disable single-line & shrunk mode' : 'Enable single-line & shrunk mode'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          singleLineShrunk ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-neutral-500 leading-tight">
                  High quality uses Gemini 3.1 Pro with deep reasoning token budget. It may take longer, but produces exceptional line art and toolpaths.
                </p>
              </div>

              {/* Textarea Prompt */}
              <div>
                <label className="block text-[11px] text-neutral-300 font-medium mb-1.5">
                  Describe what you want to draw:
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="e.g. Leonardo Da Vinci mechanical clockwork escapement with gear teeth and balance wheel..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-hidden focus:border-amber-500 leading-relaxed resize-none"
                  />
                </div>
              </div>

              {/* Quick Inspiration Pills */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                  <span>Fast Suggestions:</span>
                  <button
                    onClick={() => {
                      const random = PROMPT_SUGGESTIONS[Math.floor(Math.random() * PROMPT_SUGGESTIONS.length)];
                      setPrompt(random);
                    }}
                    className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Randomize Prompt</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_SUGGESTIONS.slice(0, 4).map((sugg, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(sugg)}
                      className="px-2.5 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-md text-[11px] text-neutral-300 hover:text-neutral-100 transition-colors text-left truncate max-w-full"
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plotter Art Style Selector */}
              <div>
                <label className="block text-[11px] text-neutral-300 font-medium mb-1.5">
                  Pen Plotter Vector Style:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        selectedStyle === style.id
                          ? 'border-amber-400 bg-amber-500/10 text-neutral-100'
                          : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/50 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${selectedStyle === style.id ? 'text-amber-400' : 'text-neutral-200'}`}>
                          {style.name}
                        </span>
                        {selectedStyle === style.id && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-0.5">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio & Reference Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] text-neutral-300 font-medium mb-1.5">
                    Aspect Ratio:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['1:1', '4:3', '3:4', '16:9'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-1.5 rounded-lg font-mono text-center text-xs transition-colors border ${
                          aspectRatio === ratio
                            ? 'bg-amber-400 text-neutral-950 font-bold border-amber-400'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-300 font-medium mb-1.5">
                    Optional Reference Image (Edit Mode):
                  </label>
                  <input
                    ref={refImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          setReferenceImage(evt.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                  {referenceImage ? (
                    <div className="flex items-center justify-between p-2 bg-neutral-950 border border-neutral-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <img
                          src={referenceImage}
                          alt="Reference"
                          className="w-8 h-8 rounded object-cover border border-neutral-700"
                        />
                        <span className="text-[11px] text-neutral-300 truncate max-w-[120px]">Reference Attached</span>
                      </div>
                      <button
                        onClick={() => setReferenceImage(null)}
                        className="text-neutral-500 hover:text-rose-400 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => refImageInputRef.current?.click()}
                      className="w-full py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Reference Image</span>
                    </button>
                  )}
                </div>
              </div>

              {aiError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-amber-300 text-xs leading-snug">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              <button
                onClick={handleGenerateAI}
                disabled={isGenerating || !prompt.trim()}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
              >
                <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>
                  {isGenerating
                    ? qualityLevel === 'high'
                      ? 'Gemini 3.1 Pro is reasoning deeply & drawing vectors...'
                      : 'Synthesizing Plotter Artwork...'
                    : `Generate Plot-Ready Artwork (${qualityLevel.toUpperCase()} Quality)`}
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: AI Generation Preview & Instant Print Actions (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-200">AI Artwork Preview</h3>
                </div>
                {generatedResult && (
                  <span className="text-[11px] font-mono text-emerald-400">Ready to Plot</span>
                )}
              </div>

              {/* Preview Box */}
              <div className="relative aspect-square w-full bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden flex items-center justify-center p-3">
                {generatedResult ? (
                  <img
                    src={generatedResult.imageUrl}
                    alt="AI Generated Drawing"
                    className="w-full h-full object-contain bg-white rounded shadow-sm"
                  />
                ) : (
                  <div className="text-center p-6 text-neutral-500">
                    <Sparkles className="w-10 h-10 text-neutral-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium text-neutral-400">No Image Generated Yet</p>
                    <p className="text-[11px] text-neutral-600 mt-1 max-w-xs mx-auto">
                      Select a prompt suggestion or enter custom instructions on the left and click &ldquo;Generate Plot-Ready Image&rdquo;.
                    </p>
                  </div>
                )}
              </div>

              {generatedResult && (
                <div className="space-y-3">
                  <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-1">
                    <p className="text-neutral-300 font-medium text-xs truncate">
                      &ldquo;{generatedResult.prompt}&rdquo;
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                      <span>Style: {generatedResult.style}</span>
                      <span>·</span>
                      <span>{generatedResult.timestamp}</span>
                    </div>
                  </div>

                  {/* Primary 1-Click Print & Plot Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() =>
                        onSelectImageForPlot(
                          generatedResult.imageUrl,
                          `AI: ${generatedResult.prompt.slice(0, 30)}`,
                          true
                        )
                      }
                      className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Plot &amp; Print Now (Direct to Controller)</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          onOpenVectorizerWithImage(
                            generatedResult.imageUrl,
                            `AI: ${generatedResult.prompt.slice(0, 30)}`
                          )
                        }
                        className="py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 border border-neutral-700"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Tune Vectorizer</span>
                      </button>

                      <button
                        onClick={handleSaveToCommunity}
                        className="py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 border border-neutral-700"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Add to Community</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B & C: Gallery Cards Grid (All / Community / Defaults) */}
      {activeSubTab !== 'ai' && (
        <div className="space-y-4">
          {/* Active section header */}
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>
              Showing <strong>{filteredItems.length}</strong> items in{' '}
              <span className="text-neutral-200">
                {activeSubTab === 'all'
                  ? 'All Collections'
                  : activeSubTab === 'community'
                  ? 'Community Uploads'
                  : 'Default Classics'}
              </span>
            </span>

            {activeSubTab === 'community' && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Upload your image</span>
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center text-neutral-400">
              <Compass className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-neutral-200">No matching drawings found</p>
              <p className="text-xs text-neutral-500 mt-1">
                Try clearing your search query or switching categories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isLiked = likedItemIds.has(item.id);
                const isDefault = item.source === 'default';

                return (
                  <div
                    key={item.id}
                    className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                  >
                    {/* Visual Card Image Box */}
                    <div className="relative aspect-square w-full bg-neutral-950 p-4 flex items-center justify-center border-b border-neutral-800/80">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-contain bg-white rounded border border-neutral-800/50 p-1 group-hover:scale-102 transition-transform duration-200"
                      />

                      {/* Source & Complexity Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isDefault
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {isDefault ? 'Classics' : 'Community'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-900/80 backdrop-blur-xs text-neutral-300 border border-neutral-800">
                          {item.complexity}
                        </span>
                      </div>

                      {/* Like button */}
                      <button
                        onClick={() => toggleLike(item.id)}
                        className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-xs transition-colors ${
                          isLiked
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-neutral-900/70 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                        }`}
                        title="Like this artwork"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Content Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                          <span className="truncate">{item.category}</span>
                          <span className="font-mono text-neutral-500">~{item.estimatedLines || 250} lines</span>
                        </div>

                        <h4 className="text-xs font-bold text-neutral-100 line-clamp-1 group-hover:text-amber-400 transition-colors">
                          {item.title}
                        </h4>

                        <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono mt-2 truncate">
                          <span>By:</span>
                          <span className="text-neutral-300">{item.author}</span>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {item.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-neutral-950 text-neutral-400 border border-neutral-800 rounded text-[10px]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3.5 mt-3.5 border-t border-neutral-800/80 flex items-center gap-2">
                        <button
                          onClick={() => onSelectImageForPlot(item.imageUrl, item.title, true)}
                          className="flex-1 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                          title="Generate G-Code and send directly to CNC Controller"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Plot Now</span>
                        </button>

                        <button
                          onClick={() => onOpenVectorizerWithImage(item.imageUrl, item.title)}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs transition-colors border border-neutral-700"
                          title="Open in Image Vectorizer to adjust threshold & lines"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Share Image to Community Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-neutral-200">Share Image to Community Gallery</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Artwork Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Vintage Telescope Schematic"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Your Maker Name / Handle</label>
                <input
                  type="text"
                  placeholder="e.g. @astro_plotter"
                  value={uploadAuthor}
                  onChange={(e) => setUploadAuthor(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-hidden focus:border-amber-500"
                >
                  <option value="Engineering & Mechanics">Engineering &amp; Mechanics</option>
                  <option value="Sacred Geometry & Fractals">Sacred Geometry &amp; Fractals</option>
                  <option value="Nature & Wildlife">Nature &amp; Wildlife</option>
                  <option value="Minimalist Line Art">Minimalist Line Art</option>
                  <option value="Schematics & Patents">Schematics &amp; Patents</option>
                  <option value="Typography & Calligraphy">Typography &amp; Calligraphy</option>
                  <option value="Other / Abstract">Other / Abstract</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Telescope, Astronomy, Optics, LineArt"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Select Image File *</label>
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setUploadImageFile(evt.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                {uploadImageFile ? (
                  <div className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <img
                        src={uploadImageFile}
                        alt="Preview"
                        className="w-10 h-10 object-contain bg-white rounded border border-neutral-700"
                      />
                      <span className="text-xs text-emerald-400">✓ Image Ready</span>
                    </div>
                    <button
                      onClick={() => setUploadImageFile(null)}
                      className="text-neutral-500 hover:text-rose-400 text-xs"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => uploadFileInputRef.current?.click()}
                    className="w-full py-3 bg-neutral-950 hover:bg-neutral-800 border border-dashed border-neutral-700 rounded-lg text-neutral-400 hover:text-neutral-200 text-center transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Click to browse PNG, JPG, or SVG</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomUpload}
                disabled={!uploadTitle.trim() || !uploadImageFile}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-40"
              >
                Publish to Gallery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
