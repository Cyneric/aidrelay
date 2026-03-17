import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { SkillsPage } from '../SkillsPage'
import type * as SkillsStoreModule from '@/stores/skills.store'

const loadInstalledMock = vi.fn<() => Promise<void>>()
const loadCuratedMock = vi.fn<() => Promise<void>>()
const loadConflictsMock = vi.fn<() => Promise<void>>()
const loadMigrationPreviewMock = vi.fn<() => Promise<void>>()
const prepareInstallMock = vi.fn()
const installCuratedMock = vi.fn<() => Promise<void>>()
const createMock = vi.fn<() => Promise<void>>()
const deleteMock = vi.fn<() => Promise<void>>()
const setEnabledMock = vi.fn<() => Promise<void>>()
const applyMigrationMock = vi.fn<() => Promise<void>>()
const resolveConflictMock = vi.fn<() => Promise<void>>()
const detectWorkspacesMock = vi.fn<() => Promise<string[]>>()

let mockState: ReturnType<typeof buildState>

vi.mock('@/stores/skills.store', async (importOriginal) => {
  const actual: typeof SkillsStoreModule = await importOriginal()
  return {
    ...actual,
    useSkillsStore: () => mockState,
  }
})

const buildState = () => ({
  installed: [
    {
      scope: 'user' as const,
      skillName: 'lint-guard',
      skillPath: 'C:\\Users\\tester\\.agents\\skills\\lint-guard',
      skillMdPath: 'C:\\Users\\tester\\.agents\\skills\\lint-guard\\SKILL.md',
      description: 'Keep linting strict.',
      descriptionSource: 'frontmatter' as const,
      enabled: true,
      source: 'curated' as const,
      updatedAt: '2026-03-11T10:00:00.000Z',
    },
  ],
  curated: [
    {
      name: 'lint-guard',
      slug: 'lint-guard',
      description: 'Enforce strict lint and formatting checks.',
      descriptionSource: 'frontmatter' as const,
      repository: 'openai/skills',
      path: 'skills/.curated/lint-guard',
    },
    {
      name: 'deploy-check',
      slug: 'deploy-check',
      description: '',
      descriptionSource: 'none' as const,
      repository: 'openai/skills',
      path: 'skills/.curated/deploy-check',
    },
  ],
  conflicts: [
    {
      id: 'conf-1',
      skillName: 'deploy-check',
      scope: 'project' as const,
      projectPath: 'E:\\workspace\\app',
      localPath: 'E:\\workspace\\app\\.agents\\skills\\deploy-check',
      remotePath: 'skills/projects/abc/deploy-check',
      files: [{ path: 'SKILL.md', change: 'modified' as const }],
      createdAt: '2026-03-11T10:00:00.000Z',
    },
  ],
  migrationPreview: { hasLegacy: false, items: [] },
  error: null,
  loading: false,
  loadingInstalled: false,
  loadingCurated: false,
  loadingConflicts: false,
  loadingMigrationPreview: false,
  installingSkillSlug: null,
  creatingSkill: false,
  deletingSkillKey: null,
  togglingSkillKey: null,
  getSectionCounts: () => ({ discover: 2, installed: 1, conflicts: 1, migration: 0 }),
  loadInstalled: loadInstalledMock,
  loadCurated: loadCuratedMock,
  loadConflicts: loadConflictsMock,
  loadMigrationPreview: loadMigrationPreviewMock,
  prepareInstall: prepareInstallMock,
  installCurated: installCuratedMock,
  create: createMock,
  delete: deleteMock,
  setEnabled: setEnabledMock,
  applyMigration: applyMigrationMock,
  resolveConflict: resolveConflictMock,
})

describe('SkillsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    detectWorkspacesMock.mockResolvedValue(['E:\\workspace\\app'])
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        skillsDetectWorkspaces: detectWorkspacesMock,
      },
      writable: true,
      configurable: true,
    })
    loadInstalledMock.mockResolvedValue()
    loadCuratedMock.mockResolvedValue()
    loadConflictsMock.mockResolvedValue()
    loadMigrationPreviewMock.mockResolvedValue()
    prepareInstallMock.mockResolvedValue({
      skillName: 'deploy-check',
      scope: 'user',
      targetPath: 'C:\\Users\\tester\\.agents\\skills\\deploy-check',
      summary: 'Checks release readiness before deploy.',
      exists: true,
      conflict: true,
      files: [{ path: 'SKILL.md', change: 'modified' }],
    })
    installCuratedMock.mockResolvedValue()
    createMock.mockResolvedValue()
    deleteMock.mockResolvedValue()
    setEnabledMock.mockResolvedValue()
    applyMigrationMock.mockResolvedValue()
    resolveConflictMock.mockResolvedValue()
    mockState = buildState()
  })

  it('renders section navigation and discover cards with description fallback', async () => {
    renderWithProviders(<SkillsPage />)

    expect(screen.getByTestId('skills-page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Discover/i })).toBeInTheDocument()
    expect(screen.getByText('Enforce strict lint and formatting checks.')).toBeInTheDocument()
    expect(screen.getByText('No description available.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'View source' }).length).toBeGreaterThan(0)

    await waitFor(() => expect(loadCuratedMock).toHaveBeenCalled())
  })

  it('opens install preview with summary and calls install', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SkillsPage />)

    await user.click(screen.getAllByRole('button', { name: 'Install' })[1]!)

    expect(await screen.findByText('Install Preview')).toBeInTheDocument()
    expect(screen.getByText('Checks release readiness before deploy.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open source on GitHub' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Replace and install' }))
    await waitFor(() =>
      expect(installCuratedMock).toHaveBeenCalledWith({
        skillName: 'deploy-check',
        scope: 'user',
        replace: true,
      }),
    )
  })

  it('supports create wizard step validation and final create call', async () => {
    // This test drives a multi-step wizard through 9+ sequential interactions.
    // Under parallel test suite load the default 5 s is too tight — use 15 s.
    const user = userEvent.setup()
    renderWithProviders(<SkillsPage />)

    await user.click(screen.getByRole('button', { name: /^Create$/ }))
    await user.click(screen.getByRole('button', { name: /^Next$/ }))
    expect(screen.getByText('Skill name is required.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Skill name'), 'release-guardian')
    await user.click(screen.getByRole('button', { name: /^Next$/ }))
    await user.click(screen.getByRole('button', { name: 'Project' }))
    await user.click(screen.getByRole('button', { name: /^Next$/ }))
    expect(screen.getByText('Project path is required for project scope.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Project path'), 'E:\\workspace\\app')
    await user.click(screen.getByRole('button', { name: /^Next$/ }))
    await user.click(screen.getByRole('button', { name: /^Next$/ }))
    await user.click(screen.getByRole('button', { name: 'Create Skill' }))

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        name: 'release-guardian',
        scope: 'project',
        projectPath: 'E:\\workspace\\app',
        resources: [],
      }),
    )
  }, 15000)

  it('resolves a sync conflict via keep local action', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SkillsPage />)

    await user.click(screen.getByRole('button', { name: /Conflicts/ }))
    await user.click(screen.getByRole('button', { name: 'Keep local' }))

    await waitFor(() => expect(resolveConflictMock).toHaveBeenCalledWith('conf-1', 'local'))
  })
})
