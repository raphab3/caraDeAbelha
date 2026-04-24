import type { ReactNode } from "react";

interface MapBuilderLayoutProps {
  header: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  shelf: ReactNode;
  toolbar: ReactNode;
}

export function MapBuilderLayout({ header, canvas, inspector, shelf, toolbar }: MapBuilderLayoutProps) {
  return (
    <div className="h-full min-h-[72vh]">
      <section className="relative h-full min-h-[72vh] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.62),rgba(2,6,23,0.82))] shadow-[0_26px_70px_rgba(2,6,23,0.34)] lg:min-h-[calc(100vh-3.5rem)]">
        <div className="h-full min-h-[72vh] lg:min-h-[calc(100vh-3.5rem)]">{canvas}</div>

        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 lg:left-[268px] lg:right-[344px] lg:top-4">
          <div className="pointer-events-auto">{header}</div>
        </div>

        <div className="pointer-events-none absolute left-3 top-[8.5rem] z-20 bottom-16 hidden w-[250px] lg:block">
          <div className="pointer-events-auto">{shelf}</div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 lg:left-[268px] lg:right-[344px]">
          <div className="pointer-events-auto">{toolbar}</div>
        </div>

        <div className="pointer-events-none absolute right-4 top-4 z-20 hidden w-full max-w-[320px] lg:block">
          <div className="pointer-events-auto">{inspector}</div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-[17.5rem] z-20 sm:max-w-[320px] lg:hidden">
          <div className="pointer-events-auto">{inspector}</div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-16 z-20 lg:hidden">
          <div className="pointer-events-auto">{shelf}</div>
        </div>
      </section>
    </div>
  );
}
