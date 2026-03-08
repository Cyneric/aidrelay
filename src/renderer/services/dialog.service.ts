export const dialogService = {
  showOpen: (options?: {
    properties?: readonly ('openDirectory' | 'openFile' | 'multiSelections')[]
    title?: string
  }): Promise<{ canceled: boolean; filePaths: string[] }> =>
    window.api.showOpenDialog(options ?? {}),
}
