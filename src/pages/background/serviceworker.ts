import { invoke, checkAnkiNoteExists, addNoteToAnki, showAnkiNotes, } from "./anki_util";

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
}

const bufferToHex = (buffer: ArrayBuffer) => {
    const byteArray = new Uint8Array(buffer);
    return Array.from(byteArray)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

const hashBlob = async (blob: Blob) => {
    const arrayBuffer = await blobToArrayBuffer(blob);
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    return bufferToHex(hashBuffer);
}

const errorToString = (err: any) => {
    if (err == null) return "Unknown Error";
    return err.stack || err.toString();
}

const downloadVocabAudio = async (headword: string, reading: string) => {
    const missingAssetHash = "ae6398b5a27bc8c0a771df6c907ade794be15518174773c58c7c7ddd17098906";
    console.log(`Downloading ${headword}, ${reading}`)
    if (headword != reading) {
        const response = await fetch(`https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?kanji=${headword}&kana=${reading}`);
        if (response.ok) {
            const blob = await response.blob();
            const hash = await hashBlob(blob);
            if (hash != missingAssetHash) {
                return await blobToBase64(blob);
            }
        }
    }
    const response = await fetch(`https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?kana=${reading}`);
    if (response.ok) {
        const blob = await response.blob();
        const hash = await hashBlob(blob);
        if (hash != missingAssetHash) {
            return await blobToBase64(blob);
        }
    }
    return null;
}

const handleRequest = async (
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void) => {
    if (request.command == "download") {
        const response = await fetch(request.url);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        sendResponse(base64);
    }
    if (request.command == "download_vocab_audio") {
        const result = await downloadVocabAudio(request.headword, request.reading);
        sendResponse(result);
    }
    if (request.command == "anki_invoke") {
        //Used for debugging
        const response = await invoke(request.action, request.params || {});
        sendResponse(response);
    }
    if (request.command == "add_anki_note") {
        try {
            await addNoteToAnki(request);
            sendResponse({ error: null });
            return;
        }
        catch (err: any) {
            const response = { error: errorToString(err) };
            sendResponse(response);
            return;
        }
    }
    if (request.command == "anki_note_exists") {
        try {
            const result = await checkAnkiNoteExists(request.headword, request.reading);
            sendResponse({ result: result, error: null });
            return;
        }
        catch (err: any) {
            sendResponse({ result: null, error: errorToString(err) });
            return;
        }
    }
    if (request.command == "anki_show_notes") {
        try {
            await showAnkiNotes(request.headword, request.reading);
            sendResponse({ result: null, error: null });
            return;
        }
        catch (err: any) {
            sendResponse({ result: null, error: errorToString(err) });
            return;
        }
    }
    if (request.command == "get_article") {
        const getArticle = () => { return (window as any).articlePresenter.article; }
        try {
            const results = await chrome.scripting
                .executeScript({
                    target: { tabId: sender.tab!.id! },
                    world: "MAIN",
                    func: getArticle,
                })
            sendResponse({ result: results[0].result, error: null });
            return;
        } catch (err: any) {
            sendResponse({ result: null, error: errorToString(err) });
            return;
        }
    }
    if (request.command == "store_article") {
        const getArticle = () => { return (window as any).articlePresenter.article; }
        try {
            const results = await chrome.scripting
                .executeScript({
                    target: { tabId: sender.tab!.id! },
                    world: "MAIN",
                    func: getArticle,
                })
            await chrome.storage.local.set({ satoriArticle: results[0].result });
            sendResponse({ result: true, error: null });
            return;
        } catch (err: any) {
            sendResponse({ result: null, error: errorToString(err) });
            return;
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`Background onMessage`, request);
    handleRequest(request, sender, sendResponse);
    const commands = new Set([
        "download",
        "download_vocab_audio",
        "get_article",
        "store_article",
        "anki_invoke",
        "add_anki_note",
        "anki_note_exists",
        "anki_show_notes"]);
    if (commands.has(request.command)) {
        return true;
    }
});