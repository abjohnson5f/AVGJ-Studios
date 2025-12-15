import React, { useState, useRef, useEffect } from 'react';
import { Project, Scene, Asset, GenerationType } from '../types';
import { generateImageFromText, generateImageFromImage, generateVideo, checkApiKeySelection, openApiKeySelection, enhancePrompt } from '../services/geminiService';
import { IconSparkles, IconLoader, IconImage, IconVideo, IconPlus } from '../constants';

interface GeneratorProps {
  projects: Project[];
  scenes: Scene[];
  assets: Asset[];
  initialProjectId?: string;
  initialSceneId?: string;
  initialImage?: string; // Optional input for Image-to-Video or Image-to-Image
  initialMode?: GenerationType;
  initialPrompt?: string; // Optional initial text (e.g. for Video scripts)
  onSaveAsset: (asset: Omit<Asset, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

const Generator: React.FC<GeneratorProps> = ({ projects, scenes, assets, initialProjectId, initialSceneId, initialImage, initialMode, initialPrompt, onSaveAsset, onClose }) => {
  const [activeTab, setActiveTab] = useState<GenerationType>(initialMode || GenerationType.TEXT_TO_IMAGE);
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Config State
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1K");
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [isJsonMode, setIsJsonMode] = useState(false);

  // Selection State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedSceneId, setSelectedSceneId] = useState<string>(initialSceneId || '');
  
  // I2I State - now supports multiple images (up to 5)
  // For Video generation, we only use the first one as the 'seed' image
  const [referenceImages, setReferenceImages] = useState<string[]>(initialImage ? [initialImage] : []);

  // Auth/Key State
  const [hasPaidKey, setHasPaidKey] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter scenes based on project
  const filteredScenes = scenes.filter(s => s.projectId === selectedProjectId);
  
  // Filter available assets for reference from the selected scene
  const sceneAssets = assets.filter(a => a.sceneId === selectedSceneId && a.type === 'image');

  // Check key requirements when tab or resolution changes
  useEffect(() => {
    checkKeyRequirements();
  }, [activeTab, resolution]);

  const checkKeyRequirements = async () => {
    // Veo or High Res Image requires paid key check
    const needsPaidKey = activeTab === GenerationType.TEXT_TO_VIDEO || resolution === '2K' || resolution === '4K';
    
    if (needsPaidKey) {
        const hasKey = await checkApiKeySelection();
        setHasPaidKey(hasKey);
    } else {
        setHasPaidKey(true);
    }
  };

  const handleSelectKey = async () => {
      await openApiKeySelection();
      setHasPaidKey(true); // Optimistic update, re-check happens in generation
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
          if (referenceImages.length >= 5) return; // Limit to 5
          const reader = new FileReader();
          reader.onloadend = () => {
            setReferenceImages(prev => [...prev, reader.result as string].slice(0, 5));
          };
          reader.readAsDataURL(file as Blob);
      });
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSceneAsset = (assetUrl: string) => {
      if (referenceImages.includes(assetUrl)) {
          setReferenceImages(prev => prev.filter(url => url !== assetUrl));
      } else {
          if (referenceImages.length >= 5) return;
          setReferenceImages(prev => [...prev, assetUrl]);
      }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEnhancePrompt = async () => {
      if (!prompt) return;
      setIsEnhancing(true);
      try {
          // Pass 'video' if in video mode, otherwise 'image'
          const enhancementType = activeTab === GenerationType.TEXT_TO_VIDEO ? 'video' : 'image';
          const improved = await enhancePrompt(prompt, enhancementType);
          setPrompt(improved);
      } catch (e) {
          console.error("Failed to enhance prompt", e);
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);
    setResultUrls([]);
    setSelectedPreviewIndex(0);

    // Final key check before execution
    if ((activeTab === GenerationType.TEXT_TO_VIDEO || resolution === '2K' || resolution === '4K') && !hasPaidKey) {
        setIsGenerating(false);
        return;
    }

    try {
      let urls: string[] = [];
      if (activeTab === GenerationType.TEXT_TO_IMAGE) {
        urls = await generateImageFromText(prompt, { aspectRatio, resolution, numberOfImages });
      } else if (activeTab === GenerationType.IMAGE_TO_IMAGE) {
        if (referenceImages.length === 0) throw new Error("At least one reference image is required");
        urls = await generateImageFromImage(referenceImages, prompt, { aspectRatio, resolution, numberOfImages });
      } else if (activeTab === GenerationType.TEXT_TO_VIDEO) {
        // Pass the first reference image if it exists for Image-to-Video
        const seedImage = referenceImages.length > 0 ? referenceImages[0] : undefined;
        const url = await generateVideo(prompt, seedImage);
        urls = [url];
      }
      setResultUrls(urls);
    } catch (err: any) {
      setError(err.message || "Generation failed");
      if (err.message && err.message.includes("Requested entity was not found")) {
         setHasPaidKey(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (resultUrls.length === 0 || !selectedProjectId || !selectedSceneId) return;
    
    const urlToSave = resultUrls[selectedPreviewIndex];

    onSaveAsset({
      projectId: selectedProjectId,
      sceneId: selectedSceneId,
      type: activeTab === GenerationType.TEXT_TO_VIDEO ? 'video' : 'image',
      url: urlToSave,
      prompt: prompt,
    });
  };

  const handleSaveAll = () => {
      if (resultUrls.length === 0 || !selectedProjectId || !selectedSceneId) return;
      
      resultUrls.forEach(url => {
        onSaveAsset({
            projectId: selectedProjectId,
            sceneId: selectedSceneId,
            type: activeTab === GenerationType.TEXT_TO_VIDEO ? 'video' : 'image',
            url: url,
            prompt: prompt,
        });
      });
      setResultUrls([]);
      setPrompt('');
  };

  const toggleJsonMode = () => {
      setIsJsonMode(!isJsonMode);
      if (!isJsonMode && !prompt) {
          setPrompt('{\n  "subject": "Cyberpunk city street",\n  "lighting": "Neon",\n  "mood": "Rainy"\n}');
      }
  };

  const currentResultUrl = resultUrls[selectedPreviewIndex];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border p-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <IconSparkles className="text-primary" /> AI Studio
        </h2>
        <button onClick={onClose} className="text-textMuted hover:text-white">Close</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Control Panel */}
        <div className="w-1/3 border-r border-border p-6 overflow-y-auto">
          {/* Mode Selection */}
          <div className="flex gap-2 mb-6">
            <button 
              onClick={() => setActiveTab(GenerationType.TEXT_TO_IMAGE)}
              className={`flex-1 py-2 text-sm rounded-md border ${activeTab === GenerationType.TEXT_TO_IMAGE ? 'bg-primary border-primary text-white' : 'border-border text-textMuted hover:border-gray-600'}`}
            >
              Txt to Img
            </button>
            <button 
              onClick={() => setActiveTab(GenerationType.IMAGE_TO_IMAGE)}
              className={`flex-1 py-2 text-sm rounded-md border ${activeTab === GenerationType.IMAGE_TO_IMAGE ? 'bg-primary border-primary text-white' : 'border-border text-textMuted hover:border-gray-600'}`}
            >
              Img to Img
            </button>
            <button 
              onClick={() => setActiveTab(GenerationType.TEXT_TO_VIDEO)}
              className={`flex-1 py-2 text-sm rounded-md border ${activeTab === GenerationType.TEXT_TO_VIDEO ? 'bg-primary border-primary text-white' : 'border-border text-textMuted hover:border-gray-600'}`}
            >
              Video
            </button>
          </div>

          {/* Project/Scene Selection */}
          <div className="space-y-4 mb-6 p-4 bg-surface rounded-lg border border-border">
            <h3 className="text-sm font-medium text-textMuted">Destination</h3>
            <div className="grid grid-cols-2 gap-2">
                <div>
                <label className="block text-xs mb-1 text-gray-400">Project</label>
                <select 
                    value={selectedProjectId}
                    onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setSelectedSceneId('');
                    }}
                    className="w-full bg-background border border-border rounded px-2 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                    <option value="">Select Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                </div>
                <div>
                <label className="block text-xs mb-1 text-gray-400">Scene</label>
                <select 
                    value={selectedSceneId}
                    onChange={(e) => setSelectedSceneId(e.target.value)}
                    disabled={!selectedProjectId}
                    className="w-full bg-background border border-border rounded px-2 py-2 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-50"
                >
                    <option value="">Select Scene</option>
                    {filteredScenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                </div>
            </div>
          </div>

          {/* Configuration */}
          {activeTab !== GenerationType.TEXT_TO_VIDEO && (
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-400">Aspect Ratio</label>
                    <select 
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full bg-surface border border-border rounded px-2 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    >
                        <option value="1:1">1:1</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="4:3">4:3</option>
                        <option value="3:4">3:4</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-400">Resolution</label>
                    <select 
                        value={resolution} 
                        onChange={(e) => setResolution(e.target.value)}
                        className="w-full bg-surface border border-border rounded px-2 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2 text-gray-400">Batch Size</label>
                    <div className="flex gap-2">
                       {[1, 2, 3, 4].map(num => (
                           <button
                             key={num}
                             onClick={() => setNumberOfImages(num)}
                             className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${numberOfImages === num ? 'bg-primary border-primary text-white' : 'border-border text-textMuted hover:border-gray-600 hover:text-white'}`}
                           >
                             {num}
                           </button>
                       ))}
                    </div>
                </div>
            </div>
          )}

          {/* Inputs */}
          <div className="space-y-4">
            {/* Reference Images: Show for Img2Img AND Video (Veo supports image input) */}
            {(activeTab === GenerationType.IMAGE_TO_IMAGE || activeTab === GenerationType.TEXT_TO_VIDEO) && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                    {activeTab === GenerationType.TEXT_TO_VIDEO ? "Reference Image (Optional)" : "Reference Images (Max 5)"}
                </label>
                
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                    {referenceImages.map((img, idx) => (
                        <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden border border-border group">
                            <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                            <button 
                                onClick={() => removeReferenceImage(idx)}
                                className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                    ))}
                    {/* Limit to 1 for Video, 5 for Img2Img */}
                    {((activeTab === GenerationType.TEXT_TO_VIDEO && referenceImages.length < 1) || 
                      (activeTab === GenerationType.IMAGE_TO_IMAGE && referenceImages.length < 5)) && (
                         <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer border-2 border-dashed border-border rounded w-20 h-20 flex-shrink-0 flex flex-col items-center justify-center hover:border-primary transition-colors"
                         >
                            <IconPlus className="text-textMuted" />
                            <span className="text-[10px] text-textMuted mt-1">Upload</span>
                         </div>
                    )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  multiple={activeTab !== GenerationType.TEXT_TO_VIDEO}
                  className="hidden" 
                />

                {/* Scene Assets Selector */}
                {selectedSceneId && sceneAssets.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                        <label className="block text-xs font-medium mb-2 text-gray-400 uppercase tracking-wider">Select from {scenes.find(s => s.id === selectedSceneId)?.name}</label>
                        <div className="grid grid-cols-4 gap-2">
                            {sceneAssets.map(asset => {
                                const isSelected = referenceImages.includes(asset.url);
                                const maxLimit = activeTab === GenerationType.TEXT_TO_VIDEO ? 1 : 5;
                                const isDisabled = !isSelected && referenceImages.length >= maxLimit;
                                return (
                                  <div 
                                    key={asset.id}
                                    onClick={() => !isDisabled && toggleSceneAsset(asset.url)}
                                    className={`relative aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-transparent hover:border-gray-600'} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  >
                                      <img src={asset.url} className="w-full h-full object-cover" />
                                      {isSelected && (
                                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                              <div className="bg-primary text-white rounded-full p-0.5">
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                                );
                            })}
                        </div>
                    </div>
                )}
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Prompt</label>
                <div className="flex gap-2">
                    <button 
                        onClick={handleEnhancePrompt}
                        disabled={!prompt || isEnhancing}
                        className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${isEnhancing ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'border-purple-500/50 text-purple-300 hover:bg-purple-900/30'}`}
                    >
                         <IconSparkles className="w-3 h-3" />
                         {isEnhancing ? "Enhancing..." : "Magic Enhance"}
                    </button>
                    <button 
                        onClick={toggleJsonMode}
                        className={`text-xs px-2 py-1 rounded border ${isJsonMode ? 'bg-primary border-primary text-white' : 'border-border text-textMuted'}`}
                    >
                        JSON
                    </button>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isJsonMode ? '{\n  "description": "...",\n  "style": "..."\n}' : (activeTab === GenerationType.TEXT_TO_VIDEO ? "Describe the motion or enter your script here..." : "Describe the image...")}
                className={`w-full h-32 bg-surface border border-border rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary resize-none ${isJsonMode ? 'font-mono text-xs' : ''}`}
              />
            </div>
            
            {!hasPaidKey && (
                 <div className="bg-orange-900/20 border border-orange-500/50 rounded p-4 text-sm text-orange-200">
                    <p className="mb-2">
                        {activeTab === GenerationType.TEXT_TO_VIDEO ? "Veo video generation" : "High resolution image generation"} requires a paid API key.
                    </p>
                    <button 
                        onClick={handleSelectKey}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded w-full"
                    >
                        Select Paid API Key
                    </button>
                    <div className="mt-2 text-xs text-orange-400/70">
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-orange-300">View Billing Docs</a>
                    </div>
                 </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt || !hasPaidKey}
              className="w-full bg-primary hover:bg-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <IconLoader className="animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <IconSparkles /> Generate
                </>
              )}
            </button>
            
            {activeTab === GenerationType.TEXT_TO_VIDEO && isGenerating && (
                <p className="text-xs text-center text-textMuted animate-pulse">
                    Video generation may take 1-2 minutes. Please wait...
                </p>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 text-sm p-3 rounded">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Preview Panel */}
        <div className="w-2/3 bg-black flex flex-col items-center justify-center p-8 relative">
           <div className="absolute top-4 left-4 text-textMuted text-xs uppercase tracking-wider">Preview</div>
           
           {currentResultUrl ? (
             <div className="relative w-full h-full flex flex-col items-center justify-center">
               <div className="flex-1 flex items-center justify-center w-full min-h-0">
                  {activeTab === GenerationType.TEXT_TO_VIDEO ? (
                    <video src={currentResultUrl} controls className="max-h-full max-w-full rounded shadow-2xl border border-gray-800" />
                  ) : (
                    <img src={currentResultUrl} alt="Generated" className="max-h-full max-w-full rounded shadow-2xl border border-gray-800 object-contain" />
                  )}
               </div>

               {/* Multiple Images Selector */}
               {resultUrls.length > 1 && (
                 <div className="h-24 mt-4 flex gap-3 overflow-x-auto max-w-full px-4 items-center">
                    {resultUrls.map((url, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedPreviewIndex(idx)}
                        className={`aspect-square h-20 flex-shrink-0 cursor-pointer rounded-md overflow-hidden border-2 transition-all hover:scale-105 ${selectedPreviewIndex === idx ? 'border-primary ring-2 ring-primary/50' : 'border-gray-700 opacity-70 hover:opacity-100'}`}
                      >
                         <img src={url} className="w-full h-full object-cover" />
                      </div>
                    ))}
                 </div>
               )}
               
               <div className="mt-6 flex gap-3 flex-shrink-0">
                 <button 
                   onClick={handleSave}
                   disabled={!selectedSceneId}
                   className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded-full font-medium shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
                 >
                   {selectedSceneId ? "Save Selected" : "Select Scene to Save"}
                 </button>
                 
                 {resultUrls.length > 1 && (
                     <button 
                       onClick={handleSaveAll}
                       disabled={!selectedSceneId}
                       className="bg-surface border border-border hover:bg-surfaceHighlight disabled:opacity-50 text-white px-6 py-2 rounded-full font-medium shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
                     >
                       Save All ({resultUrls.length})
                     </button>
                 )}
               </div>
             </div>
           ) : (
             <div className="text-center text-gray-700">
               {activeTab === GenerationType.TEXT_TO_VIDEO ? <IconVideo className="w-24 h-24 mb-4 mx-auto opacity-20" /> : <IconImage className="w-24 h-24 mb-4 mx-auto opacity-20" />}
               <p className="text-xl font-medium">Ready to create</p>
               <p className="text-sm">Configure your settings and hit generate</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Generator;