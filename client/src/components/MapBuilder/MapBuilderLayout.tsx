import type { ReactNode } from "react";

interface MapBuilderLayoutProps {
  header: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  shelf: ReactNode;
}

export function MapBuilderLayout({ header, canvas, inspector, shelf }: MapBuilderLayoutProps) {
  return (
    <div className="flex min-h-[72vh] flex-col gap-4 lg:gap-5">
      <div>{header}</div>

      <div className="grid gap-4 lg:gap-5">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.62),rgba(2,6,23,0.82))] shadow-[0_26px_70px_rgba(2,6,23,0.34)]">
          <div className="min-h-[52vh] lg:min-h-[60vh]">{canvas}</div>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-white/10 lg:block" aria-hidden="true" />
          <div className="absolute right-4 top-4 hidden w-full max-w-[320px] lg:block">{inspector}</div>
        </section>

        <div className="lg:hidden">{inspector}</div>

        <div className="sticky bottom-0 z-10">{shelf}</div>
      </div>
    </div>
  );
}