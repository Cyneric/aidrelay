import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CreateConfigConfirmDialogProps {
  readonly clientName: string
  readonly open: boolean
  readonly submitting?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const CreateConfigConfirmDialog = ({
  clientName,
  open,
  submitting = false,
  onConfirm,
  onCancel,
}: CreateConfigConfirmDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <DialogContent
        className="max-w-md"
        showCloseButton={false}
        data-testid="create-config-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('clients.createConfigTitle')}</DialogTitle>
          <DialogDescription>
            {t('clients.createConfigDescription', { name: clientName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            data-testid="create-config-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            data-testid="create-config-confirm"
          >
            {submitting ? t('clients.syncingButton') : t('clients.createConfigConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CreateConfigConfirmDialog }
