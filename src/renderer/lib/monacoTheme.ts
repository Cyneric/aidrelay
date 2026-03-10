import type { Monaco } from '@monaco-editor/react'

const AIDRELAY_MONACO_DARK = 'aidrelay-dark'
const AIDRELAY_MONACO_LIGHT = 'aidrelay-light'

let themesDefined = false

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
const defineAidrelayMonacoThemes = (monaco: Monaco): void => {
  monaco.editor.defineTheme(AIDRELAY_MONACO_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string', foreground: 'F3B37C' },
      { token: 'number', foreground: '7BDFF2' },
      { token: 'keyword', foreground: '6EDCD0' },
      { token: 'delimiter', foreground: '9DB2CE' },
    ],
    colors: {
      'editor.background': '#0B1424',
      'editor.foreground': '#E4ECFB',
      'editor.lineHighlightBackground': '#102039',
      'editorLineNumber.foreground': '#5E7395',
      'editorLineNumber.activeForeground': '#A8BCD9',
      'editorIndentGuide.background1': '#223149',
      'editorIndentGuide.activeBackground1': '#3A5678',
      'editorCursor.foreground': '#2DD4BF',
      'editor.selectionBackground': '#1A365A',
      'editor.inactiveSelectionBackground': '#152A45',
      'editorWhitespace.foreground': '#2A3A54',
      'editorBracketHighlight.foreground1': '#7BDFF2',
      'editorBracketHighlight.foreground2': '#F3B37C',
      'editorBracketHighlight.foreground3': '#6EDCD0',
      'editorGutter.background': '#0B1424',
      'editorWidget.background': '#0F1C31',
      'editorWidget.border': '#1E3556',
      'scrollbarSlider.background': '#36507477',
      'scrollbarSlider.hoverBackground': '#4D709D88',
      'scrollbarSlider.activeBackground': '#5F8AC2AA',
    },
  })

  monaco.editor.defineTheme(AIDRELAY_MONACO_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string', foreground: 'B7652A' },
      { token: 'number', foreground: '136F84' },
      { token: 'keyword', foreground: '0C8B80' },
      { token: 'delimiter', foreground: '5B6D85' },
    ],
    colors: {
      'editor.background': '#F6F9FF',
      'editor.foreground': '#11213D',
      'editor.lineHighlightBackground': '#E6EEF9',
      'editorLineNumber.foreground': '#8698B1',
      'editorLineNumber.activeForeground': '#3E5577',
      'editorIndentGuide.background1': '#D6E1F0',
      'editorIndentGuide.activeBackground1': '#B9CBE3',
      'editorCursor.foreground': '#099A8E',
      'editor.selectionBackground': '#D7E7FD',
      'editor.inactiveSelectionBackground': '#E6F0FD',
      'editorWhitespace.foreground': '#B9C8DD',
      'editorBracketHighlight.foreground1': '#136F84',
      'editorBracketHighlight.foreground2': '#B7652A',
      'editorBracketHighlight.foreground3': '#0C8B80',
      'editorGutter.background': '#F6F9FF',
      'editorWidget.background': '#FFFFFF',
      'editorWidget.border': '#C9D8ED',
      'scrollbarSlider.background': '#A9BCDB88',
      'scrollbarSlider.hoverBackground': '#8CA5C888',
      'scrollbarSlider.activeBackground': '#6E8EB8AA',
    },
  })
}

export const getAidrelayMonacoTheme = (effectiveTheme: string): string =>
  effectiveTheme === 'dark' ? AIDRELAY_MONACO_DARK : AIDRELAY_MONACO_LIGHT

export const ensureAidrelayMonacoThemes = (monaco: Monaco): void => {
  if (themesDefined) return
  defineAidrelayMonacoThemes(monaco)
  themesDefined = true
}
