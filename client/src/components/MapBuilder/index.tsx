import { useMemo } from "react";

import { MAP_BUILDER_CATALOG, getMapBuilderCatalogItem } from "./catalog";
import { AssetShelf } from "./AssetShelf";
import { BuilderCanvas } from "./BuilderCanvas";
import { buildStageExport, buildStageExportFileName, downloadStageExport } from "./exportStage";
import { HeaderControls } from "./HeaderControls";
import { MapBuilderLayout } from "./MapBuilderLayout";
import { SelectionInspector } from "./SelectionInspector";
import { useMapBuilderStore } from "./useMapBuilderStore";
import { useFullscreenTarget } from "../../hooks/useFullscreenTarget";

export default function MapBuilder() {
  const { isFullscreen, isSupported: isFullscreenSupported, targetRef, toggleFullscreen } = useFullscreenTarget<HTMLDivElement>();
  const mapInfo = useMapBuilderStore((state) => state.mapInfo);
  const proceduralBase = useMapBuilderStore((state) => state.proceduralBase);
  const placedItems = useMapBuilderStore((state) => state.placedItems);
  const placedItemsCount = useMapBuilderStore((state) => state.placedItems.length);
  const editorState = useMapBuilderStore((state) => state.editorState);
  const setMapName = useMapBuilderStore((state) => state.setMapName);
  const setMapSize = useMapBuilderStore((state) => state.setMapSize);
  const setDefaultY = useMapBuilderStore((state) => state.setDefaultY);
  const setProceduralSeed = useMapBuilderStore((state) => state.setProceduralSeed);
  const setSelectedAssetType = useMapBuilderStore((state) => state.setSelectedAssetType);
  const setCurrentTool = useMapBuilderStore((state) => state.setCurrentTool);
  const removeItem = useMapBuilderStore((state) => state.removeItem);
  const updateItem = useMapBuilderStore((state) => state.updateItem);
  const generateProceduralBase = useMapBuilderStore((state) => state.generateProceduralBase);

  const selectedItem = useMemo(
    () => placedItems.find((item) => item.id === editorState.selectedItemId) ?? null,
    [editorState.selectedItemId, placedItems],
  );

  const selectedAssetLabel = useMemo(() => {
    if (!editorState.selectedAssetType) {
      return null;
    }

    return getMapBuilderCatalogItem(editorState.selectedAssetType)?.label ?? null;
  }, [editorState.selectedAssetType]);

  const handleExportStage = () => {
    const payload = buildStageExport({
      mapInfo,
      proceduralBase,
      placedItems,
    });

    downloadStageExport(payload, buildStageExportFileName(mapInfo));
  };

  const handleRotateQuarterTurn = (deltaDegrees: number) => {
    if (!selectedItem) {
      return;
    }

    const nextRotation = ((selectedItem.rotationY + deltaDegrees) % 360 + 360) % 360;
    updateItem(selectedItem.id, { rotationY: nextRotation });
  };

  const handleScaleChange = (scale: number) => {
    if (!selectedItem) {
      return;
    }

    updateItem(selectedItem.id, { scale });
  };

  const handleTagChange = (tag: string) => {
    if (!selectedItem) {
      return;
    }

    updateItem(selectedItem.id, { tag });
  };

  const handleZoneIdChange = (zoneId: string) => {
    if (!selectedItem) {
      return;
    }

    updateItem(selectedItem.id, { zoneId });
  };

  const handleDeleteSelectedItem = () => {
    if (!selectedItem) {
      return;
    }

    removeItem(selectedItem.id);
  };

  return (
    <div ref={targetRef} className="min-h-0 min-w-0 h-full">
      <MapBuilderLayout
        header={
          <HeaderControls
            currentTool={editorState.currentTool}
            defaultY={mapInfo.defaultY}
            isFullscreen={isFullscreen}
            isFullscreenSupported={isFullscreenSupported}
            mapName={mapInfo.name}
            mapSize={mapInfo.size}
            onDefaultYChange={setDefaultY}
            onExportStage={handleExportStage}
            onGenerateBase={() => generateProceduralBase(proceduralBase.seed)}
            onMapNameChange={setMapName}
            onMapSizeChange={setMapSize}
            onProceduralSeedChange={setProceduralSeed}
            onToggleFullscreen={() => {
              void toggleFullscreen();
            }}
            onToolChange={setCurrentTool}
            proceduralSeed={proceduralBase.seed}
          />
        }
        canvas={<BuilderCanvas />}
        inspector={
          <SelectionInspector
            currentTool={editorState.currentTool}
            defaultY={mapInfo.defaultY}
            hoveredCell={editorState.hoveredCell}
            mapName={mapInfo.name}
            onDeleteSelectedItem={handleDeleteSelectedItem}
            onRotateQuarterTurn={handleRotateQuarterTurn}
            onScaleChange={handleScaleChange}
            onTagChange={handleTagChange}
            onZoneIdChange={handleZoneIdChange}
            placedItemsCount={placedItemsCount}
            selectedAssetLabel={selectedAssetLabel}
            selectedItem={selectedItem}
            selectedItemId={editorState.selectedItemId}
            stats={proceduralBase.stats}
          />
        }
        shelf={
          <AssetShelf
            items={MAP_BUILDER_CATALOG}
            onSelect={setSelectedAssetType}
            selectedPrefabId={editorState.selectedAssetType}
          />
        }
      />
    </div>
  );
}