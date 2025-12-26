import React, { useMemo, useState, useEffect, useRef } from 'react';
import { PosterData } from '../types';
import { Upload, Image as ImageIcon, X, Monitor, Smartphone, Square, Layout } from 'lucide-react';

interface PosterProps {
  data: PosterData;
  url: string;
}

type AspectRatio = 'auto' | '16/9' | '9/16' | '1/1';

const Poster: React.FC<PosterProps> = ({ data, url }) => {
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync props to local state when data changes
  useEffect(() => {
    if (data.imageUrls && data.imageUrls.length > 0) {
      setLocalImages(data.imageUrls);
    } else {
      setLocalImages([]);
    }
  }, [data]);

  // Global Paste Listener for Ctrl+V
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
        // Check if we are focusing on an input (like the URL input), if so, ignore to allow pasting text
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
            return;
        }

        if (e.clipboardData && e.clipboardData.items) {
            const items = Array.from(e.clipboardData.items);
            const newImages: string[] = [];
            let foundImage = false;

            items.forEach(item => {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        newImages.push(URL.createObjectURL(blob));
                        foundImage = true;
                    }
                }
            });

            if (foundImage) {
                setLocalImages(prev => {
                     // Append new images, keep max 3
                     const combined = [...prev, ...newImages];
                     return combined.slice(0, 3);
                });
                e.preventDefault(); // Prevent default paste behavior if it was an image
            }
        }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => {
        document.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=1e293b&color=ce422b&margin=10`;

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://www.transparenttextures.com/patterns/diagmonds-light.png'; 
    e.currentTarget.style.backgroundColor = '#334155';
    e.currentTarget.style.objectFit = 'contain';
    e.currentTarget.onerror = null;
  };

  const getImageSource = (src: string) => {
    if (src.startsWith('blob:') || src.startsWith('data:')) {
        return src;
    }
    // Remove protocol for Weserv
    const cleanUrl = src.replace(/^https?:\/\//, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&q=90`;
  };

  // --- Image Interaction Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files).map(file => URL.createObjectURL(file as Blob));
      setLocalImages(prev => {
          const combined = [...prev, ...newImages];
          return combined.slice(0, 3);
      });
    }
  };

  const handlePasteClick = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      const newImages: string[] = [];
      
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          newImages.push(URL.createObjectURL(blob as Blob));
        }
      }

      if (newImages.length > 0) {
        setLocalImages(prev => [...prev, ...newImages].slice(0, 3));
      } else {
        alert("剪贴板中没有图片！");
      }
    } catch (err) {
      console.error("Paste failed", err);
      alert("无法访问剪贴板，请尝试 Ctrl+V 直接粘贴。");
    }
  };

  const clearImages = () => {
    setLocalImages([]);
  };

  const cycleAspectRatio = () => {
    const ratios: AspectRatio[] = ['auto', '16/9', '9/16', '1/1'];
    const nextIndex = (ratios.indexOf(aspectRatio) + 1) % ratios.length;
    setAspectRatio(ratios[nextIndex]);
  };

  const getAspectRatioStyle = (isMain: boolean) => {
    const baseClasses = "relative group overflow-hidden border-2 border-slate-700 rounded-sm bg-slate-800";
    
    // Auto sizing logic (fallback to min-height)
    if (aspectRatio === 'auto') {
        return `${baseClasses} ${isMain ? 'min-h-[12rem]' : 'min-h-[8rem]'}`;
    }

    // Fixed aspect ratios
    switch(aspectRatio) {
        case '16/9': return `${baseClasses} aspect-video`;
        case '9/16': return `${baseClasses} aspect-[9/16]`;
        case '1/1': return `${baseClasses} aspect-square`;
        default: return baseClasses;
    }
  };

  const getAspectRatioIcon = () => {
    switch(aspectRatio) {
        case '16/9': return <Monitor className="w-4 h-4" />;
        case '9/16': return <Smartphone className="w-4 h-4" />;
        case '1/1': return <Square className="w-4 h-4" />;
        default: return <Layout className="w-4 h-4" />;
    }
  };

  const getAspectRatioLabel = () => {
      switch(aspectRatio) {
          case '16/9': return '16:9';
          case '9/16': return '9:16';
          case '1/1': return '1:1';
          default: return '自动';
      }
  };

  // --- Text Parsing ---
  const { engName, cnName } = useMemo(() => {
    const raw = data.name.trim();
    const matchDot = raw.match(/(?:【)?\s*(.+?)\s*·\s*(.+?)\s*(?:】)?$/);
    if (matchDot) return { engName: matchDot[1].trim(), cnName: matchDot[2].trim() };
    if (raw.includes(' - ')) {
      const parts = raw.split(' - ');
      return { engName: parts[0].trim(), cnName: parts.slice(1).join(' - ').trim() };
    }
    const matchHyphen = raw.match(/^([a-zA-Z0-9\s]+)\s*-\s*(.+)$/);
    if (matchHyphen) return { engName: matchHyphen[1].trim(), cnName: matchHyphen[2].trim() };
    return { engName: '', cnName: raw };
  }, [data.name]);

  return (
    <div 
      id="poster-preview"
      className="w-full max-w-md mx-auto bg-slate-900 text-white overflow-hidden shadow-2xl relative border-4 border-slate-800 flex flex-col"
      style={{ minHeight: '800px' }}
    >
      {/* Texture Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ 
             backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")',
             backgroundSize: '10px 10px'
           }}>
      </div>

      {/* Header Section */}
      {/* Reduced pb from 5 to 4 */}
      <div className="relative bg-gradient-to-b from-orange-900 to-slate-900 p-6 pb-4 border-b-4 border-orange-600 clip-path-slant">
        {/* Tag Badge */}
        <div className="absolute top-0 right-0">
           <div className="bg-orange-600 text-white text-xs font-bold px-3 h-7 flex items-center justify-center rounded-bl-lg shadow-md uppercase tracking-wider leading-none">
             {/* pb-2 + block to ensure lift */}
             <span className="block pb-2">{data.tag}</span>
           </div>
        </div>

        <div className="relative z-10 text-center">
          <h1 className="font-gaming font-extrabold tracking-wider drop-shadow-lg leading-tight break-words">
            {engName ? (
                <>
                    <span className="block text-2xl md:text-3xl text-orange-300/90 mb-1 font-semibold">
                        {engName}
                    </span>
                    <span className="block text-4xl md:text-5xl text-orange-500 uppercase">
                        {cnName}
                    </span>
                </>
            ) : (
                <span className="block text-4xl md:text-5xl text-orange-500 uppercase">
                    {cnName}
                </span>
            )}
          </h1>

          <p className="mt-3 mb-2 text-slate-300 text-lg font-light italic leading-relaxed">
            {data.shortDescription}
          </p>
        </div>
      </div>

      {/* Images Section */}
      {/* Reduced pt from 5 to 4 */}
      <div className="flex-1 p-6 pt-4 flex flex-col gap-4 relative group/images">
        
        {/* Image Controls */}
        <div className={`absolute top-2 right-6 z-30 flex gap-2 ${localImages.length === 0 ? 'opacity-100' : 'opacity-0 group-hover/images:opacity-100'} transition-opacity`}>
             {/* Aspect Ratio Toggle */}
             {localImages.length > 0 && (
                <button 
                    onClick={cycleAspectRatio}
                    className="bg-slate-800/80 hover:bg-blue-600 text-white px-2 py-1.5 rounded-full backdrop-blur-sm border border-slate-600 transition-colors flex items-center gap-1 text-xs font-mono"
                    title={`当前比例: ${getAspectRatioLabel()} (点击切换)`}
                >
                    {getAspectRatioIcon()}
                    <span className="hidden sm:inline">{getAspectRatioLabel()}</span>
                </button>
            )}

            {localImages.length > 0 && (
                <button 
                    onClick={clearImages}
                    className="bg-slate-800/80 hover:bg-red-600 text-white p-1.5 rounded-full backdrop-blur-sm border border-slate-600 transition-colors"
                    title="清除所有图片"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-800/80 hover:bg-orange-600 text-white p-1.5 rounded-full backdrop-blur-sm border border-slate-600 transition-colors"
                title="上传新图片"
            >
                <Upload className="w-4 h-4" />
            </button>
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="image/*" 
            className="hidden" 
        />

        {localImages.length === 0 ? (
            // Empty State / Upload Area
            <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 bg-slate-800/50 rounded-lg h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 hover:border-orange-500 transition-all group"
            >
                <ImageIcon className="w-10 h-10 text-slate-500 group-hover:text-orange-500 mb-2 transition-colors" />
                <p className="text-slate-400 text-sm font-medium">点击上传图片 (支持多张)</p>
                <p className="text-slate-500 text-xs mt-1">或使用 Ctrl+V 粘贴</p>
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePasteClick(); }}
                    className="mt-3 bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1 rounded-full text-slate-300 transition-colors"
                >
                    读取剪贴板
                </button>
            </div>
        ) : (
            // Image Grid
            <div className="grid grid-cols-1 gap-4">
                {/* Main Feature Image */}
                <div className={getAspectRatioStyle(true)}>
                    <img 
                        src={getImageSource(localImages[0])} 
                        crossOrigin="anonymous" 
                        onError={handleImageError}
                        alt="主预览图" 
                        className="w-full h-full object-cover"
                    />
                    {/* Preview Tag */}
                    <div className="absolute bottom-0 left-0 bg-black/70 px-3 h-7 flex items-center justify-center text-xs text-orange-400 font-gaming uppercase leading-none">
                        <span className="block pb-2">插件预览</span>
                    </div>
                </div>

                {/* Secondary Images Row */}
                {localImages.length > 1 && (
                    <div className={`grid ${localImages.length === 2 ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                        <div className={getAspectRatioStyle(false)}>
                            <img 
                                src={getImageSource(localImages[1])} 
                                crossOrigin="anonymous" 
                                onError={handleImageError}
                                alt="预览图 2" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {localImages.length > 2 && (
                            <div className={getAspectRatioStyle(false)}>
                                <img 
                                    src={getImageSource(localImages[2])} 
                                    crossOrigin="anonymous" 
                                    onError={handleImageError}
                                    alt="预览图 3" 
                                    className="w-full h-full object-cover"
                            />
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* Info Section */}
        <div className="mt-4 bg-slate-800/50 p-5 border-l-4 border-orange-500 rounded-r-lg">
            <h3 className="font-gaming text-orange-400 text-xl mb-2 uppercase tracking-wide">插件简介</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
                {data.summary}
            </p>
            
            <h4 className="font-gaming text-slate-400 text-sm uppercase mb-2">核心功能:</h4>
            <ul className="text-sm text-slate-300 space-y-1">
                {data.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                        <span className="text-orange-500 mr-2">►</span>
                        {feature}
                    </li>
                ))}
            </ul>
        </div>
      </div>

      {/* Footer / QR Section */}
      <div className="bg-slate-950 px-6 pt-5 pb-10 border-t border-slate-800 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-3 mb-1">
                <div className="text-orange-600 font-gaming font-bold text-lg uppercase">立即获取</div>
                
                {/* Price Tag: Adjusted with pb-2.5 and relative -top-0.5 to fix downward shift */}
                <div className="bg-orange-600 text-white px-4 h-8 flex items-center justify-center skew-x-[-12deg] shadow-lg border border-orange-400">
                    <span className="block skew-x-[12deg] font-bold text-lg font-gaming leading-none pb-2.5 relative -top-0.5">{data.price}</span>
                </div>
            </div>

            <div className="text-slate-500 text-xs mt-1 truncate w-full leading-relaxed pb-1 font-mono">
                {url}
            </div>
            <div className="text-slate-600 text-[10px] mt-1 uppercase tracking-widest">扫码直达</div>
        </div>
        <div className="bg-white p-2 rounded-sm shadow-inner shrink-0">
             <img 
                src={qrUrl} 
                alt="QR Code" 
                crossOrigin="anonymous"
                className="w-24 h-24"
             />
        </div>
      </div>
    </div>
  );
};

export default Poster;