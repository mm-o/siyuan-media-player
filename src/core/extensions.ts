/**
 * 媒体播放器扩展系统
 * 简化版本，直接检查window对象上的API配置
 */

// B站扩展支持
export const bilibili = {
    isAvailable: () => !!window.siyuanBilibiliAPI?.loaded,
    getAPIs: () => window.siyuanBilibiliAPI || null
};

// 通用扩展接口
export const extensions = {
    bilibili: {
        isAvailable: () => !!window.siyuanBilibiliAPI?.loaded,
        getAPIs: () => window.siyuanBilibiliAPI || null
    }
};

// 全局类型声明
declare global {
    interface Window {
        siyuanBilibiliAPI?: {
            // 认证相关
            QR_LOGIN: string;
            QR_POLL: string;
            USER_INFO: string;

            // 视频相关
            VIDEO_INFO: string;
            VIDEO_PAGES: string;
            VIDEO_STREAM: string;
            VIDEO_SUBTITLE: string;
            VIDEO_AI_SUMMARY: string;

            // 收藏相关
            FAVORITE_LIST: string;
            FAVORITE_IDS: string;
            FAVORITE_FOLDER_LIST: string;

            // 合集相关
            SEASONS_ARCHIVES_LIST: string;

            // 扩展信息
            loaded: boolean;
            version: string;
        };
    }
}
