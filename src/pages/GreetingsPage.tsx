import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Download,
  Share2,
  Copy,
  Check,
  Camera,
  RefreshCw,
  Phone,
  ShieldCheck,
  Layers,
  Palette,
  Award,
  Building,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { profileRepository, type AgentProfile, DEFAULT_PROFILE } from '@/db/repositories/profileRepository';
import { FestivalArtworkImage, OrnateCorner, HangingFestoon } from './greetings/festivalArtwork';
import { drawFestiveCardToCanvas } from './greetings/canvasArtworkRenderer';

export interface FestivalTheme {
  id: string;
  name: string;
  hindiName: string;
  category: 'festival' | 'national' | 'personal';
  title: string;
  subtitle: string;
  hindiMessage: string;
  englishMessage: string;
  decorIcon: string;
  gradient: string;
  textColor: string;
  accentColor: string;
}

export const FESTIVAL_THEMES: FestivalTheme[] = [
  {
    id: 'diwali',
    name: 'Diwali',
    hindiName: 'शुभ दीपावली',
    category: 'festival',
    title: 'Happy Diwali',
    subtitle: 'दीपावली की हार्दिक शुभकामनाएं',
    hindiMessage: 'यह दीपोत्सव आपके और आपके परिवार के जीवन में सुख, शांति, समृद्धि और उत्तम स्वास्थ्य लेकर आए।',
    englishMessage: 'May the divine light of Diwali illuminate your life with peace, prosperity, and financial security.',
    decorIcon: '🪔',
    gradient: 'from-amber-600 via-rose-700 to-amber-900',
    textColor: 'text-amber-100',
    accentColor: '#f59e0b',
  },
  {
    id: 'new_year',
    name: 'New Year',
    hindiName: 'नव वर्ष 2027',
    category: 'festival',
    title: 'Happy New Year',
    subtitle: 'नव वर्ष की हार्दिक शुभकामनाएं',
    hindiMessage: 'आने वाला नया वर्ष आपके परिवार के लिए नई उमंग, अपार सफलता और सुरक्षित भविष्य लेकर आए।',
    englishMessage: 'Wishing you and your beloved family a joyful, healthy and prosperous New Year ahead!',
    decorIcon: '✨',
    gradient: 'from-indigo-900 via-blue-800 to-slate-900',
    textColor: 'text-blue-100',
    accentColor: '#38bdf8',
  },
  {
    id: 'holi',
    name: 'Holi',
    hindiName: 'होली की शुभकामनाएं',
    category: 'festival',
    title: 'Happy Holi',
    subtitle: 'रंगों के पावन पर्व की बधाई',
    hindiMessage: 'स्नेह, उल्लास और रंगों का यह पावन पर्व आपके जीवन को खुशियों के अनगिनत रंगों से भर दे।',
    englishMessage: 'May the vibrant colors of Holi bring immense joy, harmony, and prosperity to your home.',
    decorIcon: '🎨',
    gradient: 'from-rose-600 via-purple-700 to-amber-600',
    textColor: 'text-rose-100',
    accentColor: '#f43f5e',
  },
  {
    id: 'dussehra',
    name: 'Dussehra',
    hindiName: 'विजयदशमी / दशहरा',
    category: 'festival',
    title: 'Happy Dussehra',
    subtitle: 'बुराई पर अच्छाई की विजय',
    hindiMessage: 'अधर्म पर धर्म और असत्य पर सत्य की विजय के महापर्व विजयदशमी की हार्दिक शुभकामनाएं।',
    englishMessage: 'Celebrating the eternal triumph of good over evil. May Lord Rama bless you with success and courage.',
    decorIcon: '🏹',
    gradient: 'from-amber-700 via-orange-800 to-red-950',
    textColor: 'text-amber-100',
    accentColor: '#fb923c',
  },
  {
    id: 'ganesh_chaturthi',
    name: 'Ganesh Chaturthi',
    hindiName: 'गणेश चतुर्थी',
    category: 'festival',
    title: 'Happy Ganesh Chaturthi',
    subtitle: 'गणपति बाप्पा मोरया!',
    hindiMessage: 'विघ्नहर्ता भगवान श्री गणेश आपके जीवन के सभी संकटों को दूर कर सुख, समृद्धि एवं ऋद्धि-सिद्धि प्रदान करें।',
    englishMessage: 'May Lord Ganesha remove all obstacles and bless your family with boundless wealth and happiness.',
    decorIcon: '🌺',
    gradient: 'from-orange-600 via-red-700 to-amber-900',
    textColor: 'text-orange-100',
    accentColor: '#f97316',
  },
  {
    id: 'shivratri',
    name: 'Maha Shivratri',
    hindiName: 'महाशिवरात्रि',
    category: 'festival',
    title: 'Maha Shivratri',
    subtitle: 'हर हर महादेव!',
    hindiMessage: 'देवाधिदेव महादेव और मां पार्वती की असीम कृपा आप और आपके पूरे परिवार पर सदैव बनी रहे।',
    englishMessage: 'May the supreme grace of Lord Shiva illuminate your path with serenity, strength, and truth.',
    decorIcon: '🔱',
    gradient: 'from-slate-900 via-indigo-950 to-blue-900',
    textColor: 'text-blue-100',
    accentColor: '#60a5fa',
  },
  {
    id: 'raksha_bandhan',
    name: 'Raksha Bandhan',
    hindiName: 'रक्षाबंधन',
    category: 'festival',
    title: 'Happy Raksha Bandhan',
    subtitle: 'सुरक्षा और अटूट विश्वास का पावन पर्व',
    hindiMessage: 'भाई-बहन के पवित्र प्रेम और सुरक्षा के अटूट बंधन के पावन पर्व रक्षाबंधन की हार्दिक शुभकामनाएं।',
    englishMessage: 'Cherishing the sacred bond of eternal love and protection. Wishing you a wonderful Rakhi!',
    decorIcon: '🌸',
    gradient: 'from-pink-700 via-purple-800 to-rose-900',
    textColor: 'text-pink-100',
    accentColor: '#f472b6',
  },
  {
    id: 'eid',
    name: 'Eid Mubarak',
    hindiName: 'ईद मुबारक',
    category: 'festival',
    title: 'Eid Mubarak',
    subtitle: 'ईद की दिली मुबारकबाद',
    hindiMessage: 'अल्लाह ताला आपके जीवन में खुशियां, अमन, भाईचारा और बरकत अता फरमाए। ईद मुबारक!',
    englishMessage: 'May the divine blessings of Allah bring peace, harmony, and joy into your home and heart.',
    decorIcon: '🌙',
    gradient: 'from-emerald-800 via-teal-900 to-slate-900',
    textColor: 'text-emerald-100',
    accentColor: '#34d399',
  },
  {
    id: 'republic_day',
    name: 'Republic / Independence Day',
    hindiName: 'राष्ट्रीय पर्व (जय हिन्द)',
    category: 'national',
    title: 'Happy Republic / Independence Day',
    subtitle: 'भारत माता की जय • जय हिन्द',
    hindiMessage: 'देश की संप्रभुता, अखंडता और प्रगति के गौरवशाली राष्ट्रीय पर्व की सभी देशवासियों को बधाई।',
    englishMessage: 'Proud to be Indian! Saluting the spirit of unity, freedom, and strength of our great nation.',
    decorIcon: '🇮🇳',
    gradient: 'from-orange-700 via-slate-900 to-emerald-800',
    textColor: 'text-white',
    accentColor: '#f59e0b',
  },
  {
    id: 'makar_sankranti',
    name: 'Makar Sankranti & Lohri',
    hindiName: 'मकर संक्रांति एवं लोहड़ी',
    category: 'festival',
    title: 'Happy Makar Sankranti',
    subtitle: 'उमंग, उत्साह एवं नई फसल का पर्व',
    hindiMessage: 'सूर्य देव की कृपा से आपके जीवन में तेज, स्वास्थ्य और समृद्धि का नव संचार हो।',
    englishMessage: 'May the harvest festival bring warmth, sweet moments, and rising prosperity like flying kites!',
    decorIcon: '🪁',
    gradient: 'from-amber-600 via-yellow-700 to-orange-800',
    textColor: 'text-yellow-100',
    accentColor: '#facc15',
  },
  {
    id: 'birthday',
    name: 'Client Birthday Wishes',
    hindiName: 'जन्मदिन की बधाई',
    category: 'personal',
    title: 'Happy Birthday!',
    subtitle: 'जन्मदिन की हार्दिक शुभकामनाएं',
    hindiMessage: 'ईश्वर आपको दीर्घायु, उत्तम स्वास्थ्य और जीवन की हर खुशी प्रदान करें। आपका हर सपना साकार हो।',
    englishMessage: 'Wishing you a very Happy Birthday filled with good health, immense happiness, and lasting success!',
    decorIcon: '🎂',
    gradient: 'from-blue-700 via-indigo-800 to-purple-900',
    textColor: 'text-blue-100',
    accentColor: '#38bdf8',
  },
  {
    id: 'lic_trust',
    name: 'LIC Trust & Protection',
    hindiName: 'सुरक्षा और बचत का भरोसा',
    category: 'personal',
    title: 'Family Financial Security',
    subtitle: 'योगक्षेमं वहाम्यहम् • LIC of India',
    hindiMessage: 'आपके और आपके परिवार के भविष्य को आर्थिक रूप से सुरक्षित रखना ही हमारा मुख्य संकल्प है।',
    englishMessage: 'Ensuring your loved ones smile with total peace of mind. Your trusted partner for life.',
    decorIcon: '🛡️',
    gradient: 'from-slate-950 via-blue-950 to-slate-900',
    textColor: 'text-amber-200',
    accentColor: '#fbbf24',
  },
];

export function GreetingsPage() {
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('diwali');
  const [cardFormat, setCardFormat] = useState<'square' | 'portrait'>('square');
  const [customHindi, setCustomHindi] = useState('');
  const [customEnglish, setCustomEnglish] = useState('');
  const [agentPhoto, setAgentPhoto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load agent profile on mount
  useEffect(() => {
    profileRepository.getProfile().then((p) => {
      setProfile(p);
      if (p.avatarUrl) {
        setAgentPhoto(p.avatarUrl);
      }
    });
  }, []);

  const activeTheme = FESTIVAL_THEMES.find((t) => t.id === selectedThemeId) || FESTIVAL_THEMES[0];

  useEffect(() => {
    setCustomHindi(activeTheme.hindiMessage);
    setCustomEnglish(activeTheme.englishMessage);
  }, [selectedThemeId]);

  // Generate High-Resolution Complete Poster Data URL
  const generateCardDataUrl = async (format: 'square' | 'portrait'): Promise<string> => {
    const width = 1080;
    const height = format === 'square' ? 1080 : 1920;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Draw rich festive background, golden borders, garland, and hero artwork picture in Canvas
    drawFestiveCardToCanvas(ctx, width, height, activeTheme.id, activeTheme.accentColor, format);

    // 2. Main Festive Titles with shadow
    const titleY = format === 'portrait' ? 440 : 330;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 54px "Segoe UI", Roboto, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(activeTheme.title, width / 2, titleY);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(activeTheme.subtitle, width / 2, titleY + 55);
    ctx.shadowBlur = 0;

    // Decorative golden divider line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 180, titleY + 95);
    ctx.lineTo(width / 2 + 180, titleY + 95);
    ctx.stroke();

    // 3. Festive Messages (Hindi & English)
    ctx.fillStyle = '#f8fafc';
    ctx.font = '30px "Segoe UI", Roboto, sans-serif';
    wrapText(ctx, customHindi, width / 2, titleY + 160, width - 160, 44);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 24px "Segoe UI", Roboto, sans-serif';
    wrapText(ctx, customEnglish, width / 2, titleY + 270, width - 180, 36);

    // 4. Draw Agent Branding Footer Section
    const footerHeight = format === 'portrait' ? 360 : 280;
    const footerY = height - footerHeight;

    // Dark glass container for agent details
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(0, footerY, width, footerHeight);

    // Golden top border for footer
    ctx.fillStyle = activeTheme.accentColor;
    ctx.fillRect(0, footerY, width, 6);

    // Load agent photo image if available
    const avatarSize = 130;
    const avatarX = 90;
    const avatarY = footerY + (footerHeight - avatarSize) / 2;

    if (agentPhoto) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = agentPhoto;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // Border around photo
        ctx.strokeStyle = activeTheme.accentColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } catch {
        drawDefaultAvatar(ctx, avatarX, avatarY, avatarSize, profile.fullName);
      }
    } else {
      drawDefaultAvatar(ctx, avatarX, avatarY, avatarSize, profile.fullName);
    }

    // Agent Text Info
    const textX = avatarX + avatarSize + 35;
    ctx.textAlign = 'left';

    // Agent Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(profile.fullName || 'LIC Financial Advisor', textX, footerY + 70);

    // Club & Designation
    ctx.fillStyle = '#fbbf24';
    ctx.font = '600 22px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(profile.clubMembership || "Chairman's Club Member", textX, footerY + 110);

    // Agency Code & Branch
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Segoe UI", Roboto, sans-serif';
    const agencyText = `Agency Code: ${profile.agencyCode || '08345678'}  •  ${profile.branchName || 'Main Branch'}`;
    ctx.fillText(agencyText, textX, footerY + 145);

    // Mobile Number / WhatsApp
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 22px "Segoe UI", Roboto, sans-serif';
    const contactText = `📞 / WhatsApp: ${profile.mobileNumber || profile.whatsappNumber || '9876543210'}`;
    ctx.fillText(contactText, textX, footerY + 180);

    // Official LIC Motto Badge
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('भारतीय जीवन बीमा निगम  •  Life Insurance Corporation of India  •  योगक्षेमं वहाम्यहम्', textX, footerY + 220);

    return canvas.toDataURL('image/png');
  };

  // Re-generate complete preview image whenever poster details change
  useEffect(() => {
    let isCancelled = false;
    generateCardDataUrl(cardFormat).then((url) => {
      if (!isCancelled && url) {
        setPreviewImageUrl(url);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [
    selectedThemeId,
    cardFormat,
    customHindi,
    customEnglish,
    profile.fullName,
    profile.agencyCode,
    profile.mobileNumber,
    profile.clubMembership,
    profile.branchName,
    agentPhoto,
  ]);

  // Handle agent photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAgentPhoto(result);
      // Persist to profile
      profileRepository.saveProfile({ ...profile, avatarUrl: result });
    };
    reader.readAsDataURL(file);
  };

  // Render to Canvas and Download High-Resolution Image
  const handleDownloadImage = async () => {
    setIsGenerating(true);
    try {
      const dataUrl = previewImageUrl || (await generateCardDataUrl(cardFormat));
      if (!dataUrl) return;

      // Export file
      const link = document.createElement('a');
      link.download = `LIC_Greeting_${activeTheme.id}_${(profile.fullName || 'Advisor').replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate greeting card', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper function to draw initials avatar
  function drawDefaultAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, name: string) {
    ctx.save();
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    const inits = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'AG';
    ctx.fillText(inits, x + size / 2, y + size / 2 + 18);
    ctx.restore();
  }

  // Helper function for multiline text wrapping on canvas
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }

  // Quick WhatsApp Share with greeting text
  const handleShareToWhatsApp = () => {
    const text = `*${activeTheme.title} - ${activeTheme.subtitle}* 🪔\n\n${customHindi}\n\n${customEnglish}\n\n━━━━━━━━━━━━━━━━━━━\n*${profile.fullName}*\n${profile.clubMembership}\nLIC Agency Code: ${profile.agencyCode}\nBranch: ${profile.branchName}\nMobile: ${profile.mobileNumber}\n*Life Insurance Corporation of India*\n_योगक्षेमं वहाम्यहम्_`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    const text = `${activeTheme.title} - ${activeTheme.subtitle}\n\n${customHindi}\n\n${customEnglish}\n\nWarm regards,\n${profile.fullName}\nLIC Financial Advisor\n${profile.mobileNumber}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="flex-1 p-3.5 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-1 border border-amber-500/20">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Festival & Status Cards Studio</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Festival Greeting Cards</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create personalized festival wishes with your photo, name, and contact details to share with clients or post as WhatsApp Status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copied ? 'Copied' : 'Copy Text'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadImage}
            isLoading={isGenerating}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Download Card (PNG)
          </Button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Festival Picker & Customization Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Format Selector (Square vs Status) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Card Dimensions / Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCardFormat('square')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  cardFormat === 'square'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="w-4 h-4 border-2 border-current rounded-xs" />
                <span>Square (1:1) WhatsApp Post</span>
              </button>

              <button
                type="button"
                onClick={() => setCardFormat('portrait')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  cardFormat === 'portrait'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="w-3 h-5 border-2 border-current rounded-xs" />
                <span>Status (9:16) Story</span>
              </button>
            </div>
          </div>

          {/* Festival Theme Selector */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Festival / Occasion ({FESTIVAL_THEMES.length})
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
              {FESTIVAL_THEMES.map((theme) => {
                const isSelected = theme.id === selectedThemeId;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-1 ring-amber-500 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl">{theme.decorIcon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                        {theme.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {theme.hindiName}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agent Photo & Profile Details for Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Agent Details on Card
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{agentPhoto ? 'Change Photo' : 'Upload Photo'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-lg flex items-center justify-center shrink-0 shadow-xs cursor-pointer border-2 border-white/20 overflow-hidden group relative"
                title="Click to upload agent photo"
              >
                {agentPhoto ? (
                  <img src={agentPhoto} alt="Agent" className="w-full h-full object-cover" />
                ) : (
                  profile.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'AG'
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  placeholder="Agent Name"
                  className="w-full text-xs font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={profile.agencyCode}
                    onChange={(e) => setProfile({ ...profile, agencyCode: e.target.value })}
                    placeholder="Agency Code"
                    className="w-full text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={profile.mobileNumber}
                    onChange={(e) => setProfile({ ...profile, mobileNumber: e.target.value })}
                    placeholder="Mobile / Phone"
                    className="w-full text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Editable Custom Wishes Message */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                  Greeting Message (Hindi)
                </label>
                <textarea
                  rows={2}
                  value={customHindi}
                  onChange={(e) => setCustomHindi(e.target.value)}
                  className="w-full text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                  Greeting Message (English)
                </label>
                <textarea
                  rows={2}
                  value={customEnglish}
                  onChange={(e) => setCustomEnglish(e.target.value)}
                  className="w-full text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Card Preview & Direct Share Actions (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
              <span>Card Live Preview ({cardFormat === 'square' ? '1:1 Square' : '9:16 Status'})</span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                Ready for WhatsApp Status
              </span>
            </div>

            {/* The Complete Greeting Card Live Image Preview */}
            <div className="w-full rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-400/60 bg-slate-950 relative flex items-center justify-center min-h-[320px]">
              {previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt={`${activeTheme.title} Greeting Card`}
                  className="w-full h-auto block select-none drop-shadow-md"
                />
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2.5">
                  <div className="w-7 h-7 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="font-semibold text-slate-300">Generating complete festival poster...</span>
                </div>
              )}
            </div>

            {/* Live Agent Credentials Badge Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1 shadow-xs">
              <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>{profile.fullName || 'LIC Financial Advisor'}</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{profile.clubMembership || "Chairman's Club Member"}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-1">
                <span>Code: {profile.agencyCode || '08345678'} • {profile.branchName || 'Main Branch'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">📞 {profile.mobileNumber || '9876543210'}</span>
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadImage}
                isLoading={isGenerating}
                leftIcon={<Download className="w-4 h-4" />}
                className="w-full"
              >
                Download (PNG)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShareToWhatsApp}
                leftIcon={<Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                className="w-full text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
              >
                WhatsApp Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GreetingsPage;
