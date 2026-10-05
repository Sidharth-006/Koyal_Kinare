import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { AlertCircle } from 'lucide-react';

interface DeactivateRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionId: string;
  versionNumber: number;
  menuItemName: string;
  onSuccess: () => void;
}

export const DeactivateRecipeModal: React.FC<DeactivateRecipeModalProps> = ({
  isOpen,
  onClose,
  versionId,
  versionNumber,
  menuItemName,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length > 0 && trimmedReason.length <= 500;

  const handleDeactivate = async () => {
    setTouched(true);
    if (!isReasonValid) return;

    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await api.deactivateRecipeVersion(
        versionId,
        { confirm: true, reason: trimmedReason },
        idempotencyKey
      );
      showToast(`Active recipe for ${menuItemName} deactivated.`, 'success');
      setReason('');
      setTouched(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate recipe.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deactivate Active Recipe" size="md">
      <div className="space-y-4">
        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            Deactivating Version {versionNumber} for {menuItemName}
          </p>
          <p className="text-rose-700 mt-1">
            Deactivating stops the currently active recipe for this menu item. Historic recipe versions remain preserved in history. Future orders will consider this menu item as having no active recipe until a new version is activated.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Deactivation Reason <span className="text-rose-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setTouched(true);
            }}
            placeholder="Please provide a mandatory reason for deactivating this recipe (e.g. Menu item discontinued, Recipe rework in progress)..."
            rows={3}
            maxLength={500}
            className={`w-full text-xs p-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-forest-800/20 ${
              touched && !isReasonValid
                ? 'border-rose-400 bg-rose-50/30'
                : 'border-border bg-white'
            }`}
            data-testid="deactivation-reason-input"
          />
          <div className="flex justify-between items-center text-[11px]">
            {touched && trimmedReason.length === 0 ? (
              <span className="text-rose-600 font-medium">Deactivation reason is required.</span>
            ) : touched && trimmedReason.length > 500 ? (
              <span className="text-rose-600 font-medium">Reason cannot exceed 500 characters.</span>
            ) : (
              <span className="text-slate-400">Required explanation</span>
            )}
            <span className={`font-mono ${trimmedReason.length > 500 ? 'text-rose-600' : 'text-slate-400'}`}>
              {trimmedReason.length}/500
            </span>
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
            variant="danger"
            onClick={handleDeactivate}
            isLoading={submitting}
            disabled={submitting || !isReasonValid}
            className="min-h-[44px]"
            data-testid="confirm-deactivate-btn"
          >
            Confirm Deactivation
          </Button>
        </div>
      </div>
    </Modal>
  );
};
