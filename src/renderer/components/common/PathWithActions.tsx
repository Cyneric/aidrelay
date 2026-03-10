import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Edit3, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { filesService } from '@/services/files.service'
import { FileEditModal } from './FileEditModal'

interface PathWithActionsProps {
  readonly path: string
  readonly className?: string
  readonly textClassName?: string
  readonly showFolderIcon?: boolean
  readonly allowEdit?: boolean
  readonly testIdPrefix?: string
}

const PathWithActions = ({
  path,
  className,
  textClassName,
  showFolderIcon = false,
  allowEdit = true,
  testIdPrefix = 'path-action',
}: PathWithActionsProps) => {
  const { t } = useTranslation()
  const [revealing, setRevealing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const handleReveal = async () => {
    setRevealing(true)
    try {
      await filesService.reveal(path)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('files.errorRevealDefault')
      toast.error(t('files.errorReveal', { message }))
    } finally {
      setRevealing(false)
    }
  }

  return (
    <>
      <div className={className}>
        {showFolderIcon ? <FolderOpen size={11} aria-hidden="true" className="shrink-0" /> : null}
        <span className={textClassName} title={path}>
          {path}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => void handleReveal()}
              disabled={revealing}
              aria-label={t('files.reveal')}
              data-testid={`${testIdPrefix}-reveal`}
            >
              <FolderOpen size={12} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('files.reveal')}</TooltipContent>
        </Tooltip>
        {allowEdit ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setEditOpen(true)}
                aria-label={t('files.edit')}
                data-testid={`${testIdPrefix}-edit`}
              >
                <Edit3 size={12} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('files.edit')}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {allowEdit ? <FileEditModal path={path} open={editOpen} onOpenChange={setEditOpen} /> : null}
    </>
  )
}

export { PathWithActions }
