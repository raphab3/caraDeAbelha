import type { MapBuilderCatalogItem } from "./types";

export const MAP_BUILDER_CATALOG: readonly MapBuilderCatalogItem[] = [
  {
    prefabId: "terrain/cliff-high",
    label: "Falesia Alta",
    assetPath: "kenney_platformer-kit/Models/GLB format/block-grass-large-tall.glb",
    category: "terrain",
    colliderType: "solid",
    defaultScale: 1,
    defaultTag: "terrain",
  },
  {
    prefabId: "terrain/slope-wide",
    label: "Rampa Larga",
    assetPath: "kenney_platformer-kit/Models/GLB format/block-grass-large-slope.glb",
    category: "terrain",
    colliderType: "solid",
    defaultScale: 1,
    defaultTag: "terrain",
  },
  {
    prefabId: "terrain/overhang-edge",
    label: "Beiral de Penhasco",
    assetPath: "kenney_platformer-kit/Models/GLB format/block-grass-overhang-edge.glb",
    category: "terrain",
    colliderType: "solid",
    defaultScale: 1,
    defaultTag: "terrain",
  },
  {
    prefabId: "nature/pine-large",
    label: "Pinheiro Alto",
    assetPath: "kenney_platformer-kit/Models/GLB format/tree-pine.glb",
    category: "nature",
    colliderType: "soft",
    defaultScale: 1,
  },
  {
    prefabId: "nature/flowers-cluster",
    label: "Flores Silvestres",
    assetPath: "kenney_platformer-kit/Models/GLB format/flowers.glb",
    category: "nature",
    colliderType: "none",
    defaultScale: 1,
  },
  {
    prefabId: "nature/rocks-cluster",
    label: "Rochas Agrupadas",
    assetPath: "kenney_platformer-kit/Models/GLB format/rocks.glb",
    category: "nature",
    colliderType: "solid",
    defaultScale: 1,
  },
  {
    prefabId: "setdressing/fence-broken",
    label: "Cerca Quebrada",
    assetPath: "kenney_platformer-kit/Models/GLB format/fence-broken.glb",
    category: "setdressing",
    colliderType: "soft",
    defaultScale: 1,
  },
  {
    prefabId: "setdressing/signpost",
    label: "Placa",
    assetPath: "kenney_platformer-kit/Models/GLB format/sign.glb",
    category: "setdressing",
    colliderType: "soft",
    defaultScale: 1,
  },
  {
    prefabId: "setdressing/platform",
    label: "Plataforma",
    assetPath: "kenney_platformer-kit/Models/GLB format/platform.glb",
    category: "setdressing",
    colliderType: "solid",
    defaultScale: 1,
  },
  {
    prefabId: "setdressing/platform-ramp",
    label: "Rampa de Plataforma",
    assetPath: "kenney_platformer-kit/Models/GLB format/platform-ramp.glb",
    category: "setdressing",
    colliderType: "solid",
    defaultScale: 1,
  },
  {
    prefabId: "setdressing/platform-overhang",
    label: "Plataforma Suspensa",
    assetPath: "kenney_platformer-kit/Models/GLB format/platform-overhang.glb",
    category: "setdressing",
    colliderType: "solid",
    defaultScale: 1,
  },
  {
    prefabId: "setdressing/fence-straight",
    label: "Cerca Reta",
    assetPath: "kenney_platformer-kit/Models/GLB format/fence-straight.glb",
    category: "setdressing",
    colliderType: "soft",
    defaultScale: 1,
  },
  {
    prefabId: "landmark/flag-beacon",
    label: "Marco com Bandeira",
    assetPath: "kenney_platformer-kit/Models/GLB format/flag.glb",
    category: "landmark",
    colliderType: "soft",
    defaultScale: 1.25,
    defaultTag: "navigation",
  },
  {
    prefabId: "border/wind-gate",
    label: "Portao de Vento",
    assetPath: "kenney_platformer-kit/Models/GLB format/arrows.glb",
    category: "border",
    colliderType: "trigger",
    defaultScale: 1.4,
    defaultTag: "border",
  },
] as const;

export const MAP_BUILDER_CATALOG_BY_ID = new Map(
  MAP_BUILDER_CATALOG.map((item) => [item.prefabId, item] as const),
);

export function getMapBuilderCatalogItem(prefabId: string): MapBuilderCatalogItem | undefined {
  return MAP_BUILDER_CATALOG_BY_ID.get(prefabId);
}