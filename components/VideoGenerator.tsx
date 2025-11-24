

import React, { useState } from 'react';
import { PlotPoint, StoryAsset, Language } from '../types';
import { generateVeoVideo } from '../services/geminiService';
import { t } from '../translations';

interface VideoGeneratorProps {
  plot: PlotPoint;
  assets: StoryAsset[];
  onUpdate: (id: string, updates: Partial<PlotPoint>) => void;
  lang: Language;
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ plot, assets, onUpdate, lang }) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(plot.prompt);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(plot.description);
  
  // Initialize upload mode based on whether we have a custom image or a reference asset
  const [uploadMode, setUploadMode] = useState<'asset' | 'upload'>(plot.customImage ? 'upload' : 'asset');

  const txt = t[lang];

  const handleGenerate = async () => {
    onUpdate(plot.id, { status: 'generating' });
    
    try {
      let imageBase64 = undefined;
      
      // Determine which image source to use
      if (uploadMode === 'asset' && plot.referenceAssetId) {
         imageBase64 = assets.find(a => a.id === plot.referenceAssetId)?.imageUrl;
      } else if (uploadMode === 'upload' && plot.customImage) {
         imageBase64 = plot.customImage;
      }

      const videoUrl = await generateVeoVideo(plot.prompt, imageBase64, plot.aspectRatio || '16:9');
      // Save timestamp on completion
      onUpdate(plot.id, { status: 'completed', videoUrl, generatedAt: Date.now() });
    } catch (error) {
      console.error(error);
      onUpdate(plot.id, { status: 'failed' });
      alert(txt.failedGenerate);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
               onUpdate(plot.id, { customImage: ev.target.result as string });
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const getTimestampFilename = () => {
      const d = plot.generatedAt ? new Date(plot.generatedAt) : new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      return `${ts}_veo_clip.mp4`;
  };

  const assetOptions = assets.filter(a => a.imageUrl);
  const isPortrait = plot.aspectRatio === '9:16';

  return (
    <div className="bg-card/50 border border-slate-700 rounded-lg p-4 mb-4 flex flex-col md:flex-row gap-6">
      {/* Left: Controls */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full ${
               plot.status === 'completed' ? 'bg-green-500' : 
               plot.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 
               plot.status === 'failed' ? 'bg-red-500' : 'bg-slate-500'
           }`} />
           <span className="text-sm font-medium text-slate-300">
             {plot.status === 'idle' && txt.readyToAnimate}
             {plot.status === 'generating' && txt.generating}
             {plot.status === 'completed' && txt.clipReady}
             {plot.status === 'failed' && txt.generationFailed}
           </span>
        </div>

        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-400 uppercase font-bold mb-1">{txt.plotAction}</label>
                <button onClick={() => setIsEditingDescription(!isEditingDescription)} className="text-xs text-primary hover:underline">
                    {isEditingDescription ? txt.save : txt.edit}
                </button>
            </div>
            {isEditingDescription ? (
                <textarea 
                    value={descriptionDraft}
                    onChange={(e) => {
                        setDescriptionDraft(e.target.value);
                        onUpdate(plot.id, { description: e.target.value });
                    }}
                    className="w-full bg-darker border border-slate-600 rounded p-2 text-sm text-white h-20 focus:ring-1 focus:ring-primary outline-none mb-2"
                />
            ) : (
                <p className="text-sm text-white italic mb-2">"{plot.description}"</p>
            )}
        </div>

        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-400 uppercase font-bold">{txt.prompt}</label>
                <button onClick={() => setIsEditingPrompt(!isEditingPrompt)} className="text-xs text-primary hover:underline">
                    {isEditingPrompt ? txt.save : txt.edit}
                </button>
            </div>
            {isEditingPrompt ? (
                <textarea 
                    value={promptDraft}
                    onChange={(e) => {
                        setPromptDraft(e.target.value);
                        onUpdate(plot.id, { prompt: e.target.value });
                    }}
                    className="w-full bg-darker border border-slate-600 rounded p-2 text-sm text-white h-32 focus:ring-1 focus:ring-primary outline-none"
                />
            ) : (
                <div className="text-sm text-slate-300 bg-darker/50 p-2 rounded border border-transparent max-h-32 overflow-y-auto text-xs leading-relaxed">{plot.prompt}</div>
            )}
        </div>

        {/* Image Source Selection */}
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-400 uppercase font-bold">{txt.refSource}</label>
                <div className="flex bg-slate-800 rounded p-0.5">
                    <button 
                        onClick={() => setUploadMode('asset')}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${uploadMode === 'asset' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                        {txt.sourceAsset}
                    </button>
                    <button 
                        onClick={() => setUploadMode('upload')}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${uploadMode === 'upload' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                        {txt.sourceUpload}
                    </button>
                </div>
            </div>
            
            {uploadMode === 'asset' ? (
                 <select 
                    value={plot.referenceAssetId || ''}
                    onChange={(e) => onUpdate(plot.id, { referenceAssetId: e.target.value })}
                    className="w-full bg-darker border border-slate-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                >
                    <option value="">{txt.noRef}</option>
                    {assetOptions.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                    ))}
                </select>
            ) : (
                <div className="flex gap-2">
                   <input 
                     type="file" 
                     accept="image/*"
                     onChange={handleFileChange}
                     className="w-full bg-darker border border-slate-600 rounded p-1.5 text-sm text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
                   />
                </div>
            )}
        </div>

        {/* Aspect Ratio Selection */}
        <div>
             <label className="block text-xs text-slate-400 uppercase font-bold mb-1">{txt.aspectRatio}</label>
             <div className="flex gap-3">
                <button 
                    onClick={() => onUpdate(plot.id, { aspectRatio: '16:9' })}
                    className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-bold transition-all ${!isPortrait ? 'bg-primary/20 border-primary text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                >
                   <div className="w-4 h-2.5 border-2 border-current rounded-sm"></div>
                   {txt.landscape}
                </button>
                <button 
                    onClick={() => onUpdate(plot.id, { aspectRatio: '9:16' })}
                    className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-bold transition-all ${isPortrait ? 'bg-primary/20 border-primary text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                >
                   <div className="w-2.5 h-4 border-2 border-current rounded-sm"></div>
                   {txt.portrait}
                </button>
             </div>
        </div>

        <button 
           onClick={handleGenerate}
           disabled={plot.status === 'generating'}
           className={`w-full py-3 rounded-lg font-bold shadow-lg transition-all
              ${plot.status === 'generating' ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-primary hover:bg-indigo-500 text-white'}
           `}
        >
           {plot.status === 'generating' ? txt.generating : (plot.status === 'completed' ? txt.regenerateClip : txt.generateVideo)}
        </button>

      </div>

      {/* Right: Preview Area */}
      <div className="flex-1 bg-black/40 rounded-lg flex items-center justify-center p-4 border border-slate-800 min-h-[300px]">
          {plot.videoUrl ? (
             <div className="relative group/video w-full h-full flex items-center justify-center">
                 <video 
                   src={plot.videoUrl} 
                   controls 
                   className={`max-h-[320px] shadow-2xl rounded ${isPortrait ? 'aspect-[9/16]' : 'aspect-video'}`} 
                 />
                 <a 
                    href={plot.videoUrl}
                    download={getTimestampFilename()}
                    className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-primary text-white rounded-lg opacity-0 group-hover/video:opacity-100 transition-all shadow-lg backdrop-blur-sm"
                    title={txt.download}
                 >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 </a>
             </div>
          ) : (
             <div className={`relative border-2 border-dashed border-slate-700 rounded flex flex-col items-center justify-center bg-slate-900/50 transition-all duration-500 ${isPortrait ? 'w-[180px] h-[320px]' : 'w-full max-w-[400px] aspect-video'}`}>
                {uploadMode === 'upload' && plot.customImage ? (
                    <img src={plot.customImage} className="w-full h-full object-cover opacity-50" alt="Reference" />
                ) : uploadMode === 'asset' && plot.referenceAssetId ? (
                    <img src={assets.find(a => a.id === plot.referenceAssetId)?.imageUrl} className="w-full h-full object-cover opacity-50" alt="Reference" />
                ) : (
                   <div className="text-center p-4">
                       <svg className="w-12 h-12 text-slate-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       <span className="text-slate-600 text-sm">{txt.noVideo}</span>
                   </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] text-slate-300">
                    {isPortrait ? '9:16' : '16:9'}
                </div>
             </div>
          )}
      </div>
    </div>
  );
};