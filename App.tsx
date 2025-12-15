import React, { useState, useEffect, useRef } from 'react';
import { Project, Scene, Asset, ViewState, GenerationType } from './types';
import { IconFolder, IconClapperboard, IconPlus, IconSparkles, IconArrowLeft, IconImage } from './constants';
import Generator from './components/Generator';

// Helper for safe ID generation
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if crypto.randomUUID fails
    }
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Mock data initialization
const loadInitialData = () => {
  try {
    const storedProjects = localStorage.getItem('sba_projects');
    const storedScenes = localStorage.getItem('sba_scenes');
    const storedAssets = localStorage.getItem('sba_assets');

    return {
      projects: storedProjects ? JSON.parse(storedProjects) : [],
      scenes: storedScenes ? JSON.parse(storedScenes) : [],
      assets: storedAssets ? JSON.parse(storedAssets) : []
    };
  } catch (e) {
    console.error("Failed to load initial data", e);
    return { projects: [], scenes: [], assets: [] };
  }
};

function App() {
  const [data, setData] = useState<{projects: Project[], scenes: Scene[], assets: Asset[]}>(loadInitialData);
  const [viewState, setViewState] = useState<ViewState>({ type: 'DASHBOARD' });

  // Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Upload State
  const [isDragging, setIsDragging] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Lightbox State
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem('sba_projects', JSON.stringify(data.projects));
      localStorage.setItem('sba_scenes', JSON.stringify(data.scenes));
      localStorage.setItem('sba_assets', JSON.stringify(data.assets));
    } catch (e) {
      console.error("Failed to save to localStorage (likely quota exceeded):", e);
    }
  }, [data]);

  // Focus input when modal opens
  useEffect(() => {
    if ((isProjectModalOpen || isSceneModalOpen) && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isProjectModalOpen, isSceneModalOpen]);

  // --- Actions ---

  const openProjectModal = () => {
    setNewItemName("");
    setIsProjectModalOpen(true);
  };

  const openSceneModal = () => {
    setNewItemName("");
    setIsSceneModalOpen(true);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    
    const newProject: Project = {
      id: generateId(),
      name: newItemName,
      description: "New unconfigured project",
      createdAt: Date.now()
    };
    setData(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
    setIsProjectModalOpen(false);
  };

  const handleCreateScene = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    if (viewState.type !== 'PROJECT_DETAILS') return;

    const newScene: Scene = {
      id: generateId(),
      projectId: viewState.projectId,
      name: newItemName,
      description: "Description of the scene...",
      sequenceOrder: data.scenes.filter(s => s.projectId === viewState.projectId).length + 1
    };
    setData(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
    setIsSceneModalOpen(false);
  };

  const saveGeneratedAsset = (assetData: Omit<Asset, 'id' | 'createdAt'>) => {
    const newAsset: Asset = {
      id: generateId(),
      createdAt: Date.now(),
      ...assetData
    };
    setData(prev => ({ ...prev, assets: [...prev.assets, newAsset] }));
    alert("Asset saved successfully!");
  };
  
  const handleDeleteAsset = (assetId: string) => {
    if (!window.confirm("Are you sure you want to delete this asset? This action cannot be undone.")) return;

    setData(prev => ({
        ...prev,
        assets: prev.assets.filter(a => a.id !== assetId)
    }));
    
    // If currently viewing this asset in lightbox, close it
    if (selectedAsset && selectedAsset.id === assetId) {
        setSelectedAsset(null);
    }
  };

  // --- File Upload Logic ---

  const processFiles = async (files: FileList) => {
    if (!files.length) return;
    if (viewState.type !== 'SCENE_DETAILS') return;

    const targetSceneId = viewState.sceneId;
    const targetProjectId = viewState.projectId;

    const fileArray = Array.from(files);
    const newAssets: Asset[] = [];

    await Promise.all(fileArray.map(async (file) => {
       if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;

       return new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
             if (typeof reader.result === 'string') {
               newAssets.push({
                 id: generateId(),
                 sceneId: targetSceneId,
                 projectId: targetProjectId,
                 type: file.type.startsWith('video/') ? 'video' : 'image',
                 url: reader.result,
                 prompt: file.name,
                 createdAt: Date.now()
               });
             }
             resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(file);
       });
    }));

    if (newAssets.length > 0) {
      setData(prev => ({ ...prev, assets: [...prev.assets, ...newAssets] }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (viewState.type === 'SCENE_DETAILS') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
        setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (viewState.type === 'SCENE_DETAILS' && e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  // --- Navigation Helpers ---

  const navigateToProject = (id: string) => setViewState({ type: 'PROJECT_DETAILS', projectId: id });
  const navigateToScene = (projectId: string, sceneId: string) => setViewState({ type: 'SCENE_DETAILS', projectId, sceneId });
  const navigateToDashboard = () => setViewState({ type: 'DASHBOARD' });
  
  // Updated to accept prompt
  const openGenerator = (projectId?: string, sceneId?: string, image?: string, mode?: GenerationType, prompt?: string) => 
    setViewState({ type: 'GENERATOR', projectId, sceneId, image, mode, prompt });

  const handleBack = () => {
    if (viewState.type === 'SCENE_DETAILS') {
      navigateToProject(viewState.projectId);
    } else {
      navigateToDashboard();
    }
  };
  
  const handleAnimateAsset = (asset: Asset) => {
      setSelectedAsset(null); // Close lightbox
      // Pass the asset prompt so it can be used as a script starting point
      openGenerator(asset.projectId, asset.sceneId, asset.url, GenerationType.TEXT_TO_VIDEO, asset.prompt);
  };

  // --- Views ---

  if (viewState.type === 'GENERATOR') {
    return (
      <Generator 
        projects={data.projects}
        scenes={data.scenes}
        assets={data.assets}
        initialProjectId={viewState.projectId}
        initialSceneId={viewState.sceneId}
        initialImage={'image' in viewState ? viewState.image : undefined}
        initialMode={'mode' in viewState ? viewState.mode : undefined}
        initialPrompt={'prompt' in viewState ? viewState.prompt : undefined}
        onSaveAsset={saveGeneratedAsset}
        onClose={() => {
           if (viewState.sceneId && viewState.projectId) {
               navigateToScene(viewState.projectId, viewState.sceneId);
           } else if (viewState.projectId) {
               navigateToProject(viewState.projectId);
           } else {
               navigateToDashboard();
           }
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-background text-textMain overflow-hidden relative">
      {/* Sidebar */}
      <div className="w-64 bg-surface border-r border-border flex flex-col z-20">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-3 h-3 bg-primary rounded-full"></span>
            StoryBoard AI
          </h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">Projects</div>
          {data.projects.map(p => (
            <button
              key={p.id}
              onClick={() => navigateToProject(p.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                viewState.type !== 'DASHBOARD' && 'projectId' in viewState && viewState.projectId === p.id 
                ? 'bg-surfaceHighlight text-white' 
                : 'text-textMuted hover:text-white hover:bg-white/5'
              }`}
            >
              <IconFolder className="w-4 h-4" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          
          <button 
            onClick={openProjectModal}
            className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primaryHover"
          >
            <IconPlus className="w-4 h-4" /> New Project
          </button>
        </nav>

        <div className="p-4 border-t border-border">
           <button 
            onClick={() => openGenerator()}
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primaryHover hover:to-purple-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-lg"
           >
             <IconSparkles className="w-4 h-4" />
             AI Studio
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center px-6 bg-surface/50 backdrop-blur-sm justify-between z-10 relative">
           <div className="flex items-center gap-4">
             {viewState.type !== 'DASHBOARD' && (
                <button onClick={handleBack} className="p-2 rounded-full hover:bg-white/10">
                  <IconArrowLeft className="w-5 h-5" />
                </button>
             )}
             
             <h2 className="text-xl font-semibold">
               {viewState.type === 'DASHBOARD' && "Dashboard"}
               {viewState.type === 'PROJECT_DETAILS' && data.projects.find(p => p.id === viewState.projectId)?.name}
               {viewState.type === 'SCENE_DETAILS' && (
                  <span className="flex items-center gap-2">
                     <span className="text-textMuted font-normal">{data.projects.find(p => p.id === viewState.projectId)?.name}</span>
                     <span className="text-textMuted">/</span>
                     {data.scenes.find(s => s.id === viewState.sceneId)?.name}
                  </span>
               )}
             </h2>
           </div>
        </header>

        {/* Content Body */}
        <main 
          className={`flex-1 overflow-y-auto p-8 relative transition-colors ${isDragging ? 'bg-white/5' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag Overlay */}
          {isDragging && viewState.type === 'SCENE_DETAILS' && (
            <div className="absolute inset-4 border-2 border-dashed border-primary rounded-xl flex items-center justify-center bg-black/50 backdrop-blur-sm z-30 pointer-events-none">
                <div className="text-white text-xl font-bold flex flex-col items-center animate-bounce">
                    <IconPlus className="w-12 h-12 mb-2" />
                    Drop files here to upload
                </div>
            </div>
          )}
          
          {/* DASHBOARD VIEW */}
          {viewState.type === 'DASHBOARD' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.projects.map(p => {
                 // Get project thumbnail (first asset of first scene)
                 const projectScenes = data.scenes.filter(s => s.projectId === p.id);
                 const firstScene = projectScenes[0];
                 const thumbnailAsset = firstScene ? data.assets.find(a => a.sceneId === firstScene.id) : null;
                 
                 return (
                  <div key={p.id} onClick={() => navigateToProject(p.id)} className="group bg-surface border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary transition-all">
                    <div className="h-40 bg-black/40 flex items-center justify-center overflow-hidden relative">
                      {thumbnailAsset ? (
                        thumbnailAsset.type === 'video' ? (
                            <video src={thumbnailAsset.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                        ) : (
                            <img src={thumbnailAsset.url} alt="cover" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                        )
                      ) : (
                        <IconFolder className="w-12 h-12 text-gray-700" />
                      )}
                      <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                        {data.scenes.filter(s => s.projectId === p.id).length} Scenes
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg text-white mb-1">{p.name}</h3>
                      <p className="text-sm text-textMuted line-clamp-2">{p.description}</p>
                      <div className="mt-4 text-xs text-gray-500">Created {new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                 )
              })}
              
              <button onClick={openProjectModal} className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-textMuted hover:text-white hover:border-primary transition-colors min-h-[200px]">
                <IconPlus className="w-8 h-8 mb-2" />
                <span>Create Project</span>
              </button>
            </div>
          )}

          {/* PROJECT DETAILS VIEW */}
          {viewState.type === 'PROJECT_DETAILS' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-textMuted">Scenes</h3>
                <button onClick={openSceneModal} className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2">
                  <IconPlus className="w-4 h-4" /> Add Scene
                </button>
              </div>

              <div className="space-y-4">
                {data.scenes.filter(s => s.projectId === viewState.projectId).map(scene => {
                   const sceneAssets = data.assets.filter(a => a.sceneId === scene.id);
                   
                   return (
                    <div key={scene.id} onClick={() => navigateToScene(viewState.projectId, scene.id)} className="bg-surface border border-border rounded-lg p-4 hover:bg-surfaceHighlight cursor-pointer transition-colors flex gap-4">
                      <div className="w-48 h-28 bg-black/40 rounded flex-shrink-0 overflow-hidden flex items-center justify-center border border-white/5">
                        {sceneAssets.length > 0 ? (
                           sceneAssets[0].type === 'video' ? 
                           <video src={sceneAssets[0].url} className="w-full h-full object-cover" /> :
                           <img src={sceneAssets[0].url} className="w-full h-full object-cover" />
                        ) : (
                          <IconClapperboard className="text-gray-700" />
                        )}
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-start">
                           <h4 className="font-semibold text-white text-lg">{scene.name}</h4>
                           <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-400">{sceneAssets.length} Assets</span>
                         </div>
                         <p className="text-sm text-textMuted mt-1">{scene.description}</p>
                         <div className="mt-4 flex gap-2">
                           {sceneAssets.slice(0, 5).map(a => (
                             <div key={a.id} className="w-8 h-8 rounded overflow-hidden border border-white/10">
                               {a.type === 'image' ? <img src={a.url} className="w-full h-full object-cover"/> : <div className="bg-gray-800 w-full h-full"></div>}
                             </div>
                           ))}
                         </div>
                      </div>
                    </div>
                   )
                })}
                {data.scenes.filter(s => s.projectId === viewState.projectId).length === 0 && (
                   <div className="text-center py-20 text-textMuted">No scenes yet. Create one to get started.</div>
                )}
              </div>
            </div>
          )}

          {/* SCENE DETAILS VIEW */}
          {viewState.type === 'SCENE_DETAILS' && (
            <div>
               <div className="flex justify-between items-center mb-8">
                 <div>
                    <h1 className="text-3xl font-bold text-white">{data.scenes.find(s => s.id === viewState.sceneId)?.name}</h1>
                    <p className="text-textMuted mt-1">{data.scenes.find(s => s.id === viewState.sceneId)?.description}</p>
                 </div>
                 <div className="flex gap-3">
                   <input 
                     type="file" 
                     ref={uploadInputRef} 
                     className="hidden" 
                     multiple 
                     accept="image/*,video/*"
                     onChange={handleFileUpload} 
                   />
                   <button 
                    onClick={() => uploadInputRef.current?.click()}
                    className="bg-surface border border-border hover:bg-surfaceHighlight text-white px-4 py-2 rounded-lg flex items-center gap-2"
                   >
                     <IconImage className="w-4 h-4" />
                     Upload
                   </button>
                   <button 
                    onClick={() => openGenerator(viewState.projectId, viewState.sceneId)}
                    className="bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-primary/20"
                   >
                     <IconSparkles className="w-4 h-4" />
                     Generate
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                 {data.assets.filter(a => a.sceneId === viewState.sceneId).map(asset => (
                   <div 
                      key={asset.id} 
                      onClick={() => setSelectedAsset(asset)}
                      className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-border cursor-pointer"
                   >
                      {asset.type === 'video' ? (
                        <video src={asset.url} className="w-full h-full object-contain pointer-events-none" />
                      ) : (
                        <img src={asset.url} alt="asset" className="w-full h-full object-cover" />
                      )}
                      
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAsset(asset.id);
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-600/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                        title="Delete Asset"
                      >
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                        <p className="text-xs text-white line-clamp-2 italic">"{asset.prompt}"</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">{asset.type}</span>
                          <span className="text-[10px] text-gray-400">{new Date(asset.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
               
               {data.assets.filter(a => a.sceneId === viewState.sceneId).length === 0 && (
                 <div className="flex flex-col items-center justify-center py-24 text-textMuted border-2 border-dashed border-border rounded-xl">
                   <IconClapperboard className="w-16 h-16 mb-4 opacity-20" />
                   <p className="text-lg">This scene is empty</p>
                   <p className="text-sm">Generate assets or drag & drop files here</p>
                 </div>
               )}
            </div>
          )}

        </main>
      </div>

      {/* MODALS */}
      {(isProjectModalOpen || isSceneModalOpen) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={isProjectModalOpen ? handleCreateProject : handleCreateScene}
            className="bg-surface border border-border p-6 rounded-xl w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-semibold text-white mb-4">
              {isProjectModalOpen ? "Create New Project" : "Create New Scene"}
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
              <input 
                ref={inputRef}
                type="text" 
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={isProjectModalOpen ? "e.g. Summer Commercial" : "e.g. Scene 1 - Intro"}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => {
                  setIsProjectModalOpen(false);
                  setIsSceneModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-textMuted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={!newItemName.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primaryHover text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4">
           <button 
             onClick={() => setSelectedAsset(null)}
             className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors p-2"
           >
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
           </button>

           <div className="flex flex-col max-w-7xl w-full max-h-screen">
             <div className="flex-1 flex items-center justify-center overflow-hidden py-4">
               {selectedAsset.type === 'video' ? (
                 <video src={selectedAsset.url} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
               ) : (
                 <img src={selectedAsset.url} alt="Full view" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
               )}
             </div>
             
             <div className="h-20 flex justify-between items-center px-4 border-t border-white/10 mt-auto bg-surface/50 backdrop-blur-sm rounded-t-xl">
               <div className="max-w-3xl">
                 <p className="text-white text-sm font-medium line-clamp-1">{selectedAsset.prompt}</p>
                 <p className="text-textMuted text-xs mt-1">Generated {new Date(selectedAsset.createdAt).toLocaleString()}</p>
               </div>
               <div className="flex gap-3">
                   {/* ADDED: Animate button */}
                   {selectedAsset.type === 'image' && (
                     <button 
                       onClick={() => handleAnimateAsset(selectedAsset)}
                       className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-lg shadow-purple-900/50"
                     >
                       <IconSparkles className="w-4 h-4" />
                       Animate with Veo
                     </button>
                   )}

                   <button 
                     onClick={() => handleDeleteAsset(selectedAsset.id)}
                     className="bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors border border-red-600/50"
                   >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                     Delete
                   </button>
                   <a 
                     href={selectedAsset.url} 
                     download={`asset-${selectedAsset.id}.${selectedAsset.type === 'video' ? 'mp4' : 'png'}`}
                     className="bg-primary hover:bg-primaryHover text-white px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                     onClick={(e) => e.stopPropagation()}
                   >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                     Download
                   </a>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;