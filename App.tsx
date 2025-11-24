

import React, { useState, useEffect, useRef } from 'react';
import { AssetType, StoryAsset, PlotPoint, GenerationState, Language, ModelConfig, SavedModel, StoryPolishResponse, StoryProject } from './types';
import { analyzeStory, generateAssetImage, polishStory } from './services/geminiService';
import { AssetCard } from './components/AssetCard';
import { VideoGenerator } from './components/VideoGenerator';
import { SettingsModal } from './components/SettingsModal';
import { ScriptDiffModal } from './components/ScriptDiffModal';
import { StorySidebar } from './components/StorySidebar';
import { HelpModal } from './components/HelpModal';
import { t } from './translations';
import { getAllProjectsFromDB, saveProjectToDB, deleteProjectFromDB } from './utils/db';

export default function App() {
  // --- Story State ---
  const [story, setStory] = useState('');
  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [plotPoints, setPlotPoints] = useState<PlotPoint[]>([]);
  const [state, setState] = useState<GenerationState>({ step: 'input', isAnalyzing: false });
  const [projectTitle, setProjectTitle] = useState('');
  const [isTitleCustom, setIsTitleCustom] = useState(false);
  
  // --- Application State ---
  const [filter, setFilter] = useState<string>('ALL');
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('folktale_lang') as Language) || 'zh'); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStorySidebarOpen, setIsStorySidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);

  // --- Project Management State ---
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // --- Model Configuration State ---
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>('');

  // --- Polish Story State ---
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishData, setPolishData] = useState<StoryPolishResponse | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const txt = t[lang];

  // Save language preference
  useEffect(() => {
    localStorage.setItem('folktale_lang', lang);
  }, [lang]);

  // 1. Load Configuration and Projects
  useEffect(() => {
      // Load models
      const savedListRaw = localStorage.getItem('folktale_saved_models');
      const activeIdRaw = localStorage.getItem('folktale_active_model_id');
      const defaultInference = { temperature: 0.7, topP: 0.9, maxTokens: 8192 };

      let initialModels: SavedModel[] = [];
      let initialActiveId = '';

      if (savedListRaw) {
          initialModels = JSON.parse(savedListRaw);
          initialModels = initialModels.map(m => ({
              ...m,
              inferenceConfig: m.inferenceConfig || defaultInference
          }));
          initialActiveId = activeIdRaw || initialModels[0]?.id || '';
      } else {
           // Fresh start defaults
           const defaultId = crypto.randomUUID();
           initialModels = [{
               id: defaultId,
               name: "Google Gemini",
               provider: 'google',
               apiKey: '',
               baseUrl: '',
               textModel: 'gemini-2.5-flash',
               imageModel: 'gemini-2.5-flash-image',
               videoModel: 'veo-3.1-fast-generate-preview',
               inferenceConfig: defaultInference
           }];
           initialActiveId = defaultId;
      }
      setSavedModels(initialModels);
      setActiveModelId(initialActiveId);

      // Load Projects from IndexedDB
      const initProjects = async () => {
        let loadedProjects: StoryProject[] = [];
        try {
            // First try DB
            loadedProjects = await getAllProjectsFromDB();
            
            // Migration: Check localStorage if DB is empty
            if (loadedProjects.length === 0) {
                const legacyProjectsRaw = localStorage.getItem('folktale_projects');
                if (legacyProjectsRaw) {
                    try {
                        const legacyProjects: StoryProject[] = JSON.parse(legacyProjectsRaw);
                        if (legacyProjects.length > 0) {
                            console.log("Migrating legacy projects to IndexedDB...");
                            for (const p of legacyProjects) {
                                await saveProjectToDB(p);
                            }
                            loadedProjects = legacyProjects;
                            // Optional: Clear legacy storage to free up space
                            localStorage.removeItem('folktale_projects');
                        }
                    } catch (e) {
                        console.error("Migration failed", e);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load projects", e);
        }

        setProjects(loadedProjects);
        
        if (loadedProjects.length > 0) {
            const mostRecent = loadedProjects.sort((a,b) => b.lastModified - a.lastModified)[0];
            loadProject(mostRecent);
        } else {
            createNewProject();
        }
      };

      initProjects();
  }, []);

  const createNewProject = () => {
      const newId = crypto.randomUUID();
      const newProject: StoryProject = {
          id: newId,
          title: '',
          content: '',
          assets: [],
          plotPoints: [],
          state: { step: 'input', isAnalyzing: false },
          lastModified: Date.now(),
          hasCustomTitle: false
      };
      
      setProjects(prev => {
          const updated = [...prev, newProject];
          saveProjectToDB(newProject); // Save new empty project immediately
          return updated;
      });
      
      // Reset UI State
      setCurrentProjectId(newId);
      setStory('');
      setAssets([]);
      setPlotPoints([]);
      setState({ step: 'input', isAnalyzing: false });
      setProjectTitle('');
      setIsTitleCustom(false);
  };

  const loadProject = (project: StoryProject) => {
      setCurrentProjectId(project.id);
      setStory(project.content);
      setAssets(project.assets);
      setPlotPoints(project.plotPoints);
      setState(project.state);
      
      if (project.hasCustomTitle) {
        setProjectTitle(project.title);
        setIsTitleCustom(true);
      } else {
        setProjectTitle(''); // Clear title to show placeholder based on content
        setIsTitleCustom(false);
      }
  };

  const deleteProject = (id: string) => {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      deleteProjectFromDB(id);
      
      if (id === currentProjectId) {
          if (updated.length > 0) {
              loadProject(updated[0]);
          } else {
              createNewProject();
          }
      }
  };

  // 3. Auto-Save Effect (Debounced saving to IndexedDB)
  useEffect(() => {
      if (!currentProjectId) return;

      // Calculate effective title
      let effectiveTitle = projectTitle;
      if (!isTitleCustom) {
         effectiveTitle = story.trim() 
            ? (story.slice(0, 30).replace(/\n/g, ' ') + (story.length > 30 ? '...' : '')) 
            : '';
      }

      setProjects(prev => {
          const index = prev.findIndex(p => p.id === currentProjectId);
          if (index === -1) return prev;

          const existing = prev[index];
          const finalTitle = effectiveTitle || existing.title;

          // Check if meaningful change happened
          const hasChanged = existing.content !== story || 
                             existing.state.step !== state.step ||
                             existing.title !== finalTitle ||
                             existing.hasCustomTitle !== isTitleCustom ||
                             JSON.stringify(existing.assets) !== JSON.stringify(assets) ||
                             JSON.stringify(existing.plotPoints) !== JSON.stringify(plotPoints);

          if (!hasChanged) return prev;

          const updatedProject: StoryProject = {
              ...existing,
              title: finalTitle,
              hasCustomTitle: isTitleCustom,
              content: story,
              assets: assets,
              plotPoints: plotPoints,
              state: state,
              lastModified: Date.now()
          };

          const newProjects = [...prev];
          newProjects[index] = updatedProject;
          
          // Save to IDB (No quota limit issues like localStorage)
          saveProjectToDB(updatedProject).then(() => {
              setLastSaved(new Date());
          });
          
          return newProjects;
      });
  }, [story, assets, plotPoints, state, currentProjectId, projectTitle, isTitleCustom]);


  const handleSaveSettings = (models: SavedModel[], newActiveId: string) => {
      setSavedModels(models);
      setActiveModelId(newActiveId);
      localStorage.setItem('folktale_saved_models', JSON.stringify(models));
      localStorage.setItem('folktale_active_model_id', newActiveId);
  };

  const currentModelConfig = savedModels.find(m => m.id === activeModelId) || savedModels[0];


  const handleAnalyze = async () => {
    if (!story.trim()) return;
    setState({ ...state, isAnalyzing: true });
    try {
      // Pass the current language to the service
      const analysis = await analyzeStory(story, currentModelConfig, lang);
      
      // Update title from analysis
      if (analysis.title) {
          setProjectTitle(analysis.title);
          setIsTitleCustom(true);
      }

      const newAssets: StoryAsset[] = [
        ...analysis.characters.map(c => ({ id: crypto.randomUUID(), type: AssetType.CHARACTER, name: c.name, description: c.description, isGenerating: false })),
        ...analysis.scenes.map(s => ({ id: crypto.randomUUID(), type: AssetType.SCENE, name: 'Scene', description: s.description, isGenerating: false })),
        ...analysis.props.map(p => ({ id: crypto.randomUUID(), type: AssetType.PROP, name: p.name, description: p.description, isGenerating: false })),
        ...analysis.animals_plants.map(a => ({ id: crypto.randomUUID(), type: AssetType.ANIMAL_PLANT, name: a.name, description: a.description, isGenerating: false })),
        ...analysis.others.map(o => ({ id: crypto.randomUUID(), type: AssetType.OTHER, name: o.name, description: o.description, isGenerating: false })),
      ];

      const newPlotPoints: PlotPoint[] = analysis.plot_points.map(p => ({
        id: crypto.randomUUID(),
        description: p.description,
        prompt: p.suggested_visual,
        status: 'idle',
        aspectRatio: '16:9'
      }));

      setAssets(newAssets);
      setPlotPoints(newPlotPoints);
      setState({ step: 'assets', isAnalyzing: false });
    } catch (error: any) {
      console.error(error);
      setState({ ...state, isAnalyzing: false });
      alert(`${txt.failedAnalysis} (${error.message})`);
    }
  };

  const handlePolish = async () => {
      if (!story.trim()) return;
      setIsPolishing(true);
      try {
          // Pass the current language to the service
          const result = await polishStory(story, currentModelConfig, lang);
          setPolishData(result);
          setIsDiffModalOpen(true);
      } catch (e: any) {
          console.error(e);
          alert(`${txt.failedPolish}: ${e.message}`);
      } finally {
          setIsPolishing(false);
      }
  };

  const handleApplyPolish = (newStory: string) => {
      setStory(newStory);
      setIsDiffModalOpen(false);
      setPolishData(null);
  };

  const handleUpdateAsset = (id: string, updates: Partial<StoryAsset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleGenerateAsset = async (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    setAssets(prev => prev.map(a => a.id === id ? { ...a, isGenerating: true } : a));

    try {
      const imageUrl = await generateAssetImage(
          asset.description, 
          story.substring(0, 200), 
          asset.negativePrompt, 
          currentModelConfig
      );
      setAssets(prev => prev.map(a => a.id === id ? { ...a, isGenerating: false, imageUrl } : a));
    } catch (error: any) {
      console.error(error);
      setAssets(prev => prev.map(a => a.id === id ? { ...a, isGenerating: false } : a));
      alert(`${txt.failedImage}: ${asset.name} (${error.message})`);
    }
  };

  const handleUpdatePlot = (id: string, updates: Partial<PlotPoint>) => {
      setPlotPoints(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // --- Drag and Drop Handlers for Assets ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedAssetId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedAssetId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedAssetId || draggedAssetId === targetId) return;
    
    const sourceIndex = assets.findIndex(a => a.id === draggedAssetId);
    const targetIndex = assets.findIndex(a => a.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;
    
    // Only allow reordering if they are the same type
    if (assets[sourceIndex].type !== assets[targetIndex].type) return;

    const newAssets = [...assets];
    const [movedAsset] = newAssets.splice(sourceIndex, 1);
    newAssets.splice(targetIndex, 0, movedAsset);
    
    setAssets(newAssets);
    setDraggedAssetId(null);
  };

  // Final Video Player State
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayAll = () => {
    const validVideos = plotPoints.filter(p => p.videoUrl);
    if (validVideos.length === 0) return;
    setCurrentPlayingIndex(0);
  };

  const handleVideoEnded = () => {
    if (currentPlayingIndex === null) return;
    const validVideos = plotPoints.filter(p => p.videoUrl);
    if (currentPlayingIndex < validVideos.length - 1) {
        setCurrentPlayingIndex(currentPlayingIndex + 1);
    } else {
        setCurrentPlayingIndex(null);
    }
  };
  
  const getTimestampFilename = (plot: PlotPoint) => {
      const d = plot.generatedAt ? new Date(plot.generatedAt) : new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      return `${ts}_veo_clip.mp4`;
  };

  // Filter logic
  const filteredAssets = filter === 'ALL' ? assets : assets.filter(a => a.type === filter);

  return (
    <div className="min-h-screen bg-darker text-slate-200 font-sans pb-20">
      
      {/* Modals */}
      {currentModelConfig && (
         <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            savedModels={savedModels}
            activeModelId={activeModelId}
            onSave={handleSaveSettings}
            lang={lang}
         />
      )}

      <ScriptDiffModal 
         isOpen={isDiffModalOpen}
         onClose={() => setIsDiffModalOpen(false)}
         original={story}
         polishedData={polishData}
         onApply={handleApplyPolish}
         lang={lang}
      />

      <HelpModal 
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        lang={lang}
      />

      <StorySidebar 
         isOpen={isStorySidebarOpen}
         onClose={() => setIsStorySidebarOpen(false)}
         projects={projects}
         currentProjectId={currentProjectId}
         onSelectProject={(id) => loadProject(projects.find(p => p.id === id)!)}
         onCreateProject={createNewProject}
         onDeleteProject={deleteProject}
         lang={lang}
      />

      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsStorySidebarOpen(true)}
                    className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors group"
                    title={txt.myStories}
                >
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-tr from-primary to-secondary p-2 rounded-lg hidden sm:block">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white">{txt.appTitle}</h1>
                        {projects.find(p => p.id === currentProjectId)?.title && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                {projects.find(p => p.id === currentProjectId)?.title}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                
                {lastSaved && (
                    <span className="text-[10px] text-slate-500 hidden lg:block transition-opacity">
                        {txt.autoSaved} {lastSaved.toLocaleTimeString()}
                    </span>
                )}

                {/* Language Toggle */}
                <div className="flex bg-slate-800 rounded-lg p-1 hidden sm:flex">
                     <button onClick={() => setLang('en')} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${lang === 'en' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}>EN</button>
                     <button onClick={() => setLang('zh')} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${lang === 'zh' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}>中文</button>
                </div>

                {/* Help Button */}
                <button 
                    onClick={() => setIsHelpOpen(true)}
                    className="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-lg"
                    title={txt.help}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>

                {/* Settings Button */}
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all rounded-lg border border-slate-700"
                    title={txt.settings}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-xs font-bold hidden md:inline">{currentModelConfig ? currentModelConfig.name : 'Settings'}</span>
                </button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Steps Indicator */}
        <div className="flex items-center justify-between mb-12 relative">
             <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -z-10" />
             {['input', 'assets', 'storyboard', 'preview'].map((stepName, idx) => {
                const steps = ['input', 'assets', 'storyboard', 'preview'];
                const currentIndex = steps.indexOf(state.step);
                const thisIndex = steps.indexOf(stepName);
                const isActive = thisIndex <= currentIndex;
                
                const labels = {
                    input: txt.inputStep,
                    assets: txt.assetsStep,
                    storyboard: txt.storyboardStep,
                    preview: txt.previewStep
                };

                return (
                    <div key={stepName} className="flex flex-col items-center bg-darker px-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                            ${isActive ? 'bg-primary border-primary text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}
                        `}>
                            {idx + 1}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>
                            {labels[stepName as keyof typeof labels]}
                        </span>
                    </div>
                );
             })}
        </div>

        {/* Step 1: Input */}
        {state.step === 'input' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
             <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">{txt.tellStory}</h2>
                <p className="text-slate-400">{txt.pasteStory}</p>
             </div>
             
             <div className="bg-card border border-slate-700 rounded-xl p-2 shadow-xl">
                {/* Title Input */}
                <input 
                   type="text"
                   value={projectTitle}
                   onChange={(e) => {
                       setProjectTitle(e.target.value);
                       setIsTitleCustom(true);
                   }}
                   placeholder={txt.storyTitlePlaceholder}
                   className="w-full bg-slate-800/50 text-white text-lg font-bold px-4 py-3 border-b border-slate-700 focus:bg-slate-800 outline-none rounded-t-lg placeholder-slate-600"
                />
                
                <textarea 
                  className="w-full h-64 bg-transparent text-lg text-slate-300 p-4 focus:outline-none resize-none"
                  placeholder={txt.storyPlaceholder}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                />
                <div className="flex justify-between items-center px-4 py-3 bg-slate-800/50 rounded-b-lg border-t border-slate-700">
                   <div className="text-xs text-slate-500">
                       {story.length} chars
                   </div>
                   <div className="flex gap-3">
                       <button 
                         onClick={handlePolish}
                         disabled={!story.trim() || isPolishing}
                         className="text-slate-400 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                       >
                          {isPolishing ? (
                              <>
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                {txt.polishingBtn}
                              </>
                          ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                {txt.polishBtn}
                              </>
                          )}
                       </button>
                       <button 
                         onClick={handleAnalyze}
                         disabled={!story.trim() || state.isAnalyzing}
                         className={`bg-primary hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2
                            ${state.isAnalyzing ? 'opacity-70 cursor-not-allowed' : 'shadow-lg shadow-primary/20'}
                         `}
                       >
                          {state.isAnalyzing ? (
                              <>
                                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                 {txt.analyzingBtn}
                              </>
                          ) : (
                              <>
                                 {txt.analyzeBtn}
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                              </>
                          )}
                       </button>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Step 2: Assets */}
        {state.step === 'assets' && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{txt.assetsTitle}</h2>
                        <p className="text-slate-400 text-sm">{txt.assetsDesc}</p>
                    </div>
                    <div className="flex gap-3">
                        <select 
                          value={filter} 
                          onChange={(e) => setFilter(e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                            <option value="ALL">{txt.filterAll}</option>
                            <option value={AssetType.CHARACTER}>Characters</option>
                            <option value={AssetType.SCENE}>Scenes</option>
                            <option value={AssetType.PROP}>Props</option>
                        </select>
                        <button 
                           onClick={() => setState({ ...state, step: 'storyboard' })}
                           className="bg-primary hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
                        >
                           {txt.nextStoryboard}
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredAssets.map(asset => (
                        <AssetCard 
                           key={asset.id} 
                           asset={asset} 
                           onGenerate={handleGenerateAsset}
                           onRegenerate={handleGenerateAsset}
                           onUpdate={handleUpdateAsset}
                           lang={lang}
                           onDragStart={handleDragStart}
                           onDragEnd={handleDragEnd}
                           onDragOver={handleDragOver}
                           onDrop={handleDrop}
                           isDragging={draggedAssetId === asset.id}
                        />
                    ))}
                </div>
            </div>
        )}

        {/* Step 3: Storyboard (Video Generation) */}
        {state.step === 'storyboard' && (
             <div className="animate-fade-in">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{txt.productionTitle}</h2>
                        <p className="text-slate-400 text-sm">{txt.productionDesc}</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                           onClick={() => setState({ ...state, step: 'assets' })}
                           className="text-slate-400 hover:text-white px-4 py-2 font-medium"
                        >
                           {txt.backToAssets}
                        </button>
                        <button 
                           onClick={() => setState({ ...state, step: 'preview' })}
                           className="bg-primary hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
                        >
                           {txt.previewMovie}
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {plotPoints.map(plot => (
                        <VideoGenerator 
                           key={plot.id} 
                           plot={plot} 
                           assets={assets} 
                           onUpdate={handleUpdatePlot}
                           lang={lang}
                        />
                    ))}
                </div>
             </div>
        )}

        {/* Step 4: Preview */}
        {state.step === 'preview' && (
             <div className="animate-fade-in max-w-4xl mx-auto">
                 <div className="text-center mb-8">
                     <h2 className="text-3xl font-bold text-white mb-2">{txt.readyToWatch}</h2>
                     <button 
                        onClick={() => setState({ ...state, step: 'storyboard' })}
                        className="text-slate-400 hover:text-white"
                     >
                        ← {txt.productionTitle}
                     </button>
                 </div>

                 <div className="bg-black rounded-2xl shadow-2xl border border-slate-800 overflow-hidden aspect-video relative group">
                     {currentPlayingIndex !== null ? (
                         <video 
                            ref={videoRef}
                            src={plotPoints.filter(p => p.videoUrl)[currentPlayingIndex].videoUrl}
                            className="w-full h-full object-contain"
                            autoPlay
                            controls
                            onEnded={handleVideoEnded}
                         />
                     ) : (
                         <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                             <button 
                                onClick={handlePlayAll}
                                className="w-20 h-20 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm transition-all transform hover:scale-105"
                             >
                                 <svg className="w-10 h-10 text-white ml-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                             </button>
                         </div>
                     )}
                     
                     {currentPlayingIndex !== null && (
                         <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded-full text-xs font-bold text-white backdrop-blur">
                             {txt.clip} {currentPlayingIndex + 1} / {plotPoints.filter(p => p.videoUrl).length}
                         </div>
                     )}
                 </div>

                 {/* Timeline / Clips List */}
                 <div className="mt-8">
                     <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                         {plotPoints.filter(p => p.videoUrl).map((p, idx) => (
                             <div 
                                key={p.id}
                                className={`flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden border-2 transition-all relative group
                                    ${currentPlayingIndex === idx ? 'border-primary ring-2 ring-primary/50' : 'border-slate-800 hover:border-slate-600'}
                                `}
                             >
                                 <button 
                                     onClick={() => setCurrentPlayingIndex(idx)}
                                     className="w-full h-full"
                                 >
                                     <video src={p.videoUrl} className="w-full h-full object-cover" />
                                 </button>
                                 <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white">
                                     #{idx + 1}
                                 </div>
                                 <a 
                                    href={p.videoUrl} 
                                    download={getTimestampFilename(p)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-primary text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={txt.download}
                                 >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                 </a>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
        )}

      </main>
    </div>
  );
}