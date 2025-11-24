
import React from 'react';
import { StoryProject, Language } from '../types';
import { t } from '../translations';

interface StorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    projects: StoryProject[];
    currentProjectId: string | null;
    onSelectProject: (id: string) => void;
    onCreateProject: () => void;
    onDeleteProject: (id: string) => void;
    lang: Language;
}

export const StorySidebar: React.FC<StorySidebarProps> = ({ 
    isOpen, 
    onClose, 
    projects, 
    currentProjectId, 
    onSelectProject, 
    onCreateProject, 
    onDeleteProject,
    lang 
}) => {
    const txt = t[lang];

    // Format date helper
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800 z-[70] transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        {txt.myStories}
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {projects.sort((a,b) => b.lastModified - a.lastModified).map(project => (
                        <div 
                            key={project.id}
                            className={`group relative rounded-xl border transition-all cursor-pointer
                                ${project.id === currentProjectId 
                                    ? 'bg-slate-800 border-primary shadow-md' 
                                    : 'bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-700'}
                            `}
                            onClick={() => {
                                onSelectProject(project.id);
                                onClose();
                            }}
                        >
                            <div className="p-3 pr-10">
                                <h3 className={`font-bold truncate mb-1 ${project.id === currentProjectId ? 'text-white' : 'text-slate-300'}`}>
                                    {project.title || txt.untitledStory}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span>{formatDate(project.lastModified)}</span>
                                    {project.state.step !== 'input' && (
                                        <span className="bg-slate-700 px-1.5 rounded text-[10px] text-slate-300">
                                            {project.state.step === 'assets' ? 'Assets' : project.state.step === 'storyboard' ? 'Storyboard' : 'Preview'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Delete Button (Visible on Hover) */}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(window.confirm(txt.confirmDeleteStory)) {
                                        onDeleteProject(project.id);
                                    }
                                }}
                                className="absolute right-2 top-3 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title={txt.deleteStory}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}

                    {projects.length === 0 && (
                         <div className="text-center py-10 text-slate-600 text-sm">
                             No stories yet.
                         </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950">
                    <button 
                        onClick={() => {
                            onCreateProject();
                            onClose();
                        }}
                        className="w-full py-3 bg-primary hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        {txt.newStory}
                    </button>
                </div>
            </div>
        </>
    );
};
