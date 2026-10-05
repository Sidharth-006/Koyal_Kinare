import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ActivateRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionId: string;
  versionNumber: number;
  menuItemName: string;
  onSuccess: () => void;
}

export const ActivateRecipeModal: React.FC<ActivateRecipeModalProps> = ({
  isOpen,
  onClose,
  versionId,
  versionNumber,
  menuItemName,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleActivate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await api.activateRecipeVersion(versionId, { confirm: true }, idempotencyKey);
      showToast(`Version ${versionNumber} activated for ${menuItemName}!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to activate recipe version.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activate Recipe Version" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">You are activating Version {versionNumber} for {menuItemName}.</p>
            <p className="text-amber-700 mt-0.5">Please review the activation terms below before confirming.</p>
          </div>
        </div>

        <div className="p-4 bg-cream-50/60 rounded-xl border border-border space-y-2.5 text-xs text-slate-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Future Bills:</strong> Future orders and bills will automatically use this active recipe version.</span>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
            <span><strong>Historic Invariance:</strong> Historic sales and past orders remain unchanged.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0 mt-1.5 ml-1" />
            <span><strong>Inventory Note:</strong> Automatic stock consumption from recipe sales is handled in Phase 3 Module 3.</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleActivate}
            isLoading={submitting}
            disabled={submitting}
            className="min-h-[44px]"
            data-testid="confirm-activate-btn"
          >
            Confirm & Activate
          </Button>
        </div>
      </div>
    </Modal>
  );
};
