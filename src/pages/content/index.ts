import { fetchAudioClip } from "./audio_util";
import * as wanakana from 'wanakana';


function makeid(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const createAnkiButton = (text: string) => {
  const ankiButton = document.createElement("span");
  ankiButton.className = "tooltip-button tooltip-button-active anki-button";
  const ankiIcon = document.createElement("span");
  ankiIcon.className = "tooltip-icon tooltip-icon-add";
  ankiButton.appendChild(ankiIcon);
  const ankiText = document.createElement("span");
  ankiText.className = "text";
  ankiText.textContent = text;
  ankiButton.appendChild(ankiText);
  return ankiButton;
}

const addAnkiNote = async (noteBody: HTMLSpanElement, readingNote: boolean) => {
  console.time('addAnkiNote');
  try {
    const headword = Array.from(noteBody.querySelectorAll(".expression span.wpt"))
      .map(e => e.textContent)
      .join("");
    const reading = Array.from(noteBody.querySelectorAll(".expression span.wpr"))
      .map(e => e.textContent)
      .join("");
    let furigana = Array.from(noteBody.querySelectorAll(".expression span.wp"))
      .map(e => [e.querySelector(".wpt")!.textContent, e.querySelector(".wpr")!.textContent])
      .map(([kanji, reading]) => kanji == reading ? kanji : ` ${kanji}[${reading}]`)
      .join("");
    const sentenceForm = Array.from(document.querySelectorAll(".word-selected span.wpt"))
      .map(e => e.textContent)
      .join("");

    let vocabEntry = headword;
    if (readingNote) {
      vocabEntry = reading;
    }
    if (sentenceForm == wanakana.toKatakana(reading)) {
      vocabEntry = sentenceForm;
      furigana = sentenceForm;
    }

    const downloadAudioPromise = chrome.runtime.sendMessage({
      command: "download_vocab_audio",
      headword: headword,
      reading: reading
    });

    let senseContext = Array.from(noteBody.querySelectorAll(".sense.context"))
      .map(e => e.textContent?.replace(/ \[.*\]$/, ""))
      .map(text => `<span class="sense context">${text}</span>`)
      .join("<br/>");
    let senseNonContext = Array.from(noteBody.querySelectorAll(".sense.non-context"))
      .map(e => `<span class="sense non-context">${e.innerHTML}</span>`)
      .join("<br/>");

    let pos = Array.from(noteBody.querySelectorAll(".sense.context"))
      .map(e => e.textContent?.replace(/.* \[(.*)\]$|.*/, "$1"))
      .filter(t => t != "")
      .join(", ");
    pos = Array.from(new Set(pos.split(", "))).join(", ");

    const selectedWord = document.querySelector(".word-selected");
    const run = selectedWord?.parentElement;
    const selectedSentence = run?.parentElement;

    const sentenceFurigana = Array.from(selectedSentence!.querySelectorAll(".wp, .nw"))
      .map((e: any) => e.classList.contains("nw") ?
        [e.textContent, e.textContent] :
        [e.querySelector(".wpt").textContent, e.querySelector(".wpr").textContent])
      .map(([kanji, reading]) => kanji == reading ? kanji : ` ${kanji}[${reading}]`)
      .join("");

    const oftenKana = noteBody.querySelector(".kanji-kana-representation-message") != null;

    const expressionElement = noteBody.querySelector(".expression .article");
    const expressionId = expressionElement!.id.split("-")[1];

    console.time('get_article');
    const articleResponse = await chrome.runtime.sendMessage({ command: "store_article" });
    let { satoriArticle } = await chrome.storage.local.get(['satoriArticle']);
    await chrome.storage.local.set({ satoriArticle: null });
    console.timeEnd('get_article');

    if (articleResponse.error) {
      alert(articleResponse.error);
      return;
    }
    const article = satoriArticle as SatoriArticle;
    const note = article.notes.find((n) => n.expression?.id == expressionId);

    const sentences = article.paragraphs.flatMap((p) => p.sentences)
    const sentence = sentences.find(s => s.id == selectedSentence?.dataset.id)!;
    const sentenceNotes = article.notes
      .filter(n => n.discussion != null)
      .filter(n => sentence.noteIds.includes(n.id));
    const sentenceTranslation = sentenceNotes
      .map(n => n.discussion!)
      .map(t => t.replaceAll(/_(.+?)_/g, "<i>$1</i>"))
      .map(t => t.replaceAll(/\*(.+?)\*/g, "<b>$1</b>"))
      .join(" / ");

    const extraNoteIds = sentence.runs
      .flatMap(r => r.parts)
      .filter(w => w.noteIds != null)
      .flatMap(w => w.noteIds)
    const extraNotes = [...new Set(extraNoteIds)]
      .map(id => article.notesById["k_" + id])
      .filter(n => n.discussion != null && n.discussion != "")
      .filter(n => n.expression != null)
      .filter(n => n.type == 99);

    let expToString = (exp: SatoriExpression) =>
      exp.paragraphs
        .flatMap(p => p.sentences)
        .flatMap(s => s.runs)
        .flatMap(r => r.parts)
        .map(w => w.text ? w.text : w.parts?.map(m => m.text).join(""))
        .join("");
    let getSpecial = (id: string) => {
      let special = article.special.find(s => s.id == id)!;
      return `<span class="example-sentence">${expToString(special.japanese)}<br>${special.english}</span>`;
    }
    let discussionToString = (discussion: string) => discussion
      .replaceAll(/_(.+?)_/g, "<i>$1</i>")
      .replaceAll(/\*(.+?)\*/g, "<b>$1</b>")
      .replaceAll(/:::: (.+?) ::::/g, (m, p1) => getSpecial(p1))
      .split("\n\n")
      .map(line => `<p>${line}</p>`)
      .join("\n");
    let extraNoteDisplay = extraNotes.map(n =>
      `${expToString(n.expression)}<br>${discussionToString(n.discussion!)}`)
      .join("");

    let media = [];
    const audioStart = sentence.audioPosition;
    const audioEnd = sentences
      .map((s) => s.audioPosition)
      .find((p) => p > audioStart);
    const audioSrc = document.querySelector("source")!.src;
    console.time('download_sentence_audio');
    const sentenceAudioBase64 = await fetchAudioClip(audioSrc, audioStart, audioEnd) as string;
    console.timeEnd('download_sentence_audio');
    const sentenceAudioName = `SatoriReader-${makeid(16)}.mp3`;
    media.push({
      filename: sentenceAudioName,
      data: sentenceAudioBase64.replace(/data:.+?base64,/, ""),
    });

    console.time('download_vocab_audio');
    const vocabAudioBase64 = (await downloadAudioPromise) as string;
    console.timeEnd('download_vocab_audio');
    let vocabAudioField = "";
    if (vocabAudioBase64 != null) {
      let vocabAudioName = `SatoriReader-${makeid(16)}.mp3`;
      vocabAudioField = `[sound:${vocabAudioName}]`;
      media.push({
        filename: vocabAudioName,
        data: vocabAudioBase64.replace(/data:.+?base64,/, ""),
      });
    }

    const fields = {
      "vocab": vocabEntry,
      "vocab-furigana": furigana,
      "vocab-reading": reading,
      "vocab-translation": senseContext,
      "sentence": sentenceFurigana,
      "sentence-translation": sentenceTranslation,
      "vocab-audio": vocabAudioField,
      "sentence-audio": `[sound:${sentenceAudioName}]`,
      "pos": pos,
      "non-context-senses": senseNonContext,
      "often-kana": oftenKana ? "This word often appears in kana" : "",
      "source": document.URL,
      "notes": extraNoteDisplay,
    }
    const response = await chrome.runtime.sendMessage({
      command: "add_anki_note",
      fields: fields,
      media: media
    }) as any;
    console.timeEnd('addAnkiNote');
    if (response.error) {
      alert(response.error);
      return;
    }
    const addButtons = noteBody?.querySelectorAll(".anki-button.add-note");
    const addButton = addButtons.length > 0 ? addButtons[readingNote ? 1 : 0] as HTMLElement : null;
    if (addButton) {
      addButton.querySelector(".text")!.textContent = "Added note to anki";
      addButton.classList.remove("tooltip-button-active");
      addButton.classList.add("tooltip-button-inactive");
      addButton.onclick = null;
    }
    let showInAnkiButton = noteBody?.querySelector(".anki-button.show-notes") as HTMLSpanElement;
    if (noteBody && !showInAnkiButton) {
      const maybeKatakana = sentenceForm == wanakana.toKatakana(reading) ? sentenceForm : reading;
      showInAnkiButton = createAnkiButton("Show anki note");
      showInAnkiButton.classList.add("show-notes");
      showInAnkiButton.onclick = () => {
        chrome.runtime.sendMessage({
          command: "anki_show_notes",
          headword: headword,
          reading: maybeKatakana
        })
      }
      noteBody.appendChild(showInAnkiButton);
    }
  } catch (err: any) {
    alert(err.toString());
    console.error(err);
  }
}

const addAnkiButton = async (noteBody: HTMLSpanElement) => {
  let headword = Array.from(noteBody.querySelectorAll(".expression span.wpt"))
    .map(e => e.textContent)
    .join("");
  let reading = Array.from(noteBody.querySelectorAll(".expression span.wpr"))
    .map(e => e.textContent)
    .join("");
  const sentenceForm = Array.from(document.querySelectorAll(".word-selected span.wpt"))
    .map(e => e.textContent)
    .join("");

  if (sentenceForm == wanakana.toKatakana(reading)) {
    reading = sentenceForm;
  }

  if (sentenceForm == wanakana.toKatakana(headword)) {
    headword = sentenceForm;
  }

  const response = await chrome.runtime.sendMessage({
    command: "anki_note_exists",
    headword: headword,
    reading: reading,
  }) as any;
  if (response.error) {
    return;
  }
  const addHeadwordButton = createAnkiButton(response.result.headwordExists ?
    "Add duplicate expression to Anki" :
    "Add expression to Anki");
  addHeadwordButton.classList.add("add-note");
  addHeadwordButton.onclick = () => addAnkiNote(noteBody, false);
  noteBody.appendChild(addHeadwordButton);

  if (headword != reading) {
    const addReadingButton = createAnkiButton(response.result.readingExists ?
      "Add duplicate reading to Anki" :
      "Add reading to Anki");
    addReadingButton.classList.add("add-note");
    addReadingButton.onclick = () => addAnkiNote(noteBody, true);
    noteBody.appendChild(addReadingButton);
  }

  if (response.result.headwordExists || response.result.readingExists) {
    const showInAnkiButton = createAnkiButton("Show anki note");
    showInAnkiButton.classList.add("show-notes");
    showInAnkiButton.onclick = () => {
      chrome.runtime.sendMessage({
        command: "anki_show_notes",
        headword: headword,
        reading: reading
      })
    }
    noteBody.appendChild(showInAnkiButton);
  }
}

const init = () => {
  console.log('Satori reader extension initializing');
  const tooltip = document.querySelector(".tooltip")
  if (tooltip == null) {
    console.error(`Could not find satori reader tooltip`);
    return;
  }
  const observer = new MutationObserver((records, observer) => {
    const hasAnkiButtons = tooltip.querySelector(".anki-button") != null;
    if (hasAnkiButtons) {
      return;
    }
    const noteBodies = Array.from(document.querySelectorAll(".note-body"))
      .filter(e => e.querySelector(".tooltip-button"))
      .map(e => e as HTMLSpanElement);
    for (const nodeBody of noteBodies) {
      if (nodeBody.dataset.ankiButton) {
        continue;
      }
      nodeBody.dataset.ankiButton = "true";
      addAnkiButton(nodeBody);
    }
  });
  const observerOptions = {
    childList: true,
    subtree: true,
  };
  observer.observe(tooltip, observerOptions);
}

const logTooltip = () => {
  const noteBodies = Array.from(document.querySelectorAll(".note-body"));
  for (const noteBody of noteBodies) {
    const headword = Array.from(noteBody.querySelectorAll(".word .wpt"))
      .map((e: any) => e.textContent)
      .join("");
    console.log(`Headword`, headword);
    const articleEle = noteBody.querySelector(".article") as HTMLElement;
    console.log(`articleId`, articleEle?.id);

    const sentenceEle = noteBody.querySelector(".sentence") as HTMLElement;
    console.log(`sentenceId`, sentenceEle?.dataset.id);

    const wordEle = noteBody.querySelector(".word") as HTMLElement;
    console.log(`wordId`, wordEle?.dataset.id);

    const button = noteBody.querySelector(".tooltip-button") as HTMLElement;
    console.log(`button`, button, button?.onclick?.toString() ?? "No Button");
    console.log("");
  }
}

const downloadArticle = async () => {
  console.log(`Download article`)
  const response = await chrome.runtime.sendMessage({
    command: "store_article"
  }) as any;
  console.log(`Got response`, response);
  let { satoriArticle } = await chrome.storage.local.get(['satoriArticle']);
  console.log(`Got article`, satoriArticle);
  await chrome.storage.local.set({ satoriArticle: null });
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(satoriArticle));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = "Article.json";
  a.click();

  logTooltip();
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`Content page got message`, message);
  if (message.command == "recordAudio") {
    console.log("Record audio message received!!");
    downloadArticle();
  }
});

init();