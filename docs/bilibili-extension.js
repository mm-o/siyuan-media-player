// 思源媒体播放器 - B站API扩展
// 为思源媒体播放器插件提供B站相关API端点配置
// 作者：mm-o
// 版本：2.0.0

(function() {
    'use strict';

    // 防止重复加载
    if (window.siyuanBilibiliAPI) return;

    // B站API配置
    window.siyuanBilibiliAPI = {
        // 认证相关
        QR_LOGIN: "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
        QR_POLL: "https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
        USER_INFO: "https://api.bilibili.com/x/web-interface/nav",

        // 视频相关
        VIDEO_INFO: "https://api.bilibili.com/x/web-interface/view",
        VIDEO_PAGES: "https://api.bilibili.com/x/player/pagelist",
        VIDEO_STREAM: "https://api.bilibili.com/x/player/wbi/playurl",
        VIDEO_SUBTITLE: "https://api.bilibili.com/x/player/wbi/v2",
        VIDEO_AI_SUMMARY: "https://api.bilibili.com/x/web-interface/view/conclusion/get",

        // 收藏相关
        FAVORITE_LIST: "https://api.bilibili.com/x/v3/fav/resource/list",
        FAVORITE_IDS: "https://api.bilibili.com/x/v3/fav/resource/ids",
        FAVORITE_FOLDER_LIST: "https://api.bilibili.com/x/v3/fav/folder/created/list-all",

        // 合集相关
        SEASONS_ARCHIVES_LIST: "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list",

        loaded: true,
        version: "2.0.0"
    };

})();
