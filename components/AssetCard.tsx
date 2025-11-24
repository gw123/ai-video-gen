import React from 'react';
import { StoryAsset, Language } from '../types';
import { t } from '../translations';

interface AssetCardProps {
  asset: StoryAsset;
  onGenerate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onUpdate: (id: string, updates: Partial<StoryAsset>) => void;
  lang: Language;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
  isDragging?: boolean;
}

export const AssetCard: React.FC<AssetCardProps> = ({ 
  asset, 
  onGenerate, 
  onRegenerate, 
  onUpdate, 
  lang,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging
}) => {
  const txt = t[lang];
  return (
    <div 
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, asset.id)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop?.(e, asset.id)}
      className={`bg-card rounded-xl overflow-hidden flex flex-col h-full transition-all duration-200 
        ${isDragging 
          ? 'opacity-40 border-2 border-dashed border-slate-500 scale-95' 
          : 'border border-slate-700 shadow-lg hover:border-slate-600'
        }
      `}
    >
      <div className="relative aspect-square bg-slate-800 group cursor-move">
        {asset.imageUrl ? (
          <>
            <img 
              src={asset.imageUrl} 
              alt={asset.name} 
              className="w-full h-full object-cover transition-opacity duration-300"
              draggable={false} // Prevent default image drag
            />
            {asset.isGenerating ? (
                 <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                     <span className="text-xs text-white animate-pulse">{txt.painting}</span>
                 </div>
            ) : (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <button 
                     onClick={() => onRegenerate(asset.id)}
                     className="bg-primary hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     {txt.regenerate}
                   </button>
                </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            {asset.isGenerating ? (
               <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="text-xs text-slate-400 animate-pulse">{txt.painting}</span>
               </div>
            ) : (
               <button 
                 onClick={() => onGenerate(asset.id)}
                 className="text-slate-400 hover:text-white transition-colors flex flex-col items-center gap-2"
               >
                  <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-xs font-medium uppercase tracking-wider">{txt.generateArt}</span>
               </button>
            )}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-white truncate" title={asset.name}>{asset.name}</h3>
            <span className="text-[10px] bg-slate-700 px-2 py-1 rounded-full text-slate-300 uppercase tracking-wide">{asset.type}</span>
        </div>
        <p className="text-slate-400 text-xs line-clamp-3 flex-grow mb-2">{asset.description}</p>
        
        <div className="mt-auto">
           <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">{txt.negativePrompt}</label>
           <input 
             type="text" 
             value={asset.negativePrompt || ''} 
             onChange={(e) => onUpdate(asset.id, { negativePrompt: e.target.value })}
             placeholder={txt.negativePromptPlaceholder}
             className="w-full bg-darker border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:border-primary outline-none placeholder-slate-600"
           />
        </div>
      </div>
    </div>
  );
};