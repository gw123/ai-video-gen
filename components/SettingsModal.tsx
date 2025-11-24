
import React, { useState, useEffect } from 'react';
import { SavedModel, ProviderType, Language, InferenceConfig } from '../types';
import { testModelConnection } from '../services/geminiService';
import { t } from '../translations';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    savedModels: SavedModel[];
    activeModelId: string;
    onSave: (models: SavedModel[], activeId: string) => void;
    lang: Language;
}

const DEFAULT_INFERENCE: InferenceConfig = {
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 8192
};

const SUGGESTED_MODELS = {
    text: [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash-lite-preview-02-05",
        "gpt-4o",
        "gpt-4o-mini",
        "claude-3-5-sonnet-latest",
        "deepseek-chat",
        "llama3"
    ],
    image: [
        "gemini-2.5-flash-image",
        "gemini-3-pro-image-preview",
        "imagen-3.0-generate-001",
        "dall-e-3",
        "midjourney-v6"
    ],
    video: [
        "veo-3.1-fast-generate-preview",
        "veo-3.1-generate-preview",
        "luma-dream-machine",
        "runway-gen-3-alpha",
        "kling-v1",
        "cogvideox",
        "sora-1.0-turbo"
    ]
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, savedModels, activeModelId, onSave, lang }) => {
    const [models, setModels] = useState<SavedModel[]>(savedModels);
    const [selectedId, setSelectedId] = useState<string>(activeModelId);
    const [draftModel, setDraftModel] = useState<SavedModel | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<'none' | 'success' | 'error'>('none');
    
    const txt = t[lang];

    // Initialize
    useEffect(() => {
        if (isOpen) {
            setModels(savedModels);
            const initialSelect = savedModels.find(m => m.id === activeModelId) ? activeModelId : savedModels[0]?.id;
            setSelectedId(initialSelect);
            const m = savedModels.find(m => m.id === initialSelect);
            if (m) setDraftModel(m);
        }
    }, [isOpen, savedModels, activeModelId]);

    // Sync draft when selection changes
    useEffect(() => {
        const m = models.find(model => model.id === selectedId);
        if (m) {
             setDraftModel({
                 ...m,
                 inferenceConfig: m.inferenceConfig || { ...DEFAULT_INFERENCE }
             });
             setTestResult('none');
        }
    }, [selectedId, models]);

    if (!isOpen) return null;

    const handleProviderChange = (p: ProviderType) => {
        if (!draftModel) return;
        
        let defaults: Partial<SavedModel> = { provider: p, inferenceConfig: { ...DEFAULT_INFERENCE } };
        if (p === 'google') {
            defaults.baseUrl = '';
            defaults.textModel = 'gemini-2.5-flash';
            defaults.imageModel = 'gemini-2.5-flash-image';
            defaults.videoModel = 'veo-3.1-fast-generate-preview';
        } else if (p === 'openai') {
            defaults.baseUrl = 'https://api.openai.com/v1';
            defaults.textModel = 'gpt-4o';
            defaults.imageModel = 'dall-e-3';
            defaults.videoModel = 'sora-1.0-turbo';
        } else if (p === 'ollama') {
            defaults.baseUrl = 'http://localhost:11434/v1';
            defaults.textModel = 'llama3';
            defaults.imageModel = ''; 
            defaults.videoModel = '';
        } else if (p === 'volcengine') {
            defaults.baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
            defaults.textModel = 'ep-2025...'; // placeholder
            defaults.imageModel = '';
            defaults.videoModel = 'doubao-video';
        } else if (p === 'qwen') {
            defaults.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
            defaults.textModel = 'qwen-plus';
            defaults.imageModel = '';
            defaults.videoModel = 'wanx-v1';
        } else if (p === 'custom') {
            defaults.baseUrl = '';
            defaults.textModel = '';
            defaults.imageModel = '';
            defaults.videoModel = '';
        }
        updateDraft({ ...defaults });
    };

    const updateDraft = (updates: Partial<SavedModel>) => {
        if (!draftModel) return;
        const updated = { ...draftModel, ...updates };
        setDraftModel(updated);
        // Update list immediately
        setModels(prev => prev.map(m => m.id === updated.id ? updated : m));
        setTestResult('none');
    };

    const updateInference = (updates: Partial<InferenceConfig>) => {
        if (!draftModel) return;
        const newConfig = { ...(draftModel.inferenceConfig || DEFAULT_INFERENCE), ...updates };
        updateDraft({ inferenceConfig: newConfig });
    };

    const handleAddNew = () => {
        const newModel: SavedModel = {
            id: crypto.randomUUID(),
            name: "New Model",
            provider: 'google',
            apiKey: '',
            baseUrl: '',
            textModel: 'gemini-2.5-flash',
            imageModel: 'gemini-2.5-flash-image',
            videoModel: 'veo-3.1-fast-generate-preview',
            inferenceConfig: { ...DEFAULT_INFERENCE }
        };
        setModels(prev => [...prev, newModel]);
        setSelectedId(newModel.id);
    };

    const handleDelete = () => {
        if (!draftModel) return;
        if (window.confirm(txt.confirmDelete)) {
             const newModels = models.filter(m => m.id !== draftModel.id);
             if (newModels.length === 0) {
                 const defaultModel: SavedModel = {
                    id: crypto.randomUUID(),
                    name: "Google Gemini",
                    provider: 'google',
                    apiKey: '',
                    baseUrl: '',
                    textModel: 'gemini-2.5-flash',
                    imageModel: 'gemini-2.5-flash-image',
                    videoModel: 'veo-3.1-fast-generate-preview',
                    inferenceConfig: { ...DEFAULT_INFERENCE }
                 };
                 setModels([defaultModel]);
                 setSelectedId(defaultModel.id);
             } else {
                 setModels(newModels);
                 setSelectedId(newModels[0].id);
             }
        }
    };

    const handleTestConnection = async () => {
        if (!draftModel) return;
        setIsTesting(true);
        setTestResult('none');
        const success = await testModelConnection(draftModel);
        setIsTesting(false);
        setTestResult(success ? 'success' : 'error');
    };

    const handleSaveAll = () => {
        onSave(models, selectedId); 
        onClose();
    };

    const handleSetAsActive = () => {
        onSave(models, selectedId); 
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-slate-700 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="bg-primary/20 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        {txt.settings}
                    </h2>
                    <div className="flex gap-3">
                        <button onClick={handleSaveAll} className="bg-primary hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                            {txt.saveSettings}
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Sidebar List */}
                    <div className="w-1/3 md:w-1/4 border-r border-slate-700 bg-slate-900 flex flex-col">
                         <div className="p-3 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                             {models.map(m => (
                                 <button 
                                    key={m.id}
                                    onClick={() => setSelectedId(m.id)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all group relative
                                        ${m.id === selectedId 
                                            ? 'bg-slate-800 border-primary shadow-md' 
                                            : 'bg-transparent border-transparent hover:bg-slate-800 hover:border-slate-700'}
                                    `}
                                 >
                                     <div className="flex justify-between items-start mb-1">
                                         <span className={`font-bold text-sm truncate ${m.id === selectedId ? 'text-white' : 'text-slate-300'}`}>{m.name}</span>
                                         {activeModelId === m.id && (
                                             <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide shadow-sm">{txt.activeModel}</span>
                                         )}
                                     </div>
                                     <div className="flex items-center gap-2 text-xs text-slate-500">
                                         <span className="uppercase">{m.provider}</span>
                                         <span>•</span>
                                         <span className="truncate max-w-[100px]">{m.textModel}</span>
                                     </div>
                                 </button>
                             ))}
                         </div>
                         <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                             <button 
                                onClick={handleAddNew}
                                className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
                             >
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                 {txt.addNewModel}
                             </button>
                         </div>
                    </div>

                    {/* Main Detail View */}
                    <div className="flex-1 bg-darker flex flex-col overflow-hidden relative">
                        {draftModel ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                
                                {/* Top Action Bar */}
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-2xl font-bold text-white">{txt.editConfig}</h3>
                                    <div className="flex gap-3">
                                        {activeModelId !== draftModel.id && (
                                            <button 
                                                onClick={handleSetAsActive}
                                                className="px-4 py-2 bg-slate-800 border border-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                {txt.useModel}
                                            </button>
                                        )}
                                        <button 
                                            onClick={handleDelete}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
                                            title={txt.deleteModel}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Form */}
                                <div className="space-y-8 max-w-3xl">
                                    
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-2 gap-6">
                                         <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.provider}</label>
                                            <div className="relative">
                                                <select 
                                                    value={draftModel.provider} 
                                                    onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                                                    className="w-full bg-card border border-slate-600 rounded-lg p-3 pl-4 text-white focus:border-primary outline-none appearance-none font-medium"
                                                >
                                                    <option value="google">{txt.google}</option>
                                                    <option value="openai">{txt.openai}</option>
                                                    <option value="ollama">{txt.ollama}</option>
                                                    <option value="volcengine">{txt.volcengine}</option>
                                                    <option value="qwen">{txt.qwen}</option>
                                                    <option value="custom">{txt.custom}</option>
                                                </select>
                                                <div className="absolute right-3 top-3.5 text-slate-400 pointer-events-none">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                         </div>

                                         <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.modelLabel}</label>
                                            <input 
                                                type="text" 
                                                value={draftModel.name} 
                                                onChange={(e) => updateDraft({ name: e.target.value })}
                                                className="w-full bg-card border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none"
                                            />
                                         </div>
                                    </div>

                                    {/* Connection Details */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.modelName}</label>
                                            <input 
                                                list="textModels"
                                                type="text" 
                                                value={draftModel.textModel} 
                                                onChange={(e) => updateDraft({ textModel: e.target.value })}
                                                className="w-full bg-card border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                                            />
                                            <datalist id="textModels">
                                                {SUGGESTED_MODELS.text.map(m => <option key={m} value={m} />)}
                                            </datalist>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.imageModel}</label>
                                            <input 
                                                list="imageModels"
                                                type="text" 
                                                value={draftModel.imageModel || ''} 
                                                onChange={(e) => updateDraft({ imageModel: e.target.value })}
                                                className="w-full bg-card border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                                            />
                                            <datalist id="imageModels">
                                                {SUGGESTED_MODELS.image.map(m => <option key={m} value={m} />)}
                                            </datalist>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.videoModel}</label>
                                            <input 
                                                list="videoModels"
                                                type="text" 
                                                value={draftModel.videoModel || ''} 
                                                onChange={(e) => updateDraft({ videoModel: e.target.value })}
                                                className="w-full bg-card border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                                            />
                                            <datalist id="videoModels">
                                                {SUGGESTED_MODELS.video.map(m => <option key={m} value={m} />)}
                                            </datalist>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.apiKey}</label>
                                            <input 
                                                type="password" 
                                                value={draftModel.apiKey || ''} 
                                                onChange={(e) => updateDraft({ apiKey: e.target.value })}
                                                placeholder={draftModel.provider === 'ollama' ? 'Optional' : 'sk-...'}
                                                className="w-full bg-card border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                                            />
                                        </div>

                                        {draftModel.provider !== 'google' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.baseUrl}</label>
                                                <input 
                                                    type="text" 
                                                    value={draftModel.baseUrl || ''} 
                                                    onChange={(e) => updateDraft({ baseUrl: e.target.value })}
                                                    placeholder="https://api.example.com/v1"
                                                    className="w-full bg-card border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Inference Parameters */}
                                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                                        <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                            {txt.inferenceParams}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                                                    {txt.temperature}
                                                    <span className="text-white">{draftModel.inferenceConfig?.temperature}</span>
                                                </label>
                                                <input 
                                                    type="range" min="0" max="2" step="0.1"
                                                    value={draftModel.inferenceConfig?.temperature ?? 0.7}
                                                    onChange={(e) => updateInference({ temperature: parseFloat(e.target.value) })}
                                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                                                    {txt.topP}
                                                    <span className="text-white">{draftModel.inferenceConfig?.topP}</span>
                                                </label>
                                                <input 
                                                    type="range" min="0" max="1" step="0.05"
                                                    value={draftModel.inferenceConfig?.topP ?? 0.9}
                                                    onChange={(e) => updateInference({ topP: parseFloat(e.target.value) })}
                                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.maxTokens}</label>
                                                <input 
                                                    type="number" 
                                                    value={draftModel.inferenceConfig?.maxTokens ?? 2048}
                                                    onChange={(e) => updateInference({ maxTokens: parseInt(e.target.value) })}
                                                    className="w-full bg-card border border-slate-600 rounded-lg p-2 text-white focus:border-primary outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Test Connection */}
                                    <div className="pt-4">
                                        <button 
                                            onClick={handleTestConnection}
                                            disabled={isTesting}
                                            className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border
                                                ${testResult === 'success' ? 'bg-green-900/20 border-green-500 text-green-400' : 
                                                  testResult === 'error' ? 'bg-red-900/20 border-red-500 text-red-400' : 
                                                  'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}
                                            `}
                                        >
                                            {isTesting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    {txt.testing}
                                                </>
                                            ) : testResult === 'success' ? (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    {txt.testSuccess}
                                                </>
                                            ) : testResult === 'error' ? (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    {txt.testFailed}
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    {txt.testConnection}
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="h-12"></div> {/* Spacer */}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500">
                                Select a model to edit
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
