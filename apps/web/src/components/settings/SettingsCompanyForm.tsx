'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Check, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { companiesService } from '@/services/companies.service';
import { useQueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY, useSession } from '@/hooks/use-session';
import { toast, formatApiError } from '@/lib/toast';

type Props = {
  company: any;
  onUpdate: (company: any) => void;
  canWrite?: boolean;
};

type FieldKey =
  | 'name'
  | 'tin'
  | 'posCreditEnabled'
  | 'posMaxDiscountPercent'
  | 'inventoryVarianceTolerancePct'
  | 'storefrontUrl';

function FieldSaveHint({
  field,
  saving,
  saved,
}: {
  field: FieldKey;
  saving: FieldKey | null;
  saved: FieldKey | null;
}) {
  if (saving === field) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 ml-2">
        <Loader2 className="animate-spin" size={12} />
        Saqlanmoqda
      </span>
    );
  }
  if (saved === field) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 ml-2">
        <Check size={12} />
        Saqlandi
      </span>
    );
  }
  return null;
}

export function SettingsCompanyForm({ company, onUpdate, canWrite = true }: Props) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const sessionUser = session?.me?.user;
  const [form, setForm] = useState({
    name: company?.name || '',
    tin: company?.tin || '',
    storefrontUrl: company?.storefrontUrl || '',
    posCreditEnabled: !!company?.posCreditEnabled,
    posMaxDiscountPercent:
      company?.posMaxDiscountPercent != null
        ? Number(company.posMaxDiscountPercent)
        : 15,
    inventoryVarianceTolerancePct:
      company?.inventoryVarianceTolerancePct != null
        ? Number(company.inventoryVarianceTolerancePct)
        : 1,
  });
  const [savingField, setSavingField] = useState<FieldKey | null>(null);
  const [savedField, setSavedField] = useState<FieldKey | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const [telegramInitLoading, setTelegramInitLoading] = useState(false);
  const [telegramStartUrl, setTelegramStartUrl] = useState<string | null>(null);
  const [telegramCopied, setTelegramCopied] = useState(false);
  const [telegramStatusMessage, setTelegramStatusMessage] = useState<string | null>(null);
  const [telegramBindings, setTelegramBindings] = useState<any[]>([]);
  const [telegramBindingLoading, setTelegramBindingLoading] = useState(false);
  const [telegramLinkInfo, setTelegramLinkInfo] = useState<{
    registeredPhone?: string;
    instructions?: string;
  } | null>(null);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        tin: company.tin || '',
        storefrontUrl: company.storefrontUrl || '',
        posCreditEnabled: !!company.posCreditEnabled,
        posMaxDiscountPercent:
          company.posMaxDiscountPercent != null
            ? Number(company.posMaxDiscountPercent)
            : 15,
        inventoryVarianceTolerancePct:
          company.inventoryVarianceTolerancePct != null
            ? Number(company.inventoryVarianceTolerancePct)
            : 1,
      });
    }
  }, [company]);

  useEffect(() => {
    const loadBindings = async () => {
      try {
        setTelegramBindingLoading(true);
        const data = await companiesService.getTelegramBindings();
        setTelegramBindings(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setTelegramBindingLoading(false);
      }
    };
    loadBindings();
  }, []);

  const flashSaved = useCallback((field: FieldKey) => {
    setSavedField(field);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedField(null), 2000);
  }, []);

  const patchField = useCallback(
    async (field: FieldKey, body: Record<string, unknown>, revert?: () => void) => {
      if (!canWrite) {
        toast.error('Sinov muddati tugagan. Saqlash uchun obunani faollashtiring (Sozlamalar → Obuna).');
        revert?.();
        return;
      }
      setSavingField(field);
      try {
        const res = await api.patch('/companies/me', body);
        onUpdate(res.data);
        void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        flashSaved(field);
      } catch (err) {
        revert?.();
        toast.error(formatApiError(err, 'Saqlashda xatolik'));
      } finally {
        setSavingField(null);
      }
    },
    [canWrite, flashSaved, onUpdate, queryClient],
  );

  const saveName = () => {
    const name = form.name.trim();
    if (!name || name === (company?.name || '').trim()) return;
    void patchField('name', { name });
  };

  const saveTin = () => {
    const tin = form.tin.replace(/\D/g, '');
    const saved = String(company?.tin || '').replace(/\D/g, '');
    if (tin === saved) return;
    if (tin.length !== 9) {
      toast.error('STIR aynan 9 ta raqamdan iborat bo‘lishi kerak');
      setForm((prev) => ({ ...prev, tin: saved }));
      return;
    }
    void patchField('tin', { tin });
  };

  const savePosCredit = (enabled: boolean) => {
    const prev = !!company?.posCreditEnabled;
    if (enabled === prev) return;
    void patchField(
      'posCreditEnabled',
      { posCreditEnabled: enabled },
      () => setForm((f) => ({ ...f, posCreditEnabled: prev })),
    );
  };

  const saveDiscount = () => {
    const val = Number(form.posMaxDiscountPercent);
    const saved =
      company?.posMaxDiscountPercent != null
        ? Number(company.posMaxDiscountPercent)
        : 15;
    if (val === saved) return;
    void patchField(
      'posMaxDiscountPercent',
      { posMaxDiscountPercent: val },
      () => setForm((f) => ({ ...f, posMaxDiscountPercent: saved })),
    );
  };

  const saveInventoryTolerance = () => {
    const val = Number(form.inventoryVarianceTolerancePct);
    const saved =
      company?.inventoryVarianceTolerancePct != null
        ? Number(company.inventoryVarianceTolerancePct)
        : 1;
    if (val === saved) return;
    void patchField(
      'inventoryVarianceTolerancePct',
      { inventoryVarianceTolerancePct: val },
      () => setForm((f) => ({ ...f, inventoryVarianceTolerancePct: saved })),
    );
  };

  const saveStorefrontUrl = () => {
    const url = form.storefrontUrl.trim();
    const saved = (company?.storefrontUrl || '').trim();
    if (url === saved) return;
    void patchField(
      'storefrontUrl',
      { storefrontUrl: url || undefined },
      () => setForm((f) => ({ ...f, storefrontUrl: saved })),
    );
  };

  const handleRegenerateToken = async () => {
    try {
      setTokenLoading(true);
      const res = await api.patch('/companies/me/storefront-token');
      onUpdate({ ...company, storefrontToken: res.data.storefrontToken });
      toast.success('Storefront token yangilandi');
    } catch (err) {
      toast.error(formatApiError(err, 'Token yaratib bo‘lmadi'));
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopySnippet = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003/api';
    const snippet = `fetch('${apiBase}/storefront/${company?.id}/products', {\n  headers: {\n    'x-storefront-token': '${company?.storefrontToken || ''}'\n  }\n}).then(res => res.json()).then(console.log);`;
    await navigator.clipboard.writeText(snippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  const refreshCompany = async () => {
    const res = await api.get('/companies/me');
    onUpdate(res.data);
  };

  const handleInitTelegramLink = async () => {
    try {
      setTelegramInitLoading(true);
      setTelegramStatusMessage(null);
      const res = await api.post('/companies/me/telegram-link/init');
      setTelegramStartUrl(res.data.startUrl || res.data.botUrl);
      setTelegramLinkInfo({
        registeredPhone: res.data.registeredPhone,
        instructions: res.data.instructions,
      });
      setTelegramStatusMessage(
        res.data.instructions ||
          'Botni oching va «Telefon raqamni ulashish» tugmasini bosing (qo‘lda yozmang).',
      );
    } catch (err) {
      console.error(err);
      setTelegramStatusMessage('Telegram link yaratishda xato bo\'ldi.');
    } finally {
      setTelegramInitLoading(false);
    }
  };

  const handleCopyTelegramLink = async () => {
    if (!telegramStartUrl) return;
    await navigator.clipboard.writeText(telegramStartUrl);
    setTelegramCopied(true);
    setTimeout(() => setTelegramCopied(false), 2000);
  };

  const handleRemoveBinding = async (role: string, moduleKey: string) => {
    try {
      await companiesService.removeTelegramBinding({ role, moduleKey });
      const data = await companiesService.getTelegramBindings();
      setTelegramBindings(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="glass-card p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-6">
      <p className="text-xs text-neutral-500 font-bold">
        Har bir maydon alohida saqlanadi — o‘zgartiring va maydondan chiqing (blur) yoki checkboxni bosing.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center">
            Kompaniya Nomi
            <FieldSaveHint field="name" saving={savingField} saved={savedField} />
          </label>
          <input
            type="text"
            disabled={!canWrite}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white disabled:opacity-60"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={saveName}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center">
            STIR (TIN)
            <FieldSaveHint field="tin" saving={savingField} saved={savedField} />
          </label>
          <input
            type="text"
            maxLength={9}
            disabled={!canWrite}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white disabled:opacity-60"
            value={form.tin}
            onChange={(e) => setForm({ ...form, tin: e.target.value.replace(/\D/g, '') })}
            onBlur={saveTin}
          />
          {form.tin && form.tin.length !== 9 && (
            <p className="text-[10px] text-amber-500 ml-1 font-bold">9 ta raqam kerak</p>
          )}
        </div>

        <label
          className={`flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl ${
            canWrite ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div>
            <p className="font-black text-sm flex items-center flex-wrap gap-1">
              POS nasiya (mijozlar qarzi)
              <FieldSaveHint field="posCreditEnabled" saving={savingField} saved={savedField} />
            </p>
            <p className="text-xs text-gray-500 font-bold mt-1">
              Yoqilganda kassada «Nasiya» to&apos;lovi va Mijozlar qarzi bo&apos;limi ishlaydi.
            </p>
            {!canWrite && (
              <p className="text-xs text-amber-400 font-bold mt-2">
                Sinov tugagan — yoqish uchun «Obuna» tabida faollashtiring.
              </p>
            )}
          </div>
          <input
            type="checkbox"
            checked={form.posCreditEnabled}
            disabled={!canWrite || savingField === 'posCreditEnabled'}
            onChange={(e) => {
              const enabled = e.target.checked;
              setForm({ ...form, posCreditEnabled: enabled });
              savePosCredit(enabled);
            }}
            className="w-5 h-5 accent-blue-500 disabled:cursor-not-allowed"
          />
        </label>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center">
            POS maks. chegirma (%)
            <FieldSaveHint field="posMaxDiscountPercent" saving={savingField} saved={savedField} />
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            disabled={!canWrite}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white disabled:opacity-60"
            value={form.posMaxDiscountPercent}
            onChange={(e) =>
              setForm({
                ...form,
                posMaxDiscountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
              })
            }
            onBlur={saveDiscount}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center">
            Inventarizatsiya farq chegarasi (%)
            <FieldSaveHint field="inventoryVarianceTolerancePct" saving={savingField} saved={savedField} />
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            disabled={!canWrite}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-teal-500/50 transition-all text-white disabled:opacity-60"
            value={form.inventoryVarianceTolerancePct}
            onChange={(e) =>
              setForm({
                ...form,
                inventoryVarianceTolerancePct: Math.min(
                  100,
                  Math.max(0, Number(e.target.value) || 0),
                ),
              })
            }
            onBlur={saveInventoryTolerance}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center">
            Web sayt URL
            <FieldSaveHint field="storefrontUrl" saving={savingField} saved={savedField} />
          </label>
          <input
            type="url"
            placeholder="https://yourshop.uz"
            disabled={!canWrite}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white disabled:opacity-60"
            value={form.storefrontUrl}
            onChange={(e) => setForm({ ...form, storefrontUrl: e.target.value })}
            onBlur={saveStorefrontUrl}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
            Storefront token
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={company?.storefrontToken || ''}
              placeholder="Token yaratilmagan"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none text-white"
            />
            <button
              type="button"
              onClick={handleRegenerateToken}
              disabled={tokenLoading || !canWrite}
              className="px-4 py-4 sm:py-2 bg-blue-600 hover:bg-blue-500 rounded-2xl text-xs font-black disabled:opacity-50 shrink-0"
            >
              {tokenLoading ? '...' : 'Token yaratish'}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-black/20 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-gray-300">Ulash uchun snippet</p>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="text-[10px] font-black text-blue-300 hover:text-blue-200 flex items-center gap-1"
            >
              {snippetCopied ? <Check size={12} /> : <Copy size={12} />}
              {snippetCopied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          <code className="block text-[11px] text-gray-400 break-all">
            {`GET ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003/api'}/storefront/${company?.id}/products`}
          </code>
        </div>

        <div className="p-4 rounded-2xl bg-black/20 border border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-black text-gray-300">Telegram (telefon orqali)</p>
            <div className="flex gap-2">
              <span
                className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                  sessionUser?.telegramChatId
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-gray-500/20 text-gray-300'
                }`}
              >
                {sessionUser?.telegramChatId ? 'SIZ ULANDINGIZ' : 'SIZ ULANMAGANSIZ'}
              </span>
              <span
                className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                  company?.telegramChatId
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-gray-500/20 text-gray-300'
                }`}
              >
                {company?.telegramChatId ? 'KOMPANIYA ULANGAN' : 'KOMPANIYA ULANMAGAN'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleInitTelegramLink}
              disabled={telegramInitLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-2xl text-xs font-black disabled:opacity-50"
            >
              {telegramInitLoading ? '...' : 'Botni ochish'}
            </button>
            {telegramStartUrl && (
              <>
                <a
                  href={telegramStartUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-gray-300"
                >
                  Telegramda ochish
                </a>
                <button
                  type="button"
                  onClick={handleCopyTelegramLink}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-gray-300"
                >
                  {telegramCopied ? 'COPIED' : 'LINK COPY'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await refreshCompany();
                    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
                  }}
                  className="px-4 py-2 bg-emerald-600 rounded-2xl text-xs font-black"
                >
                  Tekshirish
                </button>
              </>
            )}
          </div>

          {telegramLinkInfo?.registeredPhone && (
            <p className="text-[11px] text-amber-300/90 font-bold">
              Botda ulash uchun raqam: {telegramLinkInfo.registeredPhone}
            </p>
          )}
          {telegramStatusMessage && (
            <p className="text-[11px] font-bold text-blue-300">{telegramStatusMessage}</p>
          )}

          <div className="pt-2 border-t border-white/10 space-y-2">
            <p className="text-[11px] font-black text-gray-300">Avtomatik rol bog‘lanishlari</p>
            {telegramBindingLoading ? (
              <p className="text-[11px] text-gray-500">Yuklanmoqda...</p>
            ) : telegramBindings.length === 0 ? (
              <p className="text-[11px] text-gray-500">Hali ulanish yo‘q.</p>
            ) : (
              telegramBindings.map((binding) => (
                <div
                  key={binding.id}
                  className="flex items-center justify-between gap-2 text-[11px] bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                >
                  <span className="font-bold text-gray-300">
                    {binding.role} / {binding.moduleKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBinding(binding.role, binding.moduleKey)}
                    className="text-red-300 font-black"
                  >
                    O&apos;CHIRISH
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
