/**
 * @file src/renderer/components/stacks/StacksDialog.tsx
 *
 * @created 17.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Dialog wrapper for stack export and import functionality.
 * Uses tabs to switch between StackExporter and StackImporter components.
 */

import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StackExporter } from '@/components/stacks/StackExporter'
import { StackImporter } from '@/components/stacks/StackImporter'

// ─── Props ────────────────────────────────────────────────────────────────────

interface StacksDialogProps {
  readonly onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal dialog that wraps StackExporter and StackImporter in a tabbed layout.
 * Defaults to the export tab.
 */
const StacksDialog = ({ onClose }: Readonly<StacksDialogProps>) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="stacks-dialog">
        <DialogHeader>
          <DialogTitle>{t('stacks.title')}</DialogTitle>
          <DialogDescription>{t('stacks.subtitle')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="export" data-testid="stacks-tabs">
          <TabsList data-testid="stacks-tabs-list">
            <TabsTrigger value="export" data-testid="stacks-tab-export">
              {t('stacks.export')}
            </TabsTrigger>
            <TabsTrigger value="import" data-testid="stacks-tab-import">
              {t('stacks.import')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="export" data-testid="stacks-tab-content-export">
            <StackExporter />
          </TabsContent>
          <TabsContent value="import" data-testid="stacks-tab-content-import">
            <StackImporter />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export { StacksDialog }
