

export interface Settings {

}

export async function getSettings() {
    const defaultSettings: Settings = {

    };
    const storedSettings = await chrome.storage.local.get();
    return { ...defaultSettings, ...storedSettings };
}

export async function saveSettings(settings: Settings) {
    await chrome.storage.local.set(settings);
}