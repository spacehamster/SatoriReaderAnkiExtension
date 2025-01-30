
const DECK_NAME = "SatoriReader";
const MODEL_NAME = "SatoriReader";

export const invoke = async (action: string, params = {}) => {
  const version = 6
  const response = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    body: JSON.stringify({
      action: action,
      version: version,
      params: params
    }),
  })
  if (!response.ok) {
    throw Error(`Failed to issue anki request: ${response.status} - ${response.statusText}`);
  }
  const json = await response.json();
  if (!('error' in json)) {
    throw Error(`Anki response missing required error field`);
  }
  if (!('result' in json)) {
    throw Error(`Anki response missing required result field`);
  }
  if (json.error) {
    throw new Error(`Failed to invoke ${action}, ${json.error}`);
  }
  return json;
}


const addModel = async () => {
  const front = `
<span class="huge jp keyword">{{vocab}}</span>

{{#pos}}
<span class="highlight small glossary">[{{pos}}]</span>
{{/pos}}

<br/>
<hr/>
<span class="big jp" id="sentence">{{kanji:sentence}}</span><br/>`;
  const back = `
<span class="huge jp">{{furigana:vocab-furigana}}</span><br/>

<span class="highlight small glossary">{{vocab-translation}}</span>

{{#pos}}
<span class="highlight small glossary">[{{pos}}]</span>
{{/pos}}

{{#often-kana}}
<br/>
<span>{{often-kana}}</span>
{{/often-kana}}

<hr/>
<span class="big jp" id="sentence">{{furigana:sentence}}</span><br/>
<span class="highlight medium">{{sentence-translation}}</span>


{{#additional-senses}}
<br />
<div class="left b">Other senses:</div>
<div class="small left">{{additional-senses}}</div>
{{/additional-senses}}

{{#notes}}
<br />
<div class="left b">Notes:</div>
<div class="small left notes">{{notes}}</div>
{{/notes}}


<hr/>
<a href="https://jisho.org/search/{{vocab}}">Jisho</a> |
<a href="https://jisho.org/search/{{text:kanji:sentence}}">Jisho Sentence</a>  |
<a href="{{source}}">Satori Reader</a>  |
<a href="http://www.weblio.jp/content/{{vocab}}">Weblio</a> |
<a href="http://ejje.weblio.jp/sentence/content/{{vocab}}">Examples</a> |
<a href="http://tangorin.com/general/{{vocab}}">Tangorin</a> |
<a href="http://tangorin.com/examples/{{vocab}}">Examples</a>
<br/>

{{vocab-audio}}
{{sentence-audio}}`;

  const css = `
.card {
font-size: 18px;
text-align: center;
font-family:Arial;
padding: 5px;
}
.card { 
max-width: 700px;
margin: auto;
}
img {
max-height: 600px;
mad-width: 600px;
}

hr { margin-top: 5px; margin-bottom: 4px; }
.highlight{ color: #0000c0; }
.keyword { color: #c00000; }
.big {  font-size: 40px; } 
.huge { font-size: 52px; }
.medium { font-size: 26px; }
.small { font-size: 22px; }
.tiny { font-size: 20px; }
.pitch-graph { font-size: 14px; }
.examples { text-align: left; }
rt {  font-size: 60%; } 

.left { text-align: left; }
.b { font-weight: bold; }

.glossary i { font-weight: bold; }

.glossary ol {
padding-left: 16px;

}

ul[data-sc-content="glossary"]:first-child {
display: inline;
padding: 0px
}

ul[data-sc-content="glossary"] li:not(:first-child)::before {
content: " | ";
}

ul[data-sc-content="glossary"] li {
display: inline;
}

.freq { margin-top: 0.5em; text-align: left;  }
.freq ul { margin-top: 0px; margin-bottom:0px; }

.no_list ol { 
display: inline;
padding: 0px;
list-style-type: none;
}

.no_list li { 
display: inline !important;
padding: 0em 0.5em 0em 0em  !important;
}

table, td, th, tr {
border-color: black;
border-style: solid;
border-width: 1px;
border-collapse: collapse;
}

table {
margin-top: 4px;
}

.example-sentence {
display:block;
background-color: #f0f0f0;
border-left: solid 4px #cccccc;
padding-left: 12px;
padding-top:6px;
padding-bottom: 10px;
}

p {
margin-block-start: 0em;
margin-block-end: 1em;
}

.jp b { color: #a00000; font-weight: normal; }
.win .jp {font-family: NotoSansJP, "Meiryo", "Kochi Mincho", "Arial", "MS Mincho";}
.mac .jp {font-family: "Hiragino Mincho Pro", "honyaji-re", "ヒラギノ明朝 Pro"; }
.linux .jp {font-family: "Kochi Mincho", "東風明朝";}
.mobile .jp { font-family: NotoSansJP, "DroidSansJapanese", "Hiragino Mincho ProN";}
@font-face { font-family: NotoSansJP; src: url('_NotoSansJP-Regular.ttf'); }
`;
  const params = {
    "modelName": MODEL_NAME,
    "inOrderFields": [
      "vocab",
      "vocab-furigana",
      "vocab-reading",
      "vocab-translation",
      "sentence",
      "sentence-translation",
      "vocab-audio",
      "sentence-audio",
      "pos",
      "additional-senses",
      "often-kana",
      "source",
      "notes",
    ],
    "css": css,
    "isCloze": false,
    "cardTemplates": [
      {
        "Name": "My Card 1",
        "Front": front,
        "Back": back,
      }
    ]
  }
  await invoke("createModel", params);
}

export const addNoteToAnki = async (request: any) => {
  const version = await invoke("version");
  if (version.result != 6) {
    throw Error(`Expected anki version 6, got ${version.result}`);
  }
  const modelNames = await invoke("modelNames");
  if (!modelNames.result.includes(MODEL_NAME)) {
    await addModel();
  }
  const deckNames = await invoke("deckNames");
  if (!deckNames.result.includes(DECK_NAME)) {
    await invoke("createDeck", { deck: DECK_NAME });
  }
  const canAddNotes = await invoke("canAddNotesWithErrorDetail", {
    notes: [
      {
        deckName: DECK_NAME,
        modelName: MODEL_NAME,
        fields: request.fields
      }
    ]
  });
  const canAddNote = canAddNotes.result[0]
  if (!canAddNote.canAdd) {
    throw Error(canAddNote.error);
  }
  for (const media of request.media) {
    const response = await invoke("storeMediaFile", {
      filename: media.filename,
      data: media.data,
    });
    if (response.error) {
      throw Error(response.error);
    }
  }
  const response = await invoke("addNote", {
    note: {
      deckName: DECK_NAME,
      modelName: MODEL_NAME,
      fields: request.fields
    }
  });
  if (response.error) {
    throw Error(response.error);
  }
}

export const checkAnkiNoteExists = async (headword: string, reading: string) => {
  let response = await invoke("findNotes", { query: `"deck:${DECK_NAME}" "vocab:${headword}"` });
  if (response.error) {
    throw new Error(response.error);
  }
  let headwordExists = response.result.length > 0;
  let readingExists = headwordExists;
  if (headword != reading) {
    response = await invoke("findNotes", { query: `"deck:${DECK_NAME}" "vocab:${reading}"` });
    if (response.error) {
      throw new Error(response.error);
    }
    readingExists = response.result.length > 0;
  }
  return {
    headwordExists: headwordExists,
    readingExists: readingExists
  }
}

export const showAnkiNotes = async (headword: string, reading: string) => {
  const query = headword == reading ?
    `"deck:${DECK_NAME}" "vocab:${headword}"` :
    `"deck:${DECK_NAME}" ("vocab:${headword}" or "vocab:${reading}")`;
  const response = await invoke("guiBrowse", { query: query });
  if (response.error) {
    throw new Error(response.error);
  }
}