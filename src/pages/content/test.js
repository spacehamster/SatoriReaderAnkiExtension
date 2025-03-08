let article = articlePresenter.article;

let selectedWord = document.querySelector(".word-selected");
let run = selectedWord?.parentElement;
let selectedSentence = run?.parentElement;

let sentences = article.paragraphs.flatMap((p) => p.sentences)
let sentence = sentences.find((s) => s.id == selectedSentence?.dataset.id);

let extraNoteIds = sentence.runs
  .flatMap(r => r.parts)
  .filter(w => w.noteIds != null)
  .flatMap(w => w.noteIds);
let extraNotes = [...new Set(extraNoteIds)]
  .map(id => article.notesById["k_" + id])
  .filter(n => n.discussion != null);
let noteToString = (note) => expToString(note.expression);
let expToString = (exp) =>
  exp.paragraphs
    .flatMap(p => p.sentences)
    .flatMap(s => s.runs)
    .flatMap(r => r.parts)
    .map(w => w.text ? w.text : w.parts?.map(m => m.text).join(""))
    .join("");
let formatMarkdown = (text) => text
let getSpecial = (id) => {
  let special = article.special.find(s => s.id == id);
  let english = special.english
    .replaceAll(/_(.+?)_/g, "<i>$1</i>")
    .replaceAll(/\*(.+?)\*/g, "<b>$1</b>");
  return `<span class="example-sentence">${expToString(special.japanese)}<br>${english}</span>`;
}
let discussionToString = (discussion) => discussion
  .replaceAll(/_(.+?)_/g, "<i>$1</i>")
  .replaceAll(/\*(.+?)\*/g, "<b>$1</b>")
  .replaceAll(/:::: (.+?) ::::/g, (m, p1) => getSpecial(p1))
  .split("\n\n")
  .map(line => `<p>${line}</p>`)
  .join("\n");
let extraNoteDisplay = extraNotes.map(n =>
  `${expToString(n.expression)}<br>${discussionToString(n.discussion)}`)
  .join("<br><br>");