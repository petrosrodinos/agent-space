import { useEffect, useRef, useState, type DragEvent, type FC } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { randomAvatarSeed, randomAvatarSeeds } from "@/components/ui/bot-portrait";
import { BotColorOptions } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { generateAvatarImage, uploadFile } from "@/features/files/services/files.services";
import { avatarFileId, avatarSeedForFile } from "@/lib/avatar-seed";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AvatarCropper } from "./avatar-cropper";

const AvatarTabs = { BOT: "bot", GENERATE: "generate", UPLOAD: "upload" } as const;
type AvatarTab = (typeof AvatarTabs)[keyof typeof AvatarTabs];

const PRESET_COUNT = 15;
const MAX_UPLOAD_BYTES = 8 * 1024 ** 2;
const IMAGE_TYPE = /^image\//;
const MIN_PROMPT_LENGTH = 3;

const tabTrigger = "rounded-full px-3 py-1 text-sm font-semibold text-muted-foreground data-[state=active]:bg-surface-sunken data-[state=active]:text-ink data-[state=active]:shadow-none";

export interface AvatarPickerProps {
  /** `avatar_seed`: a hash for the generated portrait, or `file:<id>` for an image. */
  seed: string;
  color: string;
  onSeedChange: (seed: string) => void;
  onColorChange?: (color: string) => void;
  disabled?: boolean;
  /** Size of the avatar that opens the picker. */
  size?: 56 | 88 | 120;
  name?: string;
  /** Pulse while the bot works. */
  working?: boolean;
  /** The portrait leans toward the mouse pointer. */
  followCursor?: boolean;
  className?: string;
}

/**
 * The one control for choosing a bot or group avatar and colour. Three sources: generated portraits (the hash
 * seeds), an AI-generated image from a prompt, or an uploaded image. Used wherever a bot or group is created or edited.
 */
export const AvatarPicker: FC<AvatarPickerProps> = ({ seed, color, onSeedChange, onColorChange, disabled, size = 56, name, working, followCursor, className }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AvatarTab>(AvatarTabs.BOT);
  const finish = (s: string) => {
    onSeedChange(s);
    setOpen(false);
  };
  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) setTab(AvatarTabs.BOT);
  };
  const trigger = (
    <button type="button" className={cn("shrink-0 rounded-lg shadow-sticker transition-transform hover:scale-105 disabled:opacity-60", className)} aria-label="Choose avatar and colour">
      <BotAvatar seed={seed} color={color} size={size} name={name} working={working} followCursor={followCursor} />
    </button>
  );
  const body = (
    <PickerBody seed={seed} color={color} tab={tab} onTabChange={setTab} onSeedChange={onSeedChange} onColorChange={onColorChange} onFinish={finish} />
  );

  // Phones get a centred modal; a popover would be cramped and clipped by the screen edge.
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} closeOnOutsideClick>
        <DialogTrigger asChild disabled={disabled}>
          {trigger}
        </DialogTrigger>
        <DialogContent className="w-[calc(100vw-24px)] max-w-[360px] gap-3 p-4">
          <DialogHeader>
            <DialogTitle className="text-lg">Choose avatar</DialogTitle>
            <DialogDescription className="sr-only">Pick a portrait and colour, generate an image, or upload your own.</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] rounded-xl p-3">
        {body}
      </PopoverContent>
    </Popover>
  );
};

interface PickerBodyProps extends Pick<AvatarPickerProps, "seed" | "color" | "onSeedChange" | "onColorChange"> {
  tab: AvatarTab;
  onTabChange: (tab: AvatarTab) => void;
  onFinish: (seed: string) => void;
}

/** The tabs shared by the popover and the mobile modal. */
const PickerBody: FC<PickerBodyProps> = ({ seed, color, tab, onTabChange, onSeedChange, onColorChange, onFinish }) => (
  <Tabs value={tab} onValueChange={(v) => onTabChange(v as AvatarTab)}>
    <div className="flex items-center justify-between">
      <TabsList className="h-auto gap-0.5 bg-transparent p-0">
        <TabsTrigger value={AvatarTabs.BOT} className={tabTrigger}>Bot</TabsTrigger>
        <TabsTrigger value={AvatarTabs.GENERATE} className={tabTrigger}>Generate</TabsTrigger>
        <TabsTrigger value={AvatarTabs.UPLOAD} className={tabTrigger}>Upload</TabsTrigger>
      </TabsList>
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onSeedChange(randomAvatarSeed())}>
        Reset
      </Button>
    </div>
    <TabsContent value={AvatarTabs.BOT} className="mt-3">
      <BotTab seed={seed} color={color} onSeedChange={onSeedChange} onColorChange={onColorChange} />
    </TabsContent>
    <TabsContent value={AvatarTabs.GENERATE} className="mt-3">
      <GenerateTab onDone={onFinish} />
    </TabsContent>
    <TabsContent value={AvatarTabs.UPLOAD} className="mt-3">
      <UploadTab active={tab === AvatarTabs.UPLOAD} onDone={onFinish} />
    </TabsContent>
  </Tabs>
);

/** Generated portraits (the hash seeds) plus the colour swatches. */
const BotTab: FC<Pick<AvatarPickerProps, "seed" | "color" | "onSeedChange" | "onColorChange">> = ({ seed, color, onSeedChange, onColorChange }) => {
  const [options] = useState(() => (avatarFileId(seed) ? randomAvatarSeeds(PRESET_COUNT) : [seed, ...randomAvatarSeeds(PRESET_COUNT - 1)]));
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-5 gap-2">
        {options.map((s, i) => {
          const selected = s === seed;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Avatar ${i + 1}`}
              onClick={() => onSeedChange(s)}
              className={cn("mx-auto rounded-lg transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", selected && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
            >
              <BotAvatar seed={s} color={color} size={40} />
            </button>
          );
        })}
      </div>
      {onColorChange && (
        <div role="radiogroup" aria-label="Colour" className="grid grid-cols-6 gap-x-2 gap-y-3">
          {BotColorOptions.map((c) => {
            const active = color?.toLowerCase() === c.id.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={c.label}
                title={c.label}
                onClick={() => onColorChange(c.id)}
                className={cn("mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110", active && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                style={{ backgroundColor: c.id }}
              >
                {active && <Check className="h-4 w-4 text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Stores a framed image and returns the seed that references it. */
const storeAvatar = async (file: File) => avatarSeedForFile((await uploadFile(file, "bot_image")).id);

/** The crop step shared by Generate and Upload: reposition, then store and report the new seed. */
const FramedImage: FC<{ src: string; onRestart: () => void; onDone: (seed: string) => void }> = ({ src, onRestart, onDone }) => {
  const [saving, setSaving] = useState(false);
  return (
    <AvatarCropper
      key={src}
      src={src}
      busy={saving}
      onRestart={onRestart}
      onConfirm={async (file) => {
        setSaving(true);
        try {
          onDone(await storeAvatar(file));
        } catch (e) {
          toast({ title: "Could not save the avatar", description: (e as Error).message, variant: "error" });
          setSaving(false);
        }
      }}
    />
  );
};

const GenerateTab: FC<{ onDone: (seed: string) => void }> = ({ onDone }) => {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const ready = prompt.trim().length >= MIN_PROMPT_LENGTH;

  const generate = async () => {
    if (!ready || generating) return;
    setGenerating(true);
    try {
      setImage((await generateAvatarImage(prompt.trim())).data_url);
    } catch (e) {
      toast({ title: "Could not generate an avatar", description: (e as Error).message, variant: "error" });
    } finally {
      setGenerating(false);
    }
  };

  if (image) return <FramedImage src={image} onRestart={() => setImage(null)} onDone={onDone} />;

  return (
    <div className="space-y-3">
      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void generate();
          }
        }}
        placeholder="playful, colourful, friendly robot"
        aria-label="Describe the avatar"
        maxLength={300}
        disabled={generating}
      />
      <div className="flex justify-center">
        <div className="flex h-[168px] w-[168px] items-center justify-center rounded-full bg-surface-sunken">
          {generating ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Generating" /> : <Sparkles className="h-6 w-6 text-muted-foreground" aria-hidden />}
        </div>
      </div>
      <Button type="button" className="w-full rounded-full" onClick={generate} loading={generating} disabled={!ready}>
        {generating ? "Generating…" : "Generate"}
      </Button>
    </div>
  );
};

const UploadTab: FC<{ active: boolean; onDone: (seed: string) => void }> = ({ active, onDone }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const pick = (file: File | undefined | null) => {
    if (!file) return;
    if (!IMAGE_TYPE.test(file.type)) return void toast({ title: "Images only", description: "Choose a PNG, JPG, WebP or GIF.", variant: "error" });
    if (file.size > MAX_UPLOAD_BYTES) return void toast({ title: "That image is too large", description: "Use one under 8 MB.", variant: "error" });
    setSrc(URL.createObjectURL(file));
  };

  // Paste an image from the clipboard while this tab is showing.
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => IMAGE_TYPE.test(f.type));
      if (file) pick(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [active]);

  // Release the object URL when it is replaced or the tab unmounts.
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  if (src) return <FramedImage src={src} onRestart={() => setSrc(null)} onDone={onDone} />;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn("flex h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors", over && "border-ink bg-surface-sunken")}
    >
      <p>Drag, drop, or paste an image</p>
      <p className="text-xs">or</p>
      <Button type="button" variant="outline" className="rounded-full" onClick={() => inputRef.current?.click()}>
        Browse files
      </Button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
};
