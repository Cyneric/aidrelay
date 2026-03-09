import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

type MonacoWorkerCtor = new () => Worker

type MonacoEnvironmentWithWorker = {
  getWorker: (_moduleId: string, label: string) => Worker
}

const getWorkerCtor = (label: string): MonacoWorkerCtor => {
  switch (label) {
    case 'json':
      return JsonWorker
    case 'css':
    case 'scss':
    case 'less':
      return CssWorker
    case 'html':
    case 'handlebars':
    case 'razor':
      return HtmlWorker
    case 'typescript':
    case 'javascript':
      return TsWorker
    default:
      return EditorWorker
  }
}

const configureMonaco = () => {
  loader.config({ monaco })
  ;(self as typeof self & { MonacoEnvironment?: MonacoEnvironmentWithWorker }).MonacoEnvironment = {
    getWorker: (_moduleId: string, label: string) => {
      const WorkerCtor = getWorkerCtor(label)
      return new WorkerCtor()
    },
  }
}

configureMonaco()

export { configureMonaco, getWorkerCtor }
