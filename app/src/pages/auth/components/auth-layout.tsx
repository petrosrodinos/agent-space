import type { FC, ReactNode } from "react";
import { Bot, Briefcase, Megaphone, Search } from "lucide-react";

const STICKERS = [
  { icon: Briefcase, color: "#FF7A3D", name: "Sales Sam", text: "Prepped your 2pm call with Acme", rotate: -5, x: "4%", y: "12%" },
  { icon: Megaphone, color: "#FF5FAE", name: "Mia", text: "3 launch posts drafted — want to review?", rotate: 4, x: "38%", y: "34%" },
  { icon: Search, color: "#38B6FF", name: "Researcher", text: "Compared 12 CRMs. Here's the table", rotate: -3, x: "10%", y: "58%" },
];

/** Split auth screen: playful bot "stickers" on the left (desktop), the form on the right. */
export const AuthLayout: FC<{ title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }> = ({ title, subtitle, children, footer }) => (
  <div className="flex min-h-dvh w-full bg-canvas">
    <div className="relative hidden w-[46%] overflow-hidden bg-primary lg:block">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
      <div className="relative z-10 p-12">
        <div className="flex items-center gap-2.5 text-white">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/15"><Bot className="h-6 w-6" /></span>
          <span className="text-lg font-extrabold">Agent Space</span>
        </div>
        <h2 className="mt-16 max-w-md font-display text-[44px] font-bold leading-[1.05] text-white">Your team's AI co-workers, right inside your chats.</h2>
        <p className="mt-4 max-w-md text-[16px] text-white/80">Bots that send the email, update the CRM and build the report — and always ask before anything important.</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[48%]">
        {STICKERS.map((s) => (
          <div key={s.name} className="absolute w-[300px] animate-pop-in rounded-[20px] bg-white p-3.5 shadow-pop" style={{ left: s.x, top: s.y, transform: `rotate(${s.rotate}deg)` }}>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-white" style={{ backgroundColor: s.color }}>
                <s.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-extrabold text-[#1C1633]">{s.name}</span>
            </div>
            <p className="mt-2 text-[14px] font-medium text-[#3A3352]">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground"><Bot className="h-6 w-6" /></span>
          <span className="text-lg font-extrabold text-ink">Agent Space</span>
        </div>
        <h1 className="font-display text-[32px] font-bold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  </div>
);
