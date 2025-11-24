
import React from 'react';
import { StoryPolishResponse, Language } from '../types';
import { t } from '../translations';

interface ScriptDiffModalProps {
    isOpen: boolean;
    original: string;
    polishedData: StoryPolishResponse | null;
    onClose: () => void;
    onApply: (newScript: string) => void;
    lang: Language;
}

export const ScriptDiffModal: React.FC<ScriptDiffModalProps> = ({ isOpen, original, polishedData, onClose, onApply, lang }) => {
    if (!isOpen || !polishedData) return null;

    const txt = t[lang];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="bg-darker border border-slate-700 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl animate-fade-in">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                       <span className="bg-secondary/20 text-secondary p-1.5 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       </span>
                       {txt.reviewChanges}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    
                    {/* Script Comparison */}
                    <div className="flex-1 flex flex-col h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-slate-800">
                         <div className="flex-1 flex overflow-hidden">
                             {/* Original */}
                             <div className="flex-1 flex flex-col border-r border-slate-800 bg-black/20">
                                 <div className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-b border-slate-800 bg-slate-900/50">
                                     {txt.originalScript}
                                 </div>
                                 <div className="flex-1 p-4 overflow-y-auto font-mono text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                                     {original}
                                 </div>
                             </div>

                             {/* Polished */}
                             <div className="flex-1 flex flex-col bg-green-900/5">
                                 <div className="p-3 text-xs font-bold text-green-400 uppercase tracking-wider text-center border-b border-green-900/30 bg-green-900/10">
                                     {txt.polishedScript}
                                 </div>
                                 <div className="flex-1 p-4 overflow-y-auto font-mono text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                     {polishedData.rewritten_story}
                                 </div>
                             </div>
                         </div>
                    </div>

                    {/* Critique Panel */}
                    <div className="w-full lg:w-1/3 bg-slate-900/50 flex flex-col h-1/2 lg:h-full overflow-hidden">
                         <div className="p-4 border-b border-slate-800">
                             <h3 className="font-bold text-lg text-white mb-1">{txt.critiqueTitle}</h3>
                             <p className="text-xs text-slate-400">AI identified {polishedData.changes_made.length} key issues/improvements.</p>
                         </div>
                         <div className="flex-1 overflow-y-auto p-6 space-y-6">
                             <div className="bg-card border border-slate-700 p-4 rounded-lg">
                                 <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                     {polishedData.critique}
                                 </p>
                             </div>

                             <div>
                                 <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Key Changes Made</h4>
                                 <ul className="space-y-2">
                                     {polishedData.changes_made.map((change, idx) => (
                                         <li key={idx} className="text-sm text-slate-300 flex gap-3 items-start">
                                             <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">✓</span>
                                             {change}
                                         </li>
                                     ))}
                                 </ul>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg text-slate-300 hover:bg-slate-800 font-medium transition-colors"
                    >
                        {txt.discardChanges}
                    </button>
                    <button 
                        onClick={() => onApply(polishedData.rewritten_story)}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {txt.applyChanges}
                    </button>
                </div>
            </div>
        </div>
    );
};