'use client';

import { CldImage } from 'next-cloudinary';
import {
  getMatchResultImageOptions,
  MATCH_RESULT_GRAPHIC_HEIGHT,
  MATCH_RESULT_GRAPHIC_WIDTH,
  type MatchResultData,
} from '@/lib/cloudinary-utils';
import {
  getMatchResultGraphicLang,
  type MatchResultGraphicLocale,
} from '@/lang/matchResultGraphic';
import { getTeamsLang } from '@/lang/teams';
import { cn } from '@/lib/utils';

type Props = {
  data: MatchResultData;
  locale?: MatchResultGraphicLocale;
  className?: string;
  priority?: boolean;
};

export default function MatchResultGraphic({
  data,
  locale = 'sq',
  className,
  priority,
}: Props) {
  const g = getMatchResultGraphicLang(locale);
  const teamsL = getTeamsLang(locale);
  const side = data.isHome ? teamsL.home : teamsL.away;
  const venue = data.location?.trim();
  const locationDisplay =
    data.locationDisplay ??
    [side, venue].filter((p) => Boolean(p && String(p).trim())).join(' · ');

  const options = getMatchResultImageOptions({
    ...data,
    locationDisplay,
  });

  return (
    <CldImage
      priority={priority}
      src={options.src}
      width={MATCH_RESULT_GRAPHIC_WIDTH}
      height={MATCH_RESULT_GRAPHIC_HEIGHT}
      overlays={options.overlays}
      alt={g.imageAlt(data.opponent)}
      className={cn('h-auto w-full max-w-full rounded-md border border-border', className)}
    />
  );
}
