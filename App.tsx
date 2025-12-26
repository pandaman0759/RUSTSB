import React, { useState } from 'react';
import { analyzeUrl } from './services/geminiService';
import { PosterData, AnalysisState } from './types';
import Poster from './components/Poster';
import { Sparkles, ArrowRight, Link as LinkIcon, AlertCircle, Loader2, Download, Copy, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [isCopying, setIsCopying] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setState({ isLoading: true, error: null, data: null });

    try {
      const data = await analyzeUrl(url);
      setState({ isLoading: false, error: null, data });
    } catch (err: any) {
      setState({ 
        isLoading: false, 
        error: err.message || '发生了一些错误，请检查 URL 并重试。', 
        data: null 
      });
    }
  };

  const handleDownload = async () => {
    const element = document.getElementById('poster-preview');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        scale: 2, 
        backgroundColor: '#0f172a',
        logging: false,
        scrollY: -window.scrollY, // Fix for partial rendering
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `rustsb-poster-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed', error);
      alert('下载失败。如果图片未显示，可能是因为该网站图片禁止了跨域下载。');
    }
  };

  const handleCopy = async () => {
    const element = document.getElementById('poster-preview');
    if (!element || !state.data) return;

    setIsCopying(true);
    try {
        const canvas = await html2canvas(element, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#0f172a',
            logging: false,
            scrollY: -window.scrollY, // Fix for partial rendering
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                throw new Error("Canvas blob creation failed");
            }

            // Construct text format: 【新品 - 【XMServerUpdateLog·服务器更新日志】 - Rust插件】\nURL
            const tag = state.data?.tag || 'Rust插件';
            const name = state.data?.name || '未命名插件';
            const textContent = `【${tag} - 【${name}】 - Rust插件】\n${url}`;

            try {
                // Try writing both text and image to clipboard
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': new Blob([textContent], { type: 'text/plain' }),
                        'image/png': blob
                    })
                ]);
                alert("已复制海报和文本！\n(提示：某些应用可能只支持粘贴图片)");
            } catch (err) {
                console.error("Clipboard write failed, trying text only fallback", err);
                try {
                     await navigator.clipboard.writeText(textContent);
                     alert("复制图片失败，已复制文本内容。");
                } catch (e2) {
                    alert("复制失败，请尝试使用 Chrome 浏览器。");
                }
            }
            setIsCopying(false);
        }, 'image/png');

    } catch (error) {
        console.error('Copy failed', error);
        setIsCopying(false);
        alert('生成复制内容失败。');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      
      {/* Left Panel: Input & Controls */}
      <div className="w-full md:w-1/2 lg:w-5/12 p-6 md:p-12 flex flex-col justify-center bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 z-10 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-slate-700/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-lg mx-auto w-full">
            <header className="mb-10">
                <div className="flex items-center gap-3 text-orange-500 mb-2">
                    <Sparkles className="w-6 h-6" />
                    <span className="font-gaming font-bold tracking-widest text-sm uppercase">RUSTSB海报生成器</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                    将您的 <span className="text-orange-500">Rust 插件</span> 生成为营销海报
                </h1>
                <p className="text-slate-400 text-lg">
                    粘贴任何 Rust 插件资源页面的链接（如 RustSB, Lone Design）。我们的 AI 将分析内容，提取关键特性，并生成专业的分享海报。
                </p>
            </header>

            <form onSubmit={handleAnalyze} className="space-y-4">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <LinkIcon className="h-5 w-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <input
                        type="url"
                        placeholder="https://rustsb.com/resources/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-lg"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={state.isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-orange-900/50 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {state.isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            正在分析网站...
                        </>
                    ) : (
                        <>
                            生成海报
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            {state.error && (
                <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-start gap-3 text-red-200 animate-in fade-in slide-in-from-bottom-2">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="text-sm">{state.error}</p>
                </div>
            )}
            
            {/* Examples */}
            {!state.data && !state.isLoading && (
                <div className="mt-10 pt-8 border-t border-slate-800">
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-3">尝试以下示例：</p>
                    <div className="flex flex-wrap gap-2">
                         <button 
                            onClick={() => setUrl('https://rustsb.com/resources/926/')}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors border border-slate-700"
                        >
                            RustSB 示例
                        </button>
                         <button 
                            onClick={() => setUrl('https://umod.org/plugins/gather-manager')}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors border border-slate-700"
                        >
                            uMod 示例
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div className="w-full md:w-1/2 lg:w-7/12 bg-slate-950 p-6 md:p-12 overflow-y-auto flex flex-col items-center justify-center min-h-[500px]">
        
        {state.isLoading && (
            <div className="text-center space-y-4 animate-pulse">
                <div className="w-64 h-[400px] bg-slate-800 rounded-lg mx-auto"></div>
                <p className="text-slate-400 text-sm font-gaming">AI 正在构建您的海报...</p>
            </div>
        )}

        {!state.isLoading && !state.data && (
            <div className="text-center text-slate-600 max-w-sm">
                <div className="w-24 h-32 border-2 border-dashed border-slate-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                    <span className="text-4xl opacity-20">?</span>
                </div>
                <p className="font-light">海报预览将显示在这里</p>
            </div>
        )}

        {state.data && (
            <div className="animate-in zoom-in-95 duration-500 w-full flex flex-col items-center">
                <div className="mb-6 flex gap-3 flex-wrap justify-center">
                    <button 
                        onClick={handleCopy}
                        disabled={isCopying}
                        className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-6 py-2 rounded-md transition-all shadow-lg transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isCopying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                        复制海报 & 文本
                    </button>
                    <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-md transition-colors text-sm font-medium border border-slate-700"
                    >
                        <Download className="w-4 h-4" />
                        下载 (PNG)
                    </button>
                </div>
                
                {/* Poster Component */}
                <div className="shadow-2xl shadow-black">
                    <Poster data={state.data} url={url} />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;