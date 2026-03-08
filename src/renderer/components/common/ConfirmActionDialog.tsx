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

interface ConfirmActionDialogProps {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly pending?: boolean
  readonly variant?: 'default' | 'destructive'
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const ConfirmActionDialog = ({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="max-w-md"
        data-testid="confirm-action-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={onConfirm}
            disabled={pending}
            data-testid="confirm-action-submit"
          >
            {pending ? t('common.loading') : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmActionDialog }
