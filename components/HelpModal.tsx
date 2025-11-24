
import React from 'react';
import { Language } from '../types';
import { t } from '../translations';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, lang }) => {
    if (!isOpen) return null;
    const txt = t[lang];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {txt.helpTitle}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto text-slate-300 space-y-6 custom-scrollbar">
                    <p className="text-lg font-medium text-white">{txt.helpIntro}</p>
                    
                    <div className="space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                            <h3 className="font-bold text-primary mb-1">{txt.step1Title}</h3>
                            <p className="text-sm leading-relaxed">{txt.step1Desc}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                            <h3 className="font-bold text-primary mb-1">{txt.step2Title}</h3>
                            <p className="text-sm leading-relaxed">{txt.step2Desc}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                            <h3 className="font-bold text-primary mb-1">{txt.step3Title}</h3>
                            <p className="text-sm leading-relaxed">{txt.step3Desc}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                            <h3 className="font-bold text-primary mb-1">{txt.step4Title}</h3>
                            <p className="text-sm leading-relaxed">{txt.step4Desc}</p>
                        </div>
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                            <h3 className="font-bold text-primary mb-1">{txt.step5Title}</h3>
                            <p className="text-sm leading-relaxed">{txt.step5Desc}</p>
                        </div>
                    </div>

                    <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-500/30">
                        <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                             <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                             {txt.tipsTitle}
                        </h3>
                        <p className="text-sm text-slate-200 leading-relaxed">{txt.tipsDesc}</p>
                    </div>
                </div>
                 
                <div className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-xl flex justify-end">
                     <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                        {txt.close}
                     </button>
                </div>
            </div>
        </div>
    );
};
