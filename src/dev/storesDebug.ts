// src/dev/storesDebug.ts
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";

type StoresSnapshot = {
  role: {
    selectedRole: string | null;
    analysis: ReturnType<typeof useRoleStore.getState>["analysis"];
    character: ReturnType<typeof useRoleStore.getState>["character"];
  };
  compass: ReturnType<typeof useCompassStore.getState>["values"];
  settings: { generateImages: boolean };
};

function formatCompass(values: ReturnType<typeof useCompassStore.getState>["values"]) {
  // Makes a row-per-quadrant record so console.table is nice
  return {
    what: [...values.what],
    whence: [...values.whence],
    how: [...values.how],
    whither: [...values.whither],
  };
}

export function attachStoresDebug() {
  const g = window as any;

  g.debugStores = (): StoresSnapshot => {
    const r = useRoleStore.getState();
    const c = useCompassStore.getState();
    const s = useSettingsStore.getState();

    const snap: StoresSnapshot = {
      role: {
        selectedRole: r.selectedRole,
        analysis: r.analysis,
        character: r.character,
      },
      compass: c.values,
      settings: { generateImages: s.generateImages },
    };

    console.groupCollapsed(
      "%c[stores] snapshot",
      "color:#facc15;font-weight:bold;padding:2px 4px;border-radius:4px;background:#3b3b;"
    );
    console.table({ selectedRole: snap.role.selectedRole, generateImages: snap.settings.generateImages });
    console.log("analysis →", snap.role.analysis);
    console.log("character →", snap.role.character);
    console.log("compass (rows: quadrants, 10 cols each) →");
    console.table(formatCompass(snap.compass));
    console.groupEnd();

    return snap;
  };

  // Convenience setters/tweakers
  g.setRoleStore = (partial: Partial<ReturnType<typeof useRoleStore.getState>>) => {
    useRoleStore.setState(prev => ({ ...prev, ...partial }));
  };
  g.resetRoleStore = () => useRoleStore.getState().reset();

  g.setCompassValue = (prop: "what"|"whence"|"how"|"whither", idx: number, value: number) =>
    useCompassStore.getState().setValue(prop, idx, value);
  g.bumpCompass = (prop: "what"|"whence"|"how"|"whither", idx: number, delta: number) =>
    useCompassStore.getState().applyEffects([{ prop, idx, delta }]);
  g.resetCompass = () => useCompassStore.getState().reset();

  g.setSettings = (partial: Partial<{ generateImages: boolean }>) =>
    useSettingsStore.setState(prev => ({ ...prev, ...partial }));

  g.resetAllStores = () => {
    useRoleStore.getState().reset();
    useCompassStore.getState().reset();
    // settings is persisted; if you want to clear it too:
    // localStorage.removeItem("settings-v1");
  };

  console.info("%c[stores] debug helpers attached (debugStores, setRoleStore, resetRoleStore, setCompassValue, bumpCompass, resetCompass, setSettings, resetAllStores)",
    "color:#93c5fd");
}
