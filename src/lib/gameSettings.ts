import { useSettingsStore } from "../store/settingsStore";

/**
 * Type definition for API game settings response
 * All fields are optional since the API may not return all settings
 */
export type ApiGameSettings = {
  showBudget?: boolean;
  debugMode?: boolean;
  enableModifiers?: boolean;
  experimentMode?: boolean;
  dilemmasSubjectEnabled?: boolean;
  dilemmasSubject?: string;
  treatment?: 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy';
  generateImages?: boolean;
  narrationEnabled?: boolean;
  useLightDilemmaAnthropic?: boolean;
  musicEnabled?: boolean;
  musicVolume?: number;
  sfxEnabled?: boolean;
  sfxVolume?: number;
  [key: string]: unknown; // Allow additional fields from API
};

/**
 * Maps API game settings response to Zustand store
 * Handles both camelCase (new format) and PascalCase (API format) field names
 * Only updates fields that exist in the API response (safe, doesn't overwrite with undefined)
 * Also updates the persist storage so Zustand will use the new values on next load
 */
export const applyGameSettingsToStore = (apiSettings: ApiGameSettings | Record<string, unknown>) => {
  const store = useSettingsStore.getState();
  
  // Track if any settings were actually applied
  let settingsApplied = false;

  // Helper function to get value from API (supports both camelCase and PascalCase)
  const getApiValue = (camelName: string, pascalName: string): unknown => {
    return (apiSettings as Record<string, unknown>)[camelName] ?? (apiSettings as Record<string, unknown>)[pascalName];
  };

  // Map API fields to store setters (only if value exists in API response)
  // Try both camelCase (new format) and PascalCase (API format)
  const showBudgetValue = getApiValue('showBudget', 'BudgetSystem');
  if (typeof showBudgetValue === 'boolean') {
    store.setShowBudget(showBudgetValue);
    settingsApplied = true;
  }

  const debugModeValue = getApiValue('debugMode', 'DebugMode');
  if (typeof debugModeValue === 'boolean') {
    store.setDebugMode(debugModeValue);
    settingsApplied = true;
  }

  const enableModifiersValue = getApiValue('enableModifiers', 'EnableModifiers');
  if (typeof enableModifiersValue === 'boolean') {
    store.setEnableModifiers(enableModifiersValue);
    settingsApplied = true;
  }

  const experimentModeValue = getApiValue('experimentMode', 'ExperimentMode');
  if (typeof experimentModeValue === 'boolean') {
    store.setExperimentMode(experimentModeValue);
    settingsApplied = true;
  }

  const dilemmasSubjectEnabledValue = getApiValue('dilemmasSubjectEnabled', 'DilemmasSubjectEnabled');
  if (typeof dilemmasSubjectEnabledValue === 'boolean') {
    store.setDilemmasSubjectEnabled(dilemmasSubjectEnabledValue);
    settingsApplied = true;
  }

  const dilemmasSubjectValue = getApiValue('dilemmasSubject', 'DilemmasSubjectText');
  if (typeof dilemmasSubjectValue === 'string' && dilemmasSubjectValue.trim()) {
    store.setDilemmasSubject(dilemmasSubjectValue);
    settingsApplied = true;
  }

  const treatmentValue = getApiValue('treatment', 'Treatment');
  if (typeof treatmentValue === 'string' && 
      ['fullAutonomy', 'semiAutonomy', 'noAutonomy'].includes(treatmentValue)) {
    store.setTreatment(treatmentValue as 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy');
    settingsApplied = true;
  }

  const generateImagesValue = getApiValue('generateImages', 'ImageGeneration');
  if (typeof generateImagesValue === 'boolean') {
    store.setGenerateImages(generateImagesValue);
    settingsApplied = true;
  }

  const narrationEnabledValue = getApiValue('narrationEnabled', 'NarrationVoiceover');
  if (typeof narrationEnabledValue === 'boolean') {
    store.setNarrationEnabled(narrationEnabledValue);
    settingsApplied = true;
  }

  const useLightDilemmaAnthropicValue = getApiValue('useLightDilemmaAnthropic', 'UseLightDilemmaAnthropic');
  if (typeof useLightDilemmaAnthropicValue === 'boolean') {
    store.setUseLightDilemmaAnthropic(useLightDilemmaAnthropicValue);
    settingsApplied = true;
  }

  const musicEnabledValue = getApiValue('musicEnabled', 'MusicEnabled');
  if (typeof musicEnabledValue === 'boolean') {
    store.setMusicEnabled(musicEnabledValue);
    settingsApplied = true;
  }

  const musicVolumeValue = getApiValue('musicVolume', 'MusicVolume');
  if (typeof musicVolumeValue === 'number' && musicVolumeValue >= 0 && musicVolumeValue <= 1) {
    store.setMusicVolume(musicVolumeValue);
    settingsApplied = true;
  }

  const sfxEnabledValue = getApiValue('sfxEnabled', 'SfxEnabled');
  if (typeof sfxEnabledValue === 'boolean') {
    store.setSfxEnabled(sfxEnabledValue);
    settingsApplied = true;
  }

  const sfxVolumeValue = getApiValue('sfxVolume', 'SfxVolume');
  if (typeof sfxVolumeValue === 'number' && sfxVolumeValue >= 0 && sfxVolumeValue <= 1) {
    store.setSfxVolume(sfxVolumeValue);
    settingsApplied = true;
  }

  // Force Zustand persist to save the updated state
  // This ensures the settings persist across page reloads
  if (settingsApplied) {
    // Manually update the persist storage to match Zustand's format
    // Zustand persist uses the key "settings-v14" and stores a JSON object with "state" property
    try {
      const currentState = useSettingsStore.getState();
      const persistKey = 'settings-v14';
      const persistData = {
        state: {
          generateImages: currentState.generateImages,
          narrationEnabled: currentState.narrationEnabled,
          narrationVoice: currentState.narrationVoice,
          showBudget: currentState.showBudget,
          debugMode: currentState.debugMode,
          dilemmasSubjectEnabled: currentState.dilemmasSubjectEnabled,
          dilemmasSubject: currentState.dilemmasSubject,
          enableModifiers: currentState.enableModifiers,
          useLightDilemmaAnthropic: currentState.useLightDilemmaAnthropic,
          narrationMutedInGame: currentState.narrationMutedInGame,
          musicEnabled: currentState.musicEnabled,
          musicVolume: currentState.musicVolume,
          sfxEnabled: currentState.sfxEnabled,
          sfxVolume: currentState.sfxVolume,
          skipPreviousContext: currentState.skipPreviousContext,
          treatment: currentState.treatment,
          experimentMode: currentState.experimentMode,
        },
        version: 0, // Zustand persist version
      };
      localStorage.setItem(persistKey, JSON.stringify(persistData));
    } catch (error) {
      console.error('[gameSettings] Failed to update persist storage:', error);
    }
  }
};

/**
 * Fetches game settings from API and applies them to both localStorage and Zustand store
 */
export const fetchAndStoreGameSettings = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const researcherId = urlParams.get('rid') || '10';

  try {
    const url = 'https://democracygame-backend.onrender.com';
    const response = await fetch(`${url}/api/gameSettings/getGameSettings?researcherId=${researcherId}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const settings = await response.json();
    if (settings.success) {
      // Store in localStorage (for backwards compatibility / debugging)
      localStorage.setItem('gameSettings', JSON.stringify(settings.data));
      
      // Apply to Zustand store (this is what the game actually uses)
      applyGameSettingsToStore(settings.data);
    } else {
      console.error('[gameSettings] Failed to fetch game settings:', settings.message);
    }
  } catch (error) {
    console.error('[gameSettings] Error fetching or storing game settings:', error);
    
    // Fallback: Try to load from localStorage if API fails
    try {
      const cachedSettings = localStorage.getItem('gameSettings');
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings) as ApiGameSettings;
        applyGameSettingsToStore(parsed);
      }
    } catch (localStorageError) {
      console.error('[gameSettings] Failed to load from localStorage:', localStorageError);
    }
  }
};

/**
 * Loads game settings from localStorage and updates Zustand persist storage directly
 * This is called BEFORE the store is initialized, so we update the persist storage
 * that Zustand will read when it initializes
 */
export const loadGameSettingsFromLocalStorage = () => {
  try {
    const cachedSettings = localStorage.getItem('gameSettings');
    
    if (cachedSettings) {
      const parsed = JSON.parse(cachedSettings) as ApiGameSettings;
      
      // Update Zustand persist storage directly (before store is initialized)
      // This ensures Zustand will load the correct values when it initializes
      const persistKey = 'settings-v14';
      const existingPersist = localStorage.getItem(persistKey);
      type PersistData = { state: Record<string, unknown>; version: number };
      let persistData: PersistData = { state: {}, version: 0 };
      
      if (existingPersist) {
        try {
          persistData = JSON.parse(existingPersist) as PersistData;
        } catch {
          console.warn('[gameSettings] Failed to parse existing persist data, creating new');
        }
      }
      
      // Helper function to get value from API (supports both camelCase and PascalCase)
      const getApiValue = (camelName: string, pascalName: string): unknown => {
        return (parsed as Record<string, unknown>)[camelName] ?? (parsed as Record<string, unknown>)[pascalName];
      };
      
      // Update only the fields that exist in the API settings (try both camelCase and PascalCase)
      const showBudgetValue = getApiValue('showBudget', 'BudgetSystem');
      if (typeof showBudgetValue === 'boolean') persistData.state.showBudget = showBudgetValue;
      
      const debugModeValue = getApiValue('debugMode', 'DebugMode');
      if (typeof debugModeValue === 'boolean') persistData.state.debugMode = debugModeValue;
      
      const enableModifiersValue = getApiValue('enableModifiers', 'EnableModifiers');
      if (typeof enableModifiersValue === 'boolean') persistData.state.enableModifiers = enableModifiersValue;
      
      const experimentModeValue = getApiValue('experimentMode', 'ExperimentMode');
      if (typeof experimentModeValue === 'boolean') persistData.state.experimentMode = experimentModeValue;
      
      const dilemmasSubjectEnabledValue = getApiValue('dilemmasSubjectEnabled', 'DilemmasSubjectEnabled');
      if (typeof dilemmasSubjectEnabledValue === 'boolean') persistData.state.dilemmasSubjectEnabled = dilemmasSubjectEnabledValue;
      
      const dilemmasSubjectValue = getApiValue('dilemmasSubject', 'DilemmasSubjectText');
      if (typeof dilemmasSubjectValue === 'string' && dilemmasSubjectValue.trim()) persistData.state.dilemmasSubject = dilemmasSubjectValue;
      
      const treatmentValue = getApiValue('treatment', 'Treatment');
      if (typeof treatmentValue === 'string' && ['fullAutonomy', 'semiAutonomy', 'noAutonomy'].includes(treatmentValue)) {
        persistData.state.treatment = treatmentValue;
      }
      
      const generateImagesValue = getApiValue('generateImages', 'ImageGeneration');
      if (typeof generateImagesValue === 'boolean') persistData.state.generateImages = generateImagesValue;
      
      const narrationEnabledValue = getApiValue('narrationEnabled', 'NarrationVoiceover');
      if (typeof narrationEnabledValue === 'boolean') persistData.state.narrationEnabled = narrationEnabledValue;
      
      const useLightDilemmaAnthropicValue = getApiValue('useLightDilemmaAnthropic', 'UseLightDilemmaAnthropic');
      if (typeof useLightDilemmaAnthropicValue === 'boolean') persistData.state.useLightDilemmaAnthropic = useLightDilemmaAnthropicValue;
      
      const musicEnabledValue = getApiValue('musicEnabled', 'MusicEnabled');
      if (typeof musicEnabledValue === 'boolean') persistData.state.musicEnabled = musicEnabledValue;
      
      const musicVolumeValue = getApiValue('musicVolume', 'MusicVolume');
      if (typeof musicVolumeValue === 'number' && musicVolumeValue >= 0 && musicVolumeValue <= 1) persistData.state.musicVolume = musicVolumeValue;
      
      const sfxEnabledValue = getApiValue('sfxEnabled', 'SfxEnabled');
      if (typeof sfxEnabledValue === 'boolean') persistData.state.sfxEnabled = sfxEnabledValue;
      
      const sfxVolumeValue = getApiValue('sfxVolume', 'SfxVolume');
      if (typeof sfxVolumeValue === 'number' && sfxVolumeValue >= 0 && sfxVolumeValue <= 1) persistData.state.sfxVolume = sfxVolumeValue;
      
      localStorage.setItem(persistKey, JSON.stringify(persistData));
      
      // Also apply to store if it's already initialized (for immediate effect)
      try {
        applyGameSettingsToStore(parsed);
      } catch {
        // Store not initialized yet, that's OK - persist storage is updated
      }
      
      return true;
    }
  } catch (error) {
    console.error('[gameSettings] Failed to load from localStorage:', error);
  }
  return false;
};
