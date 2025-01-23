declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.SFC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.json' {
  const content: string;
  export default content;
}


interface SatoriDictionaryEntry {

}

interface SatoriExpression {
  id: string;
  paragraphs: SatoriParagraph[];
}
interface SatoriNote {
  id: string;
  dictionaryEntry?: SatoriDictionaryEntry;
  discussion?: string;
  expression: SatoriExpression;
  sentenceForm: number;
  type: number;
}
interface SatoriParagraph {
  id: string;
  parent: any;
  sentences: SatoriSentence[];
}
interface SatoriSentence {
  id: string;
  audioPosition: number;
  noteIds: string[];
  parent: any;
  runs: SatoriRun[];
}

interface SatoriWord {
  id: string;
  parent: any;
  parts?: SatoriMorph[];
  noteIds?: number[];
  text?: string;
}

interface SatoriMorph {
  id: string;
  parent: any;
  reading: string;
  text: string;
}

interface SatoriRun {
  id: string;
  parent: any;
  parts: SatoriWord
}

interface SatoriSpecial {
  id: string;
  filter: string;
  english: string;
  japanese: SatoriExpression
}

interface SatoriArticle {
  code: string;
  id: string;
  itemsByNoteId: { [key: string]: any };
  notes: SatoriNote[];
  notesById: { [key: string]: SatoriNote };
  paragraphs: SatoriParagraph[];
  special: SatoriSpecial[];
}