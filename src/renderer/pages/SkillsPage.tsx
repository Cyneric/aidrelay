import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Plus, RefreshCw, Search, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import type { InstalledSkill, SkillInstallPreview, SkillScope } from '@shared/types'
import type { CreateSkillInput } from '@shared/channels'
import { useSkillsStore } from '@/stores/skills.store'
import { skillsService } from '@/services/skills.service'
import { filesService } from '@/services/files.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
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

const SCOPE_OPTIONS: readonly SkillScope[] = ['user', 'project']

const SkillsPage = () => {
  const {
    installed,
    curated,
    conflicts,
    migrationPreview,
    error,
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

  const [search, setSearch] = useState('')
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [installScope, setInstallScope] = useState<SkillScope>('user')
  const [installProjectPath, setInstallProjectPath] = useState('')
  const [createScope, setCreateScope] = useState<SkillScope>('user')
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createProjectPath, setCreateProjectPath] = useState('')
  const [resources, setResources] = useState<Record<'scripts' | 'references' | 'assets', boolean>>({
    scripts: false,
    references: false,
    assets: false,
  })

  const [pendingInstallPreview, setPendingInstallPreview] = useState<SkillInstallPreview | null>(
    null,
  )
  const [pendingInstallSkill, setPendingInstallSkill] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<InstalledSkill | null>(null)
  const [editingPath, setEditingPath] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([loadInstalled(), loadCurated(), loadConflicts(), loadMigrationPreview()])
    void skillsService
      .detectWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
  }, [loadConflicts, loadCurated, loadInstalled, loadMigrationPreview])

  const curatedFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return curated
    return curated.filter(
      (skill) =>
        skill.slug.toLowerCase().includes(q) ||
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q),
    )
  }, [curated, search])

  const handlePrepareInstall = async (skillSlug: string) => {
    try {
      const preview = await prepareInstall(
        skillSlug,
        installScope,
        installScope === 'project' ? installProjectPath : undefined,
      )
      setPendingInstallPreview(preview)
      setPendingInstallSkill(skillSlug)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to prepare install'
      toast.error(message)
    }
  }

  const handleConfirmInstall = async (replace: boolean) => {
    if (!pendingInstallSkill) return
    await installCurated({
      skillName: pendingInstallSkill,
      scope: installScope,
      ...(installScope === 'project' ? { projectPath: installProjectPath } : {}),
      replace,
    })
    setPendingInstallPreview(null)
    setPendingInstallSkill(null)
  }

  const handleCreateSkill = async () => {
    if (!createName.trim()) {
      toast.error('Skill name is required')
      return
    }
    if (createScope === 'project' && !createProjectPath.trim()) {
      toast.error('Project path is required for project scope')
      return
    }

    const trimmedDescription = createDescription.trim()
    const input: CreateSkillInput = {
      name: createName,
      scope: createScope,
      ...(createScope === 'project' ? { projectPath: createProjectPath.trim() } : {}),
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      resources: Object.entries(resources)
        .filter(([, selected]) => selected)
        .map(([name]) => name) as ('scripts' | 'references' | 'assets')[],
    }
    await create(input)

    setCreateName('')
    setCreateDescription('')
    setResources({ scripts: false, references: false, assets: false })
  }

  const openInExplorer = async (path: string) => {
    try {
      await filesService.reveal(path)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reveal path'
      toast.error(message)
    }
  }

  return (
    <>
      <section className="flex h-full flex-col" data-testid="skills-page">
        <header className="border-b p-6">
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="mt-1 text-muted-foreground">
            Install curated skills, create your own, manage enablement, and resolve sync conflicts.
          </p>
        </header>

        <main className="flex-1 overflow-hidden p-6">
          {migrationPreview?.hasLegacy ? (
            <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <p className="font-medium">Legacy skills detected in `.codex/skills`.</p>
              <p className="text-muted-foreground">
                {migrationPreview.items.length} skill(s) can be migrated to `.agents/skills`.
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
                Migrate Legacy Skills
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Tabs defaultValue="curated" className="flex h-full flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="curated">Curated Browse</TabsTrigger>
              <TabsTrigger value="manage">Installed / Manage</TabsTrigger>
              <TabsTrigger value="create">Create Wizard</TabsTrigger>
              <TabsTrigger value="conflicts">Sync Conflicts</TabsTrigger>
            </TabsList>

            <TabsContent value="curated" className="flex-1 overflow-auto">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search curated skills"
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {SCOPE_OPTIONS.map((scope) => (
                    <Button
                      key={scope}
                      type="button"
                      variant={installScope === scope ? 'default' : 'outline'}
                      onClick={() => setInstallScope(scope)}
                    >
                      {scope}
                    </Button>
                  ))}
                </div>
                {installScope === 'project' ? (
                  <Input
                    value={installProjectPath}
                    onChange={(event) => setInstallProjectPath(event.target.value)}
                    placeholder="Project path"
                    list="skills-workspaces-list"
                  />
                ) : null}
              </div>

              <div className="space-y-3">
                {curatedFiltered.map((skill) => (
                  <div key={skill.slug} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{skill.name}</h3>
                        {skill.description ? (
                          <p className="text-sm text-muted-foreground">{skill.description}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">{skill.path}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          void handlePrepareInstall(skill.slug)
                        }}
                      >
                        Install
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="manage" className="flex-1 overflow-auto">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Installed Skills ({installed.length})</h2>
                <Button variant="outline" size="sm" onClick={() => void loadInstalled()}>
                  <RefreshCw size={14} />
                  Refresh
                </Button>
              </div>
              <div className="space-y-3">
                {installed.map((skill) => (
                  <div
                    key={`${skill.scope}:${skill.projectPath ?? 'user'}:${skill.skillName}`}
                    className="rounded-md border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{skill.skillName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Scope: {skill.scope}
                          {skill.projectPath ? ` · ${skill.projectPath}` : ''}
                        </p>
                        {skill.description ? (
                          <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={skill.enabled}
                            onCheckedChange={(checked) =>
                              void setEnabled({
                                scope: skill.scope,
                                skillName: skill.skillName,
                                enabled: Boolean(checked),
                                ...(skill.scope === 'project'
                                  ? { projectPath: skill.projectPath }
                                  : {}),
                              })
                            }
                          />
                          enabled
                        </label>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingPath(skill.skillMdPath)}
                        >
                          <Wrench size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void openInExplorer(skill.skillPath)}
                        >
                          <FolderOpen size={14} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(skill)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {installed.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No skills installed yet.
                  </p>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="create" className="flex-1 overflow-auto">
              <div className="max-w-xl space-y-4 rounded-md border p-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Skill name</label>
                  <Input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={createDescription}
                    onChange={(event) => setCreateDescription(event.target.value)}
                    placeholder="Optional description for frontmatter"
                  />
                </div>

                <div className="flex gap-2">
                  {SCOPE_OPTIONS.map((scope) => (
                    <Button
                      key={scope}
                      type="button"
                      variant={createScope === scope ? 'default' : 'outline'}
                      onClick={() => setCreateScope(scope)}
                    >
                      {scope}
                    </Button>
                  ))}
                </div>

                {createScope === 'project' ? (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Project path</label>
                    <Input
                      value={createProjectPath}
                      onChange={(event) => setCreateProjectPath(event.target.value)}
                      list="skills-workspaces-list"
                    />
                  </div>
                ) : null}

                <div className="space-y-1">
                  <label className="text-sm font-medium">Optional resources</label>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {(['scripts', 'references', 'assets'] as const).map((name) => (
                      <label key={name} className="inline-flex items-center gap-2">
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

                <Button onClick={() => void handleCreateSkill()}>
                  <Plus size={14} />
                  Create Skill
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="conflicts" className="flex-1 overflow-auto">
              <div className="space-y-3">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="rounded-md border p-4">
                    <h3 className="font-semibold">{conflict.skillName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {conflict.scope}
                      {conflict.projectPath ? ` · ${conflict.projectPath}` : ''}
                    </p>
                    <div className="mt-2 max-h-40 overflow-auto rounded border bg-muted/20 p-2 text-xs">
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
                        onClick={() => {
                          void resolveConflict(conflict.id, 'local')
                        }}
                      >
                        Keep Local
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          void resolveConflict(conflict.id, 'remote')
                        }}
                      >
                        Use Remote
                      </Button>
                    </div>
                  </div>
                ))}
                {conflicts.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No pending skill sync conflicts.
                  </p>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <datalist id="skills-workspaces-list">
          {workspaces.map((workspace) => (
            <option value={workspace} key={workspace} />
          ))}
        </datalist>
      </section>

      <Dialog
        open={pendingInstallPreview !== null}
        onOpenChange={(open) => !open && setPendingInstallPreview(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Install Preview</DialogTitle>
            <DialogDescription>{pendingInstallPreview?.targetPath}</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto rounded border bg-muted/20 p-3 text-xs">
            {pendingInstallPreview?.files.length ? (
              pendingInstallPreview.files.map((row) => (
                <div key={row.path}>
                  [{row.change}] {row.path}
                </div>
              ))
            ) : (
              <p>No file changes detected.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingInstallPreview(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void handleConfirmInstall(false)
              }}
            >
              Install If Safe
            </Button>
            <Button
              onClick={() => {
                void handleConfirmInstall(true)
              }}
            >
              Replace and Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={deleting !== null}
        title="Delete skill?"
        description={deleting ? `Delete "${deleting.skillName}" from ${deleting.skillPath}?` : ''}
        confirmLabel="Delete"
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
