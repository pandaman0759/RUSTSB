import React, { useMemo } from 'react';
import { PosterData } from '../types';

interface PosterProps {
  data: PosterData;
  url: string;
}

const Poster: React.FC<PosterProps> = ({ data, url }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=1e293b&color=ce422b&margin=10`;

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://www.transparenttextures.com/patterns/diagmonds-light.png'; 
    e.currentTarget.style.backgroundColor = '#334155';
    e.currentTarget.style.objectFit = 'contain';
    e.currentTarget.onerror = null;
  };

  const getImageSource = (index: number) => {
    let rawUrl = '';
    if (data.imageUrls && data.imageUrls[index]) {
      rawUrl = data.imageUrls[index];
    } else {
      return 'https://via.placeholder.com/800x450/1e293b/94a3b8?text=No+Image';
    }

    // Remove protocol
    const cleanUrl = rawUrl.replace(/^https?:\/\//, '');
    
    // Use weserv proxy. 
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&q=90`;
  };

  // Logic to parse the name into English (Sub) and Chinese (Main) parts
  const { engName, cnName } = useMemo(() => {
    const raw = data.name.trim();
    
    // Strategy 1: 【English·Chinese】
    // Capture content inside 【】 separated by ·
    const matchBracket = raw.match(/^【(.+?)·(.+?)】$/);
    if (matchBracket) {
      return { engName: matchBracket[1].trim(), cnName: matchBracket[2].trim() };
    }

    // Strategy 2: English - Chinese
    // Split by " - " (space hyphen space)
    if (raw.includes(' - ')) {
      const parts = raw.split(' - ');
      // Assume first part is English/Code, rest is Chinese/Description
      const first = parts[0].trim();
      const rest = parts.slice(1).join(' - ').trim();
      return { engName: first, cnName: rest };
    }

    // Strategy 3: Check for pure English vs Mixed, or just return as is
    // If no specific pattern found, return everything as Main
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
      <div className="relative bg-gradient-to-b from-orange-900 to-slate-900 p-6 pb-32 border-b-4 border-orange-600 clip-path-slant">
        {/* Tag Badge */}
        <div className="absolute top-0 right-0">
           <div className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg shadow-md uppercase tracking-wider">
             {data.tag}
           </div>
        </div>

        <div className="relative z-10 text-center">
          {/* Split Title Display */}
          <h1 className="font-gaming font-extrabold uppercase tracking-wider drop-shadow-lg leading-tight break-words">
            {engName && (
                <span className="block text-2xl md:text-3xl text-orange-300/90 mb-2 font-semibold">
                    {engName}
                </span>
            )}
            <span className="block text-4xl md:text-5xl text-orange-500">
                {cnName}
            </span>
          </h1>

          <p className="mt-4 text-slate-300 text-lg font-light italic leading-relaxed">
            {data.shortDescription}
          </p>
          
          {/* Price Tag positioned lower to clear the description area */}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-8 py-3 skew-x-[-12deg] border-4 border-slate-900 shadow-2xl z-20 whitespace-nowrap">
            <span className="block skew-x-[12deg] font-bold text-2xl font-gaming">{data.price}</span>
          </div>
        </div>
      </div>

      {/* Images Section */}
      <div className="flex-1 p-6 pt-16 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4">
            {/* Main Feature Image */}
            <div className="relative group overflow-hidden border-2 border-slate-700 rounded-sm bg-slate-800 min-h-[12rem]">
                <img 
                    src={getImageSource(0)} 
                    crossOrigin="anonymous" 
                    onError={handleImageError}
                    alt="插件截图 1" 
                    className="w-full h-auto min-h-[12rem] object-cover group-hover:scale-105 transition-transform duration-500"
                />
                 <div className="absolute bottom-0 left-0 bg-black/70 px-2 py-1 text-xs text-orange-400 font-gaming uppercase">插件预览</div>
            </div>

            {/* Secondary Images Row */}
            {data.imageUrls && data.imageUrls.length > 1 && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative overflow-hidden border-2 border-slate-700 rounded-sm bg-slate-800 min-h-[8rem]">
                        <img 
                            src={getImageSource(1)} 
                            crossOrigin="anonymous" 
                            onError={handleImageError}
                            alt="插件截图 2" 
                            className="w-full h-32 object-cover"
                        />
                    </div>
                    {data.imageUrls.length > 2 && (
                        <div className="relative overflow-hidden border-2 border-slate-700 rounded-sm bg-slate-800 min-h-[8rem]">
                            <img 
                                src={getImageSource(2)} 
                                crossOrigin="anonymous" 
                                onError={handleImageError}
                                alt="插件截图 3" 
                                className="w-full h-32 object-cover"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>

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
      <div className="bg-slate-950 p-6 border-t border-slate-800 flex items-center justify-between gap-4">
        <div className="flex-1">
            <div className="text-orange-600 font-gaming font-bold text-lg uppercase">立即获取</div>
            <div className="text-slate-500 text-xs mt-1 truncate max-w-[150px]">{url}</div>
            <div className="text-slate-600 text-[10px] mt-2 uppercase tracking-widest">扫码直达</div>
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