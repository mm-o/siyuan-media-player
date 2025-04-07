/**
 * 媒体项接口定义
 */
export interface MediaItem {
    id: string;           // 唯一标识符
    title: string;        // 媒体标题
    artist?: string;      // 作者/UP主名称
    artistIcon?: string;  // 作者/UP主头像
    duration?: string;   // 媒体时长，格式化后的时间字符串
    thumbnail?: string;   // 媒体缩略图
    url: string;         // 媒体URL
    originalUrl?: string;  // 原始链接
    type: 'video' | 'audio' | 'bilibili';
    isPinned?: boolean;   // 是否置顶
    isFavorite?: boolean; // 是否收藏
    
    // B站视频特有属性
    aid?: string;        // B站av号
    bvid?: string;       // B站bv号
    cid?: string;        // B站视频cid
    headers?: Record<string, string>;
    
    // 播放控制属性
    startTime?: number;
    endTime?: number;
    isLoop?: boolean;
    loopCount?: number;
}

/**
 * 媒体信息接口
 */
export interface MediaInfo {
    title: string;        // 媒体标题
    artist?: string;      // 作者名称
    artistIcon?: string;  // 作者头像
    duration: string;     // 时长
    thumbnail: string;    // 缩略图
    url?: string;        // 媒体URL
    aid?: string;        // B站av号
    bvid?: string;       // B站bv号
    cid?: string;        // B站视频cid
}

/**
 * 配置文件类型定义
 */
export interface Config {
    /** 插件设置 */
    settings: {
        /** 音量大小 (0-100) */
        volume: number;
        /** 播放速度 (0.5-2.0) */
        speed: number;
        /** 是否开启热键 */
        hotkey: boolean;
        /** 是否循环播放 */
        loop: boolean;
        /** 是否插入到光标处 */
        insertAtCursor: boolean;
    };
    /** B站登录信息 */
    bilibiliLogin?: {
        /** 登录URL，包含登录凭证 */
        url?: string;
        /** 刷新令牌 */
        refresh_token?: string;
        /** 登录时间戳 */
        timestamp?: number;
        /** 用户信息 */
        userInfo?: {
            /** 用户头像URL */
            face: string;
            /** 等级信息 */
            level_info: {
                /** 当前等级 */
                current_level: number;
                /** 当前等级最小经验值 */
                current_min: number;
                /** 当前经验值 */
                current_exp: number;
                /** 下一等级所需经验值 */
                next_exp: string | number;
            };
            /** 用户ID */
            mid: number;
            /** 用户名 */
            uname: string;
            /** WBI签名图片信息 */
            wbi_img?: {
                /** 主图片URL */
                img_url: string;
                /** 子图片URL */
                sub_url: string;
            };
        };
    };
    /** 播放列表 */
    playlists: {
        id: string;          // 列表ID
        name: string;        // 列表名称
        isFixed?: boolean;   // 是否为固定列表
        items: MediaItem[];  // 媒体项列表
    }[];
}

/**
 * 播放列表配置
 */
export interface PlaylistConfig {
    id: string;          // 列表ID
    name: string;        // 列表名称
    isFixed?: boolean;   // 是否为固定列表
    items: MediaItem[];  // 媒体项列表
    isEditing?: boolean; // 是否处于编辑状态
}

export interface PlayOptions {
    startTime?: number;
    endTime?: number;
    isLoop?: boolean;
    loopCount?: number;
    originalUrl?: string;
    
    // B站视频特有选项
    type?: 'bilibili' | 'bilibili-dash';
    bvid?: string;
    headers?: Record<string, string>;
    title?: string;
}

export interface VideoStream {
    video: {
        url: string
        size?: number
        // 保留视频其他属性
    }
    headers?: Record<string, string>
    mpdUrl?: string
}

export interface ISettingItem {
    key: string;
    value: number | boolean;
    type: 'slider' | 'checkbox';
    title: string;
    description?: string;
    slider?: {
        min: number;
        max: number;
        step: number;
    };
} 