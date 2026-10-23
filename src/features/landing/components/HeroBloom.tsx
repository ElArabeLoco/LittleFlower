/**
 * HeroBloom — the landing's signature: the Florecita flower blooms once on
 * load and each petal tip carries one thing the app does.
 *
 *            [Funciona sin internet]
 *     [El año]       ✿✿✿        [Para dos]
 *                  ✿✿ ✿✿
 *        [Nada se borra]   [Pesos y dólares]
 *
 * From `sm` up the tags sit on the petal tips (positions are percentages of a
 * 720×560 box, so they track the flower at any width). On phones the flower
 * stands alone and the same tags wrap below it.
 */

import { Coins, History, Sheet, Users, WifiOff, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { FlowerMark } from '@/shared/ui/FlowerMark';
import { cn } from '@/shared/ui/cn';

type TagKey = 'tagOffline' | 'tagCouple' | 'tagCurrency' | 'tagLedger' | 'tagYear';

interface PetalTag {
  key: TagKey;
  icon: LucideIcon;
  tone: string;
  /** Petal tip position, as a percentage of the 720×560 box. */
  x: number;
  y: number;
}

// Clockwise from the top petal, matching FlowerMark's PETAL_ANGLES.
const TAGS: PetalTag[] = [
  { key: 'tagOffline', icon: WifiOff, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', x: 50, y: 9.46 },
  { key: 'tagCouple', icon: Users, tone: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300', x: 82.36, y: 39.64 },
  { key: 'tagCurrency', icon: Coins, tone: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300', x: 70, y: 88.57 },
  { key: 'tagLedger', icon: History, tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', x: 30, y: 88.57 },
  { key: 'tagYear', icon: Sheet, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', x: 17.64, y: 39.64 },
];

/** The tags fade in once the petals have opened. */
const TAG_DELAY_MS = 1100;

function TagContent({ tag, label }: { tag: PetalTag; label: string }) {
  const Icon = tag.icon;
  return (
    <>
      <span className={cn('grid size-[26px] shrink-0 place-items-center rounded-full', tag.tone)}>
        <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
      </span>
      {label}
    </>
  );
}

export function HeroBloom() {
  const { t } = useI18n();

  return (
    <div className="w-full max-w-[720px]">
      <div className="relative aspect-[720/560]">
        {/* Dashed ring through the petal tips: visible between the petals. */}
        <div
          aria-hidden="true"
          className="absolute left-[21.25%] top-[16.2%] aspect-square w-[57.5%] rounded-full border-[1.5px] border-dashed border-[var(--border-cell)]"
        />
        <FlowerMark bloom className="absolute left-[18.06%] top-[10.71%] aspect-square h-auto w-[63.89%]" />

        <ul className="hidden sm:block">
          {TAGS.map((tag, index) => (
            <li
              key={tag.key}
              className="flower-bloom-tag absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-[7px] pl-[7px] pr-3.5 text-sm font-[620] text-[var(--text-primary)] shadow-lg"
              style={{ left: `${tag.x}%`, top: `${tag.y}%`, animationDelay: `${TAG_DELAY_MS + index * 100}ms` }}
            >
              <TagContent tag={tag} label={t.landing[tag.key]} />
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-2 flex flex-wrap justify-center gap-2 sm:hidden">
        {TAGS.map(tag => (
          <li
            key={tag.key}
            className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-1.5 pr-3 text-[13px] font-[620] text-[var(--text-primary)]"
          >
            <TagContent tag={tag} label={t.landing[tag.key]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
