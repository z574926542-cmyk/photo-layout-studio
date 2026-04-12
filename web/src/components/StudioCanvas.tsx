      {/* 图片填充：直接相对 slot div 定位，不再有中间层 */}
      {asset && (
        <>
          <AspectFillImage asset={asset} slot={slot} canvasW={canvasW} canvasH={canvasH} isEditMode={isImageEditMode} />
          {/* 图片调节模式标识角标 */}
          {isImageEditMode && (
            <div
              className="absolute top-1 left-1 z-40 pointer-events-none"
              style={{
                background: "oklch(0.65 0.20 145 / 0.9)",
                borderRadius: 3,
                padding: "1px 5px",
                fontSize: 9,
                color: "white",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              图片
            </div>
          )}
          {/* 删除当前图片按鈕：悬停时显示，图片调节模式下隐藏 */}
          {!isImageEditMode && (
            <button
              className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40"
              style={{ background: "oklch(0.62 0.22 25 / 0.92)", border: "1px solid oklch(1 0 0 / 0.2)" }}
              title="清空图片"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUnfill(); }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </>
      )}