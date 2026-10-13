import {
  ArrowUpDown,
  Baby,
  Car,
  Cctv,
  Check,
  Dumbbell,
  FireExtinguisher,
  Flame,
  Flower2,
  MoonStar,
  PhoneCall,
  Plug,
  ShieldCheck,
  Sun,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";

const ICONS = {
  lift: ArrowUpDown,
  generator: Zap,
  substation: Plug,
  car_parking: Car,
  rooftop_garden: Flower2,
  community_hall: Users,
  gym: Dumbbell,
  swimming_pool: Waves,
  prayer_room: MoonStar,
  kids_play_area: Baby,
  cctv: Cctv,
  security: ShieldCheck,
  fire_safety: FireExtinguisher,
  intercom: PhoneCall,
  solar: Sun,
  gas_connection: Flame,
};

/** Hairline grid of amenities (icon + label). Unknown codes are skipped, not shown raw. */
export function Amenities({ codes }) {
  const t = useTranslations("projects.amenities");
  const known = codes.filter((c) => c in ICONS);
  return (
    <ul className="grid grid-cols-2 border-t border-l border-line sm:grid-cols-3 lg:grid-cols-4">
      {known.map((c) => {
        const Icon = ICONS[c] ?? Check;
        return (
          <li key={c} className="flex items-center gap-3 border-r border-b border-line px-4 py-5">
            <Icon aria-hidden className="size-5 shrink-0 text-accent" strokeWidth={1.25} />
            <span className="text-sm">{t(c)}</span>
          </li>
        );
      })}
    </ul>
  );
}
