// name: 思源媒体播放器 - B站扩展
// version: 1.0.0
// description: 为思源媒体播放器提供B站视频播放支持
// author: mm-o

(function() {
    'use strict';

    // 检查是否已经注册过
    if (window.siyuanMediaPlayerExtensions?.get?.('bilibili')) return;

    // B站扩展配置
    const bilibiliExtension = {
        name: 'bilibili',
        version: '1.2.0',
        description: 'B站视频播放支持',
        enabled: true,
        apis: {
            QR_LOGIN: "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
            QR_POLL: "https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
            USER_INFO: "https://api.bilibili.com/x/web-interface/nav",
            VIDEO_INFO: "https://api.bilibili.com/x/web-interface/view",
            VIDEO_PAGES: "https://api.bilibili.com/x/player/pagelist",
            VIDEO_STREAM: "https://api.bilibili.com/x/player/wbi/playurl",
            VIDEO_SUBTITLE: "https://api.bilibili.com/x/player/wbi/v2",
            VIDEO_AI_SUMMARY: "https://api.bilibili.com/x/web-interface/view/conclusion/get",
            FAVORITE_LIST: "https://api.bilibili.com/x/v3/fav/resource/list",
            FAVORITE_IDS: "https://api.bilibili.com/x/v3/fav/resource/ids",
            FAVORITE_FOLDER_LIST: "https://api.bilibili.com/x/v3/fav/folder/created/list-all",
            SEASONS_ARCHIVES_LIST: "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list"
        }
    };
    
    // 注册扩展
    const registerExtension = () => {
        if (window.siyuanMediaPlayerExtensions) {
            window.siyuanMediaPlayerExtensions.register('bilibili', bilibiliExtension);
        } else {
            setTimeout(registerExtension, 100);
        }
    };

    // 立即尝试注册
    registerExtension();
    
})();

// 扩展管理工具
window.bilibiliExtensionUtils = {
    enable: () => window.siyuanMediaPlayerExtensions?.setEnabled('bilibili', true),
    disable: () => window.siyuanMediaPlayerExtensions?.setEnabled('bilibili', false),
    status: () => window.siyuanMediaPlayerExtensions?.isEnabled('bilibili'),
    info: () => window.siyuanMediaPlayerExtensions?.get('bilibili')
};
