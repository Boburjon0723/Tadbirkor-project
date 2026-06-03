'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, Check, Copy } from 'lucide-react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) {
      toast.error('Sinov muddati tugagan. Saqlash uchun obunani faollashtiring (Sozlamalar → Obuna).');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.patch('/companies/me', {
        name: form.name,
        tin: form.tin,
        storefrontUrl: form.storefrontUrl?.trim() || undefined,
        posCreditEnabled: form.posCreditEnabled,
        posMaxDiscountPercent: Number(form.posMaxDiscountPercent),
        inventoryVarianceTolerancePct: Number(form.inventoryVarianceTolerancePct),
      });
      onUpdate(res.data);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      setSuccess(true);
      toast.success('Kompaniya ma’lumotlari saqlandi');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast.error(formatApiError(err, 'Saqlashda xato. Internet yoki ruxsatni tekshiring.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateToken = async () => {
    try {
      setTokenLoading(true);
      const res = await api.patch('/companies/me/storefront-token');
      onUpdate({ ...company, storefrontToken: res.data.storefrontToken });
    } catch (err) {
      console.error(err);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopySnippet = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api';
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
    <form onSubmit={handleSubmit} className="glass-card p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Kompaniya Nomi</label>
          <input 
            required
            type="text" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white"
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">STIR (TIN)</label>
          <input 
            required
            type="text" 
            maxLength={9}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white"
            value={form.tin}
            onChange={(e) => setForm({...form, tin: e.target.value.replace(/\D/g, '')})}
          />
        </div>
        <label className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer">
          <div>
            <p className="font-black text-sm">POS nasiya (mijozlar qarzi)</p>
            <p className="text-xs text-gray-500 font-bold mt-1">
              Yoqilganda kassada «Nasiya» to&apos;lovi va Mijozlar qarzi bo&apos;limi ishlaydi.
            </p>
          </div>
          <input
            type="checkbox"
            checked={form.posCreditEnabled}
            onChange={(e) => setForm({ ...form, posCreditEnabled: e.target.checked })}
            className="w-5 h-5 accent-blue-500"
          />
        </label>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
            POS maks. chegirma (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white"
            value={form.posMaxDiscountPercent}
            onChange={(e) =>
              setForm({
                ...form,
                posMaxDiscountPercent: Math.min(
                  100,
                  Math.max(0, Number(e.target.value) || 0),
                ),
              })
            }
          />
          <p className="text-xs text-gray-500 font-bold ml-1">
            Kassirlar ushbu foizdan ortiq chegirma qila olmaydi (MANAGER/OWNER chekirmasiz o&apos;zgartirishi mumkin).
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
            Inventarizatsiya farq chegarasi (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            disabled={!canWrite}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-teal-500/50 transition-all text-white"
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
          />
          <p className="text-xs text-gray-500 font-bold ml-1">
            Sanashda shu foizdan katta farq manager tasdiqlashini talab qiladi (standart: 1%).
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Web sayt URL</label>
          <input
            type="url"
            placeholder="https://yourshop.uz"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-emerald-500/50 transition-all text-white"
            value={form.storefrontUrl}
            onChange={(e) => setForm({ ...form, storefrontUrl: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Storefront token</label>
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
              disabled={tokenLoading}
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
            {`GET ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api'}/storefront/${company?.id}/products`}
          </code>
          <p className="text-[11px] text-gray-500">
            Header: <span className="text-gray-300">x-storefront-token: {company?.storefrontToken || 'TOKEN_YARATING'}</span>
          </p>
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

          <div className="text-[11px] text-gray-500 font-bold space-y-1">
            <p>
              Tizimdagi telefon:{' '}
              <span className="text-gray-300">
                {sessionUser?.phone || company?.phone || '— kiritilmagan'}
              </span>
            </p>
            <p>
              Xodimlar botda faqat «Telefon raqamni ulashish» tugmasini bosadi (qo‘lda yozmaydi) — rol avtomatik taniladi.
            </p>
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
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-xs font-black text-gray-300 hover:text-white transition-all"
                >
                  Telegramda ochish
                </a>

                <button
                  type="button"
                  onClick={handleCopyTelegramLink}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-xs font-black text-gray-300 hover:text-white transition-all"
                >
                  {telegramCopied ? 'COPIED' : 'LINK COPY'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await refreshCompany();
                    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-black disabled:opacity-50"
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
            <div className="space-y-2">
              {telegramBindingLoading ? (
                <p className="text-[11px] text-gray-500">Yuklanmoqda...</p>
              ) : telegramBindings.length === 0 ? (
                <p className="text-[11px] text-gray-500">
                  Hali ulanish yo‘q. Botda telefon ulangach, rollar shu yerda paydo bo‘ladi.
                </p>
              ) : (
                telegramBindings.map((binding) => (
                  <div
                    key={binding.id}
                    className="flex items-center justify-between gap-2 text-[11px] bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                  >
                    <span className="font-bold text-gray-300">
                      {binding.role} / {binding.moduleKey}
                      {binding.enabled ? '' : ' (o‘chirilgan)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBinding(binding.role, binding.moduleKey)}
                      className="text-red-300 hover:text-red-200 font-black"
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

      <button 
        type="submit"
        disabled={isSubmitting || !canWrite}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="animate-spin" /> : (success ? 'Yangilandi!' : <><Save size={20} /> Saqlash</>)}
      </button>
    </form>
  );
}
