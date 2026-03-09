import { beforeEach, describe, expect, it, vi } from 'vitest'

const loaderConfigMock = vi.fn()

const monacoStub = {
  editor: { create: vi.fn() },
}

class EditorWorkerMock {
  kind = 'editor'
}
class JsonWorkerMock {
  kind = 'json'
}
class CssWorkerMock {
  kind = 'css'
}
class HtmlWorkerMock {
  kind = 'html'
}
class TsWorkerMock {
  kind = 'ts'
}

vi.mock('@monaco-editor/react', () => ({
  loader: {
    config: loaderConfigMock,
  },
}))

vi.mock('monaco-editor', () => monacoStub)
vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({ default: EditorWorkerMock }))
vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({
  default: JsonWorkerMock,
}))
vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({ default: CssWorkerMock }))
vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({
  default: HtmlWorkerMock,
}))
vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({
  default: TsWorkerMock,
}))

describe('monaco setup', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment
  })

  it('configures monaco loader with local monaco instance', async () => {
    await import('../setup')

    expect(loaderConfigMock).toHaveBeenCalledTimes(1)
    expect(loaderConfigMock).toHaveBeenCalledWith({ monaco: monacoStub })
  })

  it('routes language labels to the expected worker constructors', async () => {
    await import('../setup')

    const env = (
      globalThis as typeof globalThis & {
        MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => unknown }
      }
    ).MonacoEnvironment

    expect(env).toBeDefined()

    expect(env?.getWorker('', 'json')).toBeInstanceOf(JsonWorkerMock)
    expect(env?.getWorker('', 'css')).toBeInstanceOf(CssWorkerMock)
    expect(env?.getWorker('', 'html')).toBeInstanceOf(HtmlWorkerMock)
    expect(env?.getWorker('', 'typescript')).toBeInstanceOf(TsWorkerMock)
    expect(env?.getWorker('', 'javascript')).toBeInstanceOf(TsWorkerMock)
    expect(env?.getWorker('', 'anything-else')).toBeInstanceOf(EditorWorkerMock)
  })
})
