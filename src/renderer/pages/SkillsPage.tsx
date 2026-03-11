import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ExternalLink,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type {
  InstalledSkill,
  SkillInstallPreview,
  SkillScope,
  SkillSyncConflict,
} from '@shared/types'
import type { CreateSkillInput } from '@shared/channels'
import { useSkillsStore } from '@/stores/skills.store'
import { skillsService } from '@/services/skills.service'
import { filesService } from '@/services/files.service'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardGrid } from '@/components/ui/card-grid'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog'
import { FileEditModal } from '@/components/common/FileEditModal'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SkillsSection = 'discover' | 'installed' | 'create' | 'conflicts'
type CreateStep = 'details' | 'scope' | 'resources' | 'review'

const SCOPE_OPTIONS: readonly SkillScope[] = ['user', 'project']
const CREATE_STEPS: readonly CreateStep[] = ['details', 'scope', 'resources', 'review']

const skillKey = (skill: InstalledSkill): string =>
  `${skill.scope}:${skill.projectPath ?? 'user'}:${skill.skillName}`

const curatedSourceUrl = (repository: string, path: string): string =>
  `https://github.com/${repository}/tree/main/${path}`

const SkillsPage = () => {
  const { t } = useTranslation()
  const {
    installed,
    curated,
    conflicts,
    migrationPreview,
    error,
    loadingCurated,
    loadingInstalled,
    loadingConflicts,
    installingSkillSlug,
    creatingSkill,
    deletingSkillKey,
    togglingSkillKey,
    getSectionCounts,
    loadInstalled,
    loadCurated,
    loadConflicts,
    loadMigrationPreview,
    prepareInstall,
    installCurated,
    create,
    delete: deleteSkill,
    setEnabled,
    applyMigration,
    resolveConflict,
  } = useSkillsStore()

  const [activeSection, setActiveSection] = useState<SkillsSection>('discover')
  const [searchDiscover, setSearchDiscover] = useState('')
  const [searchInstalled, setSearchInstalled] = useState('')
  const [installScope, setInstallScope] = useState<SkillScope>('user')
  const [installProjectPath, setInstallProjectPath] = useState('')
  const [manageScope, setManageScope] = useState<'all' | SkillScope>('all')
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [createStep, setCreateStep] = useState<CreateStep>('details')
  const [createScope, setCreateScope] = useState<SkillScope>('user')
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createProjectPath, setCreateProjectPath] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [resources, setResources] = useState<Record<'scripts' | 'references' | 'assets', boolean>>({
    scripts: false,
    references: false,
    assets: false,
  })

  const [pendingInstallPreview, setPendingInstallPreview] = useState<SkillInstallPreview | null>(
    null,
  )
  const [pendingInstallSkill, setPendingInstallSkill] = useState<string | null>(null)
  const [pendingInstallDescription, setPendingInstallDescription] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<InstalledSkill | null>(null)
  const [editingPath, setEditingPath] = useState<string | null>(null)

  const sectionCounts = getSectionCounts()

  useEffect(() => {
    void Promise.all([loadInstalled(), loadCurated(), loadConflicts(), loadMigrationPreview()])
    void skillsService
      .detectWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
  }, [loadConflicts, loadCurated, loadInstalled, loadMigrationPreview])

  const refreshAll = async () => {
    await Promise.all([loadInstalled(), loadCurated(), loadConflicts(), loadMigrationPreview()])
  }

  const curatedFiltered = useMemo(() => {
    const q = searchDiscover.trim().toLowerCase()
    if (!q) return curated
    return curated.filter(
      (skill) =>
        skill.slug.toLowerCase().includes(q) ||
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q),
    )
  }, [curated, searchDiscover])

  const installedByName = useMemo(() => {
    const map = new Map<string, InstalledSkill[]>()
    for (const skill of installed) {
      const list = map.get(skill.skillName) ?? []
      list.push(skill)
      map.set(skill.skillName, list)
    }
    return map
  }, [installed])

  const installedFiltered = useMemo(() => {
    const q = searchInstalled.trim().toLowerCase()
    return installed.filter((skill) => {
      if (manageScope !== 'all' && skill.scope !== manageScope) return false
      if (!q) return true
      return (
        skill.skillName.toLowerCase().includes(q) ||
        skill.description?.toLowerCase().includes(q) ||
        skill.projectPath?.toLowerCase().includes(q)
      )
    })
  }, [installed, manageScope, searchInstalled])

  const userInstalled = installedFiltered.filter((skill) => skill.scope === 'user')
  const projectInstalled = installedFiltered.filter((skill) => skill.scope === 'project')

  const projectChips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const skill of projectInstalled) {
      const key = skill.projectPath ?? t('skillsPage.common.unknownProject')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [projectInstalled, t])

  const openInExplorer = async (path: string) => {
    try {
      await filesService.reveal(path)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('skillsPage.errors.revealFailed')
      toast.error(message)
    }
  }

  const handlePrepareInstall = async (skillSlug: string, fallbackDescription: string) => {
    try {
      const preview = await prepareInstall(
        skillSlug,
        installScope,
        installScope === 'project' ? installProjectPath : undefined,
      )
      setPendingInstallPreview(preview)
      setPendingInstallSkill(skillSlug)
      setPendingInstallDescription(fallbackDescription || null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('skillsPage.errors.prepareInstallFailed')
      toast.error(message)
    }
  }

  const handleConfirmInstall = async (replace: boolean) => {
    if (!pendingInstallSkill) return
    try {
      await installCurated({
        skillName: pendingInstallSkill,
        scope: installScope,
        ...(installScope === 'project' ? { projectPath: installProjectPath } : {}),
        replace,
      })
      setPendingInstallPreview(null)
      setPendingInstallSkill(null)
      setPendingInstallDescription(null)
    } catch {
      // Store toast handles messaging.
    }
  }

  const advanceStep = () => {
    setCreateError(null)
    if (createStep === 'details') {
      if (!createName.trim()) {
        setCreateError(t('skillsPage.create.validation.nameRequired'))
        return
      }
      setCreateStep('scope')
      return
    }
    if (createStep === 'scope') {
      if (createScope === 'project' && !createProjectPath.trim()) {
        setCreateError(t('skillsPage.create.validation.projectPathRequired'))
        return
      }
      setCreateStep('resources')
      return
    }
    if (createStep === 'resources') {
      setCreateStep('review')
    }
  }

  const backStep = () => {
    setCreateError(null)
    const index = CREATE_STEPS.indexOf(createStep)
    if (index <= 0) return
    setCreateStep(CREATE_STEPS[index - 1] ?? 'details')
  }

  const createPreviewDescription =
    createDescription.trim() || t('skillsPage.create.defaultDescription')

  const createPreviewDoc = [
    '---',
    `name: ${createName.trim() || 'my-skill'}`,
    `description: ${createPreviewDescription}`,
    '---',
    '',
    `# ${createName.trim() || 'my-skill'}`,
    '',
    '## Quick Start',
    '',
    '- Describe how this skill should be used.',
    '',
  ].join('\n')

  const handleCreateSkill = async () => {
    const trimmedName = createName.trim()
    const trimmedDescription = createDescription.trim()
    if (!trimmedName) {
      setCreateError(t('skillsPage.create.validation.nameRequired'))
      return
    }
    if (createScope === 'project' && !createProjectPath.trim()) {
      setCreateError(t('skillsPage.create.validation.projectPathRequired'))
      return
    }
    const input: CreateSkillInput = {
      name: trimmedName,
      scope: createScope,
      ...(createScope === 'project' ? { projectPath: createProjectPath.trim() } : {}),
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      resources: Object.entries(resources)
        .filter(([, selected]) => selected)
        .map(([name]) => name) as ('scripts' | 'references' | 'assets')[],
    }

    try {
      await create(input)
      setCreateStep('details')
      setCreateName('')
      setCreateDescription('')
      setCreateError(null)
      setResources({ scripts: false, references: false, assets: false })
    } catch {
      // Store toast handles messaging.
    }
  }

  const renderInstalledCard = (skill: InstalledSkill) => {
    const key = skillKey(skill)
    return (
      <div key={key} className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{skill.skillName}</h3>
              <Badge variant={skill.enabled ? 'secondary' : 'outline'}>
                {skill.enabled ? t('skillsPage.common.enabled') : t('skillsPage.common.disabled')}
              </Badge>
              <Badge variant="outline">{t(`skillsPage.scope.${skill.scope}`)}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {skill.description || t('skillsPage.common.noDescription')}
            </p>
            {skill.projectPath ? (
              <p className="mt-1 text-xs text-muted-foreground">{skill.projectPath}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
              <Checkbox
                checked={skill.enabled}
                disabled={togglingSkillKey === key}
                onCheckedChange={(checked) =>
                  void setEnabled({
                    scope: skill.scope,
                    skillName: skill.skillName,
                    enabled: Boolean(checked),
                    ...(skill.scope === 'project' ? { projectPath: skill.projectPath } : {}),
                  })
                }
              />
              {t('skillsPage.installed.toggle')}
            </label>
            <Button variant="ghost" size="sm" onClick={() => setEditingPath(skill.skillMdPath)}>
              <Wrench size={14} />
              {t('skillsPage.installed.edit')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void openInExplorer(skill.skillPath)}>
              <FolderOpen size={14} />
              {t('skillsPage.installed.reveal')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(skill)}>
              <Trash2 size={14} />
              {deletingSkillKey === key
                ? t('skillsPage.installed.deleting')
                : t('skillsPage.installed.delete')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const renderConflictCard = (conflict: SkillSyncConflict) => {
    const added = conflict.files.filter((row) => row.change === 'added').length
    const modified = conflict.files.filter((row) => row.change === 'modified').length
    const removed = conflict.files.filter((row) => row.change === 'removed').length

    return (
      <div key={conflict.id} className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{conflict.skillName}</h3>
            <p className="text-sm text-muted-foreground">
              {t(`skillsPage.scope.${conflict.scope}`)}
              {conflict.projectPath ? ` · ${conflict.projectPath}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{t('skillsPage.conflicts.added', { count: added })}</Badge>
              <Badge variant="outline">
                {t('skillsPage.conflicts.modified', { count: modified })}
              </Badge>
              <Badge variant="outline">
                {t('skillsPage.conflicts.removed', { count: removed })}
              </Badge>
            </div>
          </div>
          <Badge variant="destructive">
            <ShieldAlert size={12} />
            {t('skillsPage.conflicts.pending')}
          </Badge>
        </div>
        <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs">
          <p className="mb-1 text-muted-foreground">{t('skillsPage.conflicts.localPath')}</p>
          <p className="font-mono break-all">{conflict.localPath}</p>
          <p className="mb-1 mt-2 text-muted-foreground">{t('skillsPage.conflicts.remotePath')}</p>
          <p className="font-mono break-all">{conflict.remotePath}</p>
        </div>
        <div className="mt-3 max-h-36 overflow-auto rounded-md border bg-muted/20 p-2 text-xs">
          {conflict.files.map((row) => (
            <div key={row.path}>
              [{row.change}] {row.path}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void resolveConflict(conflict.id, 'local')}
          >
            {t('skillsPage.conflicts.keepLocal')}
          </Button>
          <Button size="sm" onClick={() => void resolveConflict(conflict.id, 'remote')}>
            {t('skillsPage.conflicts.useRemote')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="flex h-full flex-col" data-testid="skills-page">
        <header className="border-b p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{t('skillsPage.title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('skillsPage.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
                <RefreshCw size={14} />
                {t('skillsPage.actions.refresh')}
              </Button>
              <Select
                value={installScope}
                onValueChange={(value) => setInstallScope(value as SkillScope)}
              >
                <SelectTrigger className="min-w-36">
                  <SelectValue placeholder={t('skillsPage.actions.scope')} />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {t(`skillsPage.scope.${scope}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {installScope === 'project' ? (
                <Input
                  value={installProjectPath}
                  onChange={(event) => setInstallProjectPath(event.target.value)}
                  placeholder={t('skillsPage.actions.projectPath')}
                  list="skills-workspaces-list"
                  className="min-w-64"
                />
              ) : null}
            </div>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-6 md:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border bg-card p-3">
            <nav className="space-y-1">
              {(
                [
                  ['discover', sectionCounts.discover],
                  ['installed', sectionCounts.installed],
                  ['create', 0],
                  ['conflicts', sectionCounts.conflicts],
                ] as Array<[SkillsSection, number]>
              ).map(([section, count]) => (
                <button
                  key={section}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                    activeSection === section
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                  onClick={() => setActiveSection(section)}
                >
                  <span>{t(`skillsPage.sections.${section}`)}</span>
                  {section !== 'create' ? <Badge variant="outline">{count}</Badge> : null}
                </button>
              ))}
            </nav>
          </aside>

          <div className="overflow-auto pr-1">
            {migrationPreview?.hasLegacy ? (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                <p className="font-medium">{t('skillsPage.migration.title')}</p>
                <p className="text-muted-foreground">
                  {t('skillsPage.migration.body', { count: migrationPreview.items.length })}
                </p>
                <Button
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void applyMigration({
                      items: migrationPreview.items.map((item) => ({
                        scope: item.scope,
                        skillName: item.skillName,
                        skillPath: item.sourcePath,
                        skillMdPath: `${item.sourcePath}\\SKILL.md`,
                        ...(item.scope === 'project' ? { projectPath: item.projectPath } : {}),
                      })),
                    })
                  }
                >
                  {t('skillsPage.migration.cta')}
                </Button>
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {activeSection === 'discover' ? (
              <section data-testid="skills-section-discover">
                <div className="mb-4 flex items-center gap-3">
                  <div className="relative w-full max-w-xl">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchDiscover}
                      onChange={(event) => setSearchDiscover(event.target.value)}
                      placeholder={t('skillsPage.discover.searchPlaceholder')}
                      className="pl-8"
                    />
                  </div>
                </div>
                {loadingCurated ? (
                  <p className="py-8 text-sm text-muted-foreground">
                    {t('skillsPage.common.loading')}
                  </p>
                ) : (
                  <CardGrid cols="md:2">
                    {curatedFiltered.map((skill) => {
                      const installedMatches = installedByName.get(skill.slug) ?? []
                      const hasUser = installedMatches.some((item) => item.scope === 'user')
                      const hasProject = installedMatches.some((item) => item.scope === 'project')
                      return (
                        <article key={skill.slug} className="rounded-lg border bg-card p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{skill.name}</h3>
                                {skill.descriptionSource !== 'none' ? (
                                  <Badge variant="outline">
                                    {t(`skillsPage.descriptionSource.${skill.descriptionSource}`)}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                                {skill.description || t('skillsPage.common.noDescription')}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">{skill.path}</p>
                              <a
                                href={curatedSourceUrl(skill.repository, skill.path)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLink size={12} />
                                {t('skillsPage.discover.viewSource')}
                              </a>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {hasUser ? (
                                  <Badge variant="secondary">
                                    {t('skillsPage.discover.userInstalled')}
                                  </Badge>
                                ) : null}
                                {hasProject ? (
                                  <Badge variant="secondary">
                                    {t('skillsPage.discover.projectInstalled')}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              disabled={installingSkillSlug === skill.slug}
                              onClick={() =>
                                void handlePrepareInstall(skill.slug, skill.description)
                              }
                            >
                              {installingSkillSlug === skill.slug
                                ? t('skillsPage.discover.installing')
                                : t('skillsPage.discover.install')}
                            </Button>
                          </div>
                        </article>
                      )
                    })}
                  </CardGrid>
                )}
                {!loadingCurated && curatedFiltered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {t('skillsPage.discover.empty')}
                  </p>
                ) : null}
              </section>
            ) : null}

            {activeSection === 'installed' ? (
              <section data-testid="skills-section-installed">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{t('skillsPage.installed.title')}</h2>
                    <Badge variant="outline">{installed.length}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={searchInstalled}
                      onChange={(event) => setSearchInstalled(event.target.value)}
                      placeholder={t('skillsPage.installed.searchPlaceholder')}
                      className="min-w-64"
                    />
                    <Select
                      value={manageScope}
                      onValueChange={(value) => setManageScope(value as 'all' | SkillScope)}
                    >
                      <SelectTrigger className="min-w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('skillsPage.installed.scopeAll')}</SelectItem>
                        <SelectItem value="user">{t('skillsPage.scope.user')}</SelectItem>
                        <SelectItem value="project">{t('skillsPage.scope.project')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {projectChips.length > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {projectChips.map(([projectPath, count]) => (
                      <Badge key={projectPath} variant="outline">
                        {projectPath} ({count})
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {loadingInstalled ? (
                  <p className="py-8 text-sm text-muted-foreground">
                    {t('skillsPage.common.loading')}
                  </p>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {t('skillsPage.installed.userGroup', { count: userInstalled.length })}
                      </h3>
                      {userInstalled.map(renderInstalledCard)}
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {t('skillsPage.installed.projectGroup', { count: projectInstalled.length })}
                      </h3>
                      {projectInstalled.map(renderInstalledCard)}
                    </div>
                  </div>
                )}

                {!loadingInstalled && installedFiltered.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    {t('skillsPage.installed.empty')}
                  </p>
                ) : null}
              </section>
            ) : null}

            {activeSection === 'create' ? (
              <section data-testid="skills-section-create" className="max-w-3xl">
                <h2 className="mb-4 font-semibold">{t('skillsPage.create.title')}</h2>
                <div className="mb-4 flex flex-wrap gap-2">
                  {CREATE_STEPS.map((step) => (
                    <button
                      key={step}
                      type="button"
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs',
                        createStep === step
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border',
                      )}
                      onClick={() => setCreateStep(step)}
                    >
                      {t(`skillsPage.create.steps.${step}`)}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 rounded-lg border bg-card p-5">
                  {createStep === 'details' ? (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="skills-create-name">{t('skillsPage.create.name')}</Label>
                        <Input
                          id="skills-create-name"
                          value={createName}
                          onChange={(event) => setCreateName(event.target.value)}
                          placeholder={t('skillsPage.create.namePlaceholder')}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="skills-create-description">
                          {t('skillsPage.create.description')}
                        </Label>
                        <Input
                          id="skills-create-description"
                          value={createDescription}
                          onChange={(event) => setCreateDescription(event.target.value)}
                          placeholder={t('skillsPage.create.descriptionPlaceholder')}
                        />
                      </div>
                    </>
                  ) : null}

                  {createStep === 'scope' ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {SCOPE_OPTIONS.map((scope) => (
                          <Button
                            key={scope}
                            type="button"
                            variant={createScope === scope ? 'default' : 'outline'}
                            onClick={() => setCreateScope(scope)}
                          >
                            {t(`skillsPage.scope.${scope}`)}
                          </Button>
                        ))}
                      </div>
                      {createScope === 'project' ? (
                        <div className="space-y-1">
                          <Label htmlFor="skills-create-project">
                            {t('skillsPage.create.projectPath')}
                          </Label>
                          <Input
                            id="skills-create-project"
                            value={createProjectPath}
                            onChange={(event) => setCreateProjectPath(event.target.value)}
                            list="skills-workspaces-list"
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {createStep === 'resources' ? (
                    <div className="space-y-2">
                      <Label>{t('skillsPage.create.resources')}</Label>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {(['scripts', 'references', 'assets'] as const).map((name) => (
                          <label
                            key={name}
                            className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
                          >
                            <Checkbox
                              checked={resources[name]}
                              onCheckedChange={(checked) =>
                                setResources((prev) => ({ ...prev, [name]: Boolean(checked) }))
                              }
                            />
                            {name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {createStep === 'review' ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">{createName.trim() || 'my-skill'}</Badge>
                        <Badge variant="outline">{t(`skillsPage.scope.${createScope}`)}</Badge>
                        {createScope === 'project' && createProjectPath.trim() ? (
                          <Badge variant="outline">{createProjectPath.trim()}</Badge>
                        ) : null}
                        {Object.entries(resources)
                          .filter(([, value]) => value)
                          .map(([name]) => (
                            <Badge variant="secondary" key={name}>
                              {name}
                            </Badge>
                          ))}
                      </div>
                      <div className="rounded-md border bg-muted/20 p-3">
                        <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
                          <Sparkles size={14} />
                          {t('skillsPage.create.preview')}
                        </p>
                        <pre className="overflow-auto text-xs">{createPreviewDoc}</pre>
                      </div>
                    </div>
                  ) : null}

                  {createError ? (
                    <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {createError}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap justify-between gap-2 pt-2">
                    <Button
                      variant="outline"
                      disabled={createStep === 'details'}
                      onClick={backStep}
                    >
                      {t('common.back')}
                    </Button>
                    {createStep !== 'review' ? (
                      <Button onClick={advanceStep}>{t('skillsPage.create.next')}</Button>
                    ) : (
                      <Button disabled={creatingSkill} onClick={() => void handleCreateSkill()}>
                        <Plus size={14} />
                        {creatingSkill
                          ? t('skillsPage.create.creating')
                          : t('skillsPage.create.create')}
                      </Button>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {activeSection === 'conflicts' ? (
              <section data-testid="skills-section-conflicts" className="space-y-3">
                <h2 className="font-semibold">{t('skillsPage.conflicts.title')}</h2>
                {loadingConflicts ? (
                  <p className="py-8 text-sm text-muted-foreground">
                    {t('skillsPage.common.loading')}
                  </p>
                ) : (
                  conflicts.map(renderConflictCard)
                )}
                {!loadingConflicts && conflicts.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    {t('skillsPage.conflicts.empty')}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </main>

        <datalist id="skills-workspaces-list">
          {workspaces.map((workspace) => (
            <option value={workspace} key={workspace} />
          ))}
        </datalist>
      </section>

      <Dialog
        open={pendingInstallPreview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingInstallPreview(null)
            setPendingInstallSkill(null)
            setPendingInstallDescription(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('skillsPage.installDialog.title')}</DialogTitle>
            <DialogDescription>{pendingInstallPreview?.targetPath}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <strong>{t('skillsPage.installDialog.skill')}:</strong>{' '}
              {pendingInstallPreview?.skillName ?? 'n/a'}
            </p>
            <p>
              <strong>{t('skillsPage.installDialog.scope')}:</strong>{' '}
              {pendingInstallPreview ? t(`skillsPage.scope.${pendingInstallPreview.scope}`) : 'n/a'}
            </p>
            <p className="text-muted-foreground">
              {pendingInstallPreview?.summary ||
                pendingInstallDescription ||
                t('skillsPage.common.noDescription')}
            </p>
            {pendingInstallSkill ? (
              <a
                href={curatedSourceUrl('openai/skills', `skills/.curated/${pendingInstallSkill}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink size={12} />
                {t('skillsPage.installDialog.viewSource')}
              </a>
            ) : null}
          </div>
          <div className="max-h-72 overflow-auto rounded border bg-muted/20 p-3 text-xs">
            {pendingInstallPreview?.files.length ? (
              pendingInstallPreview.files.map((row) => (
                <div key={row.path}>
                  [{row.change}] {row.path}
                </div>
              ))
            ) : (
              <p>{t('skillsPage.installDialog.noChanges')}</p>
            )}
          </div>
          {pendingInstallPreview?.conflict ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('skillsPage.installDialog.conflictWarning')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Check className="mr-1 inline-block h-3 w-3" />
              {t('skillsPage.installDialog.safeInstall')}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingInstallPreview(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" onClick={() => void handleConfirmInstall(false)}>
              {t('skillsPage.installDialog.installIfSafe')}
            </Button>
            <Button onClick={() => void handleConfirmInstall(true)}>
              {t('skillsPage.installDialog.replaceAndInstall')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={deleting !== null}
        title={t('skillsPage.deleteDialog.title')}
        description={
          deleting
            ? t('skillsPage.deleteDialog.description', {
                name: deleting.skillName,
                path: deleting.skillPath,
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        variant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          void deleteSkill({
            scope: deleting.scope,
            skillName: deleting.skillName,
            ...(deleting.scope === 'project' ? { projectPath: deleting.projectPath } : {}),
          }).then(() => setDeleting(null))
        }}
      />

      {editingPath ? (
        <FileEditModal
          path={editingPath}
          open={editingPath !== null}
          onOpenChange={(open) => !open && setEditingPath(null)}
        />
      ) : null}
    </>
  )
}

export { SkillsPage }
