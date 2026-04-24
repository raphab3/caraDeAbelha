import type { ReactNode } from "react";

import styles from "./MapBuilderLayout.module.css";

interface MapBuilderLayoutProps {
  header: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  isUiHidden: boolean;
  restoreControl: ReactNode;
  shelf: ReactNode;
  toolbar: ReactNode;
}

export function MapBuilderLayout({ header, canvas, inspector, isUiHidden, restoreControl, shelf, toolbar }: MapBuilderLayoutProps) {
  return (
    <div className={styles.root}>
      <section className={styles.workbench}>
        <div className={styles.canvas}>{canvas}</div>

        {isUiHidden ? (
          <div className={[styles.slot, styles.restoreSlot].join(" ")}>
            <div>{restoreControl}</div>
          </div>
        ) : (
          <>
            <div className={[styles.slot, styles.headerSlot].join(" ")}>
              <div>{header}</div>
            </div>

            <div className={[styles.slot, styles.shelfDesktop].join(" ")}>
              <div>{shelf}</div>
            </div>

            <div className={[styles.slot, styles.toolbarSlot].join(" ")}>
              <div>{toolbar}</div>
            </div>

            <div className={[styles.slot, styles.inspectorDesktop].join(" ")}>
              <div>{inspector}</div>
            </div>

            <div className={[styles.slot, styles.inspectorMobile].join(" ")}>
              <div>{inspector}</div>
            </div>

            <div className={[styles.slot, styles.shelfMobile].join(" ")}>
              <div>{shelf}</div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
