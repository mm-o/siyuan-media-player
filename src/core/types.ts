/**
 * 媒体项接口定义
 */
export type MediaType = 'video' | 'audio' | 'bilibili';
export type SettingType = 'slider' | 'checkbox';

// B站相关类型
export interface BilibiliUserInfo {
    face: string;
    level_info: {
        current_level: number;
        current_min: number;
        current_exp: number;
        next_exp: string | number;
    };
    mid: number;
    uname: string;
    wbi_img?: {
        img_url: string;
        sub_url: string;
    };
}

export interface BilibiliLogin {
    url?: string;
    refresh_token?: string;
    timestamp?: number;
    userInfo?: BilibiliUserInfo;
}

// 媒体相关类型
export interface MediaItem {
    id: string;           // 唯一标识符
    title: string;        // 媒体标题
    artist?: string;      // 作者/UP主名称
    artistIcon?: string;  // 作者/UP主头像
    duration?: string;   // 媒体时长，格式化后的时间字符串
    thumbnail?: string;   // 媒体缩略图
    url: string;         // 媒体URL
    originalUrl?: string;  // 原始链接
    type: MediaType;
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
    bilibiliLogin?: BilibiliLogin;
    /** 播放列表 */
    playlists: PlaylistConfig[];
}

/**
 * 播放列表配置
 */
export interface PlaylistConfig {
    id: string;          // 列表ID
    name: string;        // 列表名称
    isFixed?: boolean;   // 是否为固定列表
    items: MediaItem[];  // 媒体项列表
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
    type: SettingType;
    title: string;
    description?: string;
    slider?: {
        min: number;
        max: number;
        step: number;
    };
} 