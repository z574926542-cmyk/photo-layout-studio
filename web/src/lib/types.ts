// ============================================================
// 奇妙奇遇光影集 排版 Studio — 核心类型定义
// ============================================================

/** 图框（Slot）：以百分比存储坐标和尺寸 */
export interface Slot {
  id: string;
  /** X 坐标（百分比 0-100） */
  x: number;
  /** Y 坐标（百分比 0-100） */
  y: number;
  /** 宽度（百分比 0-100） */
  w: number;
  /** 高度（百分比 0-100） */
  h: number;
  /** 已填入的素材 ID，null 表示空置 */
  assetId: string | null;
  /** 图片在框内的偏移（百分比，用于平移） */
  offsetX: number;
  offsetY: number;
  /** 图片缩放比例（相对于 aspect-fill 基准） */
  scale: number;
  /** 图片旋转角度（度，顺时针，0-360） */
  rotation: number;
  /** 标签 */
  label?: string;
}

/** 裁剪框坐标（像素，相对于原始图片） */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 素材（Asset）：上传的照片 */
export interface Asset {
  id: string;
  /** 文件名 */
  name: string;
  /** 原始图片 Base64（始终保留，用于重新裁剪） */
  dataUrl: string;
  /** 裁剪后的图片 Base64（有裁剪时使用，否则为 null） */
  croppedDataUrl: string | null;
  /** 上次裁剪框坐标（像素，相对于原始图片），null 表示未裁剪 */
  cropRect: CropRect | null;
  /** 原始宽度（px） */
  naturalWidth: number;
  /** 原始高度（px） */
  naturalHeight: number;
  /** 宽高比 */
  aspectRatio: number;
}

/** 画布配置 */
export interface CanvasConfig {
  /** 画布宽度（px） */
  width: number;
  /** 画布高度（px） */
  height: number;
  /** 底图 Base64（底图模式下使用） */
  backgroundImage: string | null;
  /** 背景颜色（规格模式下使用） */
  backgroundColor: string;
}

/** 排版方案 */
export interface LayoutScheme {
  id: string;
  name: string;
  canvas: CanvasConfig;
  slots: Slot[];
  createdAt: number;
  updatedAt: number;
}

/** 编辑器模式 */
export type EditorMode = 'select' | 'draw';

/** 工具栏操作 */
export type ToolbarAction = 'undo' | 'redo' | 'delete' | 'clear' | 'export' | 'auto-fill';

/** 拖拽/绘制状态 */
export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  type: 'draw' | 'move' | 'resize' | null;
  resizeHandle?: ResizeHandle;
  slotId?: string;
  initialSlot?: Slot;
}

/** 缩放手柄方向 */
export type ResizeHandle =
  | 'nw' | 'n' | 'ne'
  | 'w'  |       'e'
  | 'sw' | 's' | 'se';

/**
 * 可分享的排版模板文件格式
 * 包含：画布尺寸、底图 Base64、所有图框位置/尺寸
 * 保存为 .json 文件分享，导入后可直接使用
 */
export interface LayoutTemplate {
  /** 模板文件标识，用于校验格式 */
  _type: 'photo-layout-template';
  /** 版本号 */
  version: 1;
  /** 模板名称 */
  name: string;
  /** 店家/作者名（可选） */
  author?: string;
  /** 模板描述（可选） */
  description?: string;
  /** 创建时间 */
  createdAt: number;
  /** 画布配置 */
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    /** 底图 Base64（底图模式下有值） */
    backgroundImage?: string;
  };
  /** 图框列表（仅保存布局信息，不保存已填充的照片） */
  slots: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    label?: string;
  }>;
}

/**
 * 持久化模板库条目（存入 LocalStorage）
 * 包含完整的 LayoutTemplate 数据 + 本地管理元数据
 */
export interface SavedTemplate {
  /** 本地唯一 ID（与 LayoutTemplate.createdAt 无关，避免冲突） */
  localId: string;
  /** 导入时间（毫秒时间戳） */
  importedAt: number;
  /** 完整模板数据 */
  template: LayoutTemplate;
  /** 缩略图（Canvas 离线渲染的 Base64，可选，用于预览） */
  thumbnail?: string;
}

/** 预设模板 */
export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  canvas: Pick<CanvasConfig, 'width' | 'height'>;
  slots: Omit<Slot, 'id' | 'assetId' | 'offsetX' | 'offsetY' | 'scale' | 'rotation'>[];
}
