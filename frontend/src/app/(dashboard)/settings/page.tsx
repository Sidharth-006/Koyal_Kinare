'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { BusinessSettingsDTO, TargetSettingsDTO, TaxSettingsDTO, TableDTO } from '@/lib/types';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Building2, Target, Percent, Grid, LogOut, Save } from 'lucide-react';

export default function SettingsPage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'BUSINESS' | 'TARGETS' | 'TAX' | 'TABLES'>('BUSINESS');
  const [loading, setLoading] = useState(true);

  // Data States
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsDTO | null>(null);
  const [targetSettings, setTargetSettings] = useState<TargetSettingsDTO | null>(null);
  const [taxSettings, setTaxSettings] = useState<TaxSettingsDTO | null>(null);
  const [tables, setTables] = useState<TableDTO[]>([]);

  // Form States
  const [cafeName, setCafeName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fssaiLicense, setFssaiLicense] = useState('');
  const [receiptFooterText, setReceiptFooterText] = useState('');
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [dailySalesTarget, setDailySalesTarget] = useState('');
  const [monthlySalesTarget, setMonthlySalesTarget] = useState('');
  const [savingTargets, setSavingTargets] = useState(false);

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxLabel, setTaxLabel] = useState('GST');
  const [taxRate, setTaxRate] = useState('5');
  const [taxIsInclusive, setTaxIsInclusive] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, tablesRes] = await Promise.all([
        api.getSettings(),
        api.listTables()
      ]);

      const s = settingsRes.settings;
      if (s) {
        setBusinessSettings(s.business);
        setCafeName(s.business.cafe_name || s.business.cafeName || '');
        setAddress(s.business.address || '');
        setPhone(s.business.contact_phone || s.business.phone || '');
        setEmail(s.business.email || '');
        setFssaiLicense(s.business.fssai_license || s.business.fssaiLicense || '');
        setReceiptFooterText(s.business.receipt_footer || s.business.receiptFooterText || '');

        setTargetSettings(s.targets);
        setDailySalesTarget(String(s.targets.daily_sales_target || s.targets.dailySalesTarget || 0));
        setMonthlySalesTarget(String(s.targets.monthly_sales_target || s.targets.monthlySalesTarget || 0));

        setTaxSettings(s.tax);
        setTaxEnabled(s.tax.enabled || false);
        setTaxLabel(s.tax.label || 'GST');
        setTaxRate(String(s.tax.rate || 0));
        setTaxIsInclusive(s.tax.is_inclusive || s.tax.isInclusive || false);
      }

      setTables(tablesRes.tables || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBusiness(true);
    try {
      const res = await api.updateBusinessSettings({
        cafe_name: cafeName,
        cafeName,
        address,
        phone,
        email,
        fssai_license: fssaiLicense,
        receipt_footer: receiptFooterText
      } as any);
      setBusinessSettings(res.settings);
      showToast('Business details updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update business settings', 'error');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTargets(true);
    try {
      const res = await api.updateTargetSettings({
        dailySalesTarget: parseFloat(dailySalesTarget) || 0,
        monthlySalesTarget: parseFloat(monthlySalesTarget) || 0
      });
      setTargetSettings(res.targets);
      showToast('Sales targets updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update sales targets', 'error');
    } finally {
      setSavingTargets(false);
    }
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTax(true);
    try {
      const res = await api.updateTaxSettings({
        enabled: taxEnabled,
        label: taxLabel,
        rate: parseFloat(taxRate) || 0,
        isInclusive: taxIsInclusive
      });
      setTaxSettings(res.tax);
      showToast('Tax configuration updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update tax settings', 'error');
    } finally {
      setSavingTax(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      showToast('Logged out successfully', 'info');
      router.push('/login');
    } catch (err: any) {
      showToast(err.message || 'Failed to logout', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto font-sans">
        <Card className="p-8 text-center text-slate-400 font-medium">Loading system settings...</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">System & Business Settings</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage cafe details, tax rates, sales targets, and layout tables</p>
        </div>
        <Button variant="danger" size="sm" onClick={handleLogout} icon={<LogOut className="w-3.5 h-3.5" />}>
          Sign Out
        </Button>
      </div>

      {/* Tabs */}
      <Card className="flex flex-wrap gap-2 bg-cream-50 p-1.5 border-border">
        <button
          onClick={() => setActiveTab('BUSINESS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'BUSINESS'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Business Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('TARGETS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'TARGETS'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Sales Targets</span>
        </button>
        <button
          onClick={() => setActiveTab('TAX')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'TAX'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>GST & Tax Config</span>
        </button>
        <button
          onClick={() => setActiveTab('TABLES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'TABLES'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Table Layout ({tables.length})</span>
        </button>
      </Card>

      {/* TAB 1: BUSINESS PROFILE */}
      {activeTab === 'BUSINESS' && (
        <Card className="space-y-4 border-border p-6">
          <h2 className="text-base font-bold text-forest-800 border-b border-border pb-3">
            Cafe Information & Receipt Metadata
          </h2>
          <form onSubmit={handleSaveBusiness} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Cafe / Outlet Name *"
                value={cafeName}
                onChange={(e) => setCafeName(e.target.value)}
                required
              />
              <Input
                label="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label="Contact Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="FSSAI License No."
                value={fssaiLicense}
                onChange={(e) => setFssaiLicense(e.target.value)}
              />
            </div>

            <Input
              label="Physical Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <Input
              label="Receipt Footer Text"
              placeholder="e.g. Thank you for visiting Koyal Kinare Cafe!"
              value={receiptFooterText}
              onChange={(e) => setReceiptFooterText(e.target.value)}
            />

            <div className="flex justify-end pt-2">
              <Button variant="primary" type="submit" isLoading={savingBusiness} icon={<Save className="w-4 h-4" />}>
                Save Business Profile
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 2: SALES TARGETS */}
      {activeTab === 'TARGETS' && (
        <Card className="space-y-4 border-border p-6">
          <h2 className="text-base font-bold text-forest-800 border-b border-border pb-3">
            Revenue Performance Targets
          </h2>
          <form onSubmit={handleSaveTargets} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Daily Sales Target (₹) *"
                type="number"
                min="0"
                step="500"
                value={dailySalesTarget}
                onChange={(e) => setDailySalesTarget(e.target.value)}
                required
              />
              <Input
                label="Monthly Sales Target (₹) *"
                type="number"
                min="0"
                step="5000"
                value={monthlySalesTarget}
                onChange={(e) => setMonthlySalesTarget(e.target.value)}
                required
              />
            </div>

            <div className="p-3.5 bg-cream-50 border border-border rounded-xl text-xs text-slate-600 font-medium">
              Targets set here will render live progress bars on the Executive Dashboard.
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" type="submit" isLoading={savingTargets} icon={<Save className="w-4 h-4" />}>
                Save Sales Targets
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 3: GST & TAX CONFIG */}
      {activeTab === 'TAX' && (
        <Card className="space-y-4 border-border p-6">
          <h2 className="text-base font-bold text-forest-800 border-b border-border pb-3">
            Tax Calculation Rules
          </h2>
          <form onSubmit={handleSaveTax} className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-cream-50 border border-border rounded-2xl cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-border text-forest-800 focus:ring-forest-800/20"
              />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-forest-800">Enable Tax Calculation</span>
                <p className="text-xs text-slate-500 font-medium">Apply tax on POS completed bills</p>
              </div>
            </label>

            {taxEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <Input
                  label="Tax Label *"
                  placeholder="e.g. GST"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  required
                />
                <Input
                  label="Tax Rate (%) *"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="primary" type="submit" isLoading={savingTax} icon={<Save className="w-4 h-4" />}>
                Save Tax Configuration
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 4: TABLE LAYOUT */}
      {activeTab === 'TABLES' && (
        <Card className="p-0 overflow-hidden border-border">
          <div className="p-4 bg-cream-50/70 border-b border-border flex justify-between items-center">
            <h3 className="font-bold text-forest-800 text-sm">Dine-In Table Layout</h3>
            <Badge variant="forest">{tables.length} Total Tables</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-cream-50/40 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-4">Table Name</th>
                  <th className="p-4 text-center">Seating Capacity</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {tables.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400 font-medium">
                      No dine-in tables configured
                    </td>
                  </tr>
                ) : (
                  tables.map((table) => (
                    <tr key={table.id} className="hover:bg-cream-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{table.table_number || table.name}</td>
                      <td className="p-4 text-center font-bold text-slate-700">
                        {table.capacity} Persons
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="success">AVAILABLE</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
