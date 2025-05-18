<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Artplayer from 'artplayer';
    import * as dashjs from 'dashjs';
    import type { PlayOptions, MediaItem } from '../core/types';
    import { SubtitleManager } from '../core/subtitle';
    import { DanmakuManager } from '../core/danmaku';
    import { createBiliMPD } from '../core/biliUtils';
    
    // 属性和状态
    export let config: any = {};
    export let i18n: any = {};
    export let currentItem: MediaItem = null;
    export let api: any = {};
    
    // 内部状态
    let art: any = null;
    let playerContainer: HTMLDivElement;
    let currentChapter: { start: number; end: number; } | null = null;
    let loopCount = 0;
    let currentSubtitle = '';
    let subtitleVisible = false;
    let subtitleTimer: number;
    
    // 默认配置
    const DEFAULT_CONFIG = { volume: 70, speed: 100, loopCount: 3 };
    
    // 创建播放器实例
    function initPlayer(url = '', options = {}): any {
        cleanup();
        
        const safeConfig = { ...DEFAULT_CONFIG, ...config };
        const playerOptions = {
            container: playerContainer,
            url,
            volume: safeConfig.volume / 100,
            autoplay: true,
            muted: true,
            pip: true,
            autoSize: true,
            setting: true,
            playbackRate: true,
            fullscreen: true,
            fullscreenWeb: true,
            miniProgressBar: true,
            mutex: true,
            playsInline: true,
            loop: !!safeConfig.loopSingle,
            theme: 'var(--b3-theme-primary)',
            lang: window.siyuan?.config?.lang?.toLowerCase() === 'en_us' ? 'en' : 'zh-cn',
            controls: [{
                position: 'right',
                name: 'subtitle',
                index: 10,
                html: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z"/></svg>',
                tooltip: i18n.player?.settings?.subtitleControlTip || '字幕开关',
                click: () => {
                    subtitleVisible = !subtitleVisible;
                    if (config) config.showSubtitles = subtitleVisible;
                    showMessage(subtitleVisible ? 
                        (i18n.player?.subtitle?.enabled || '已启用字幕') : 
                        (i18n.player?.subtitle?.disabled || '已禁用字幕'));
                }
            }],
            ...options
        };
        
        const player = new Artplayer(playerOptions);
        
        // 循环播放处理
        player.on('video:timeupdate', () => {
            if (!currentChapter) return;
            
            if (player.currentTime >= currentChapter.end) {
                const maxLoopCount = safeConfig.loopCount;
                
                if (maxLoopCount > 0 && loopCount >= maxLoopCount) {
                    currentChapter = null;
                    loopCount = 0;
                    player.notice.show = i18n.player?.loop?.endMessage || '循环播放结束';
                    if (safeConfig.pauseAfterLoop) player.pause();
                    return;
                }
                
                player.currentTime = currentChapter.start;
                player.notice.show = (i18n.player?.loop?.currentLoop || '循环播放: ${current}/${total}')
                    .replace('${current}', ++loopCount)
                    .replace('${total}', maxLoopCount);
            }
        });
        
        // 初始化配置
        player.on('ready', () => {
            player.volume = safeConfig.volume / 100;
            player.playbackRate = safeConfig.speed / 100;
            subtitleVisible = safeConfig.showSubtitles !== undefined ? safeConfig.showSubtitles : true;
            startSubtitleTracking(player);
            
            player.play().then(() => {
                player.muted = false;
            }).catch(() => {});
        });
        
        // 播放器错误处理
        player.on('error', (error) => {
            console.error("[Player] 播放错误", error);
            playerContainer?.dispatchEvent(new CustomEvent('mediaError', { detail: { url, error } }));
        });
        
        // 视频结束事件处理
        player.on('video:ended', () => {
            // 如果没有启用单项循环，则触发列表循环逻辑
            if (!safeConfig.loopSingle && safeConfig.loopPlaylist) {
                window.dispatchEvent(new CustomEvent('mediaEnded', { 
                    detail: { loopPlaylist: true }
                }));
            }
        });
        
        return player;
    }
    
    // dash播放处理函数
    function playMpd(video: HTMLVideoElement, url: string, art: any) {
        if (!dashjs.supportsMediaSource()) {
            art.notice.show = '当前环境不支持播放B站视频';
            return;
        }
        
        if (art.dash) art.dash.destroy();
        
        try {
            const dash = dashjs.MediaPlayer().create();
            dash.initialize(video, url, art.option.autoplay);
            art.dash = dash;
            
            art.on('destroy', () => {
                if (art.dash) {
                    art.dash.destroy();
                    art.dash = null;
                }
            });
        } catch (error) {
            console.error("[Player] DASH初始化失败:", error);
            art.notice.show = 'DASH播放器初始化失败';
        }
    }
    
    // 字幕追踪
    function startSubtitleTracking(player: any): void {
        if (subtitleTimer) clearInterval(subtitleTimer);
        
        subtitleTimer = window.setInterval(() => {
            if (!player) return;
            
            const subtitles = SubtitleManager.getSubtitles();
            if (!subtitles.length || !subtitleVisible) {
                currentSubtitle = '';
                return;
            }
            
            const time = player.currentTime;
            currentSubtitle = subtitles.find(
                cue => time >= cue.startTime && time <= cue.endTime
            )?.text || '';
        }, 200);
    }
    
    // 资源清理
    function cleanup(): void {
        if (subtitleTimer) {
            clearInterval(subtitleTimer);
            subtitleTimer = null;
        }
        
        if (art) {
            try {
                art.pause();
                if (art.dash) {
                    art.dash.destroy();
                    art.dash = null;
                }
                art.destroy(true);
            } catch (e) {
                console.error('清理播放器资源失败:', e);
            } finally {
                art = null;
            }
        }
        
        currentSubtitle = '';
    }
    
    // 更新配置
    function updateConfig(newConfig: any): void {
        if (!art) return;
        
        Object.assign(config, newConfig);
        
        // 更新核心配置
        art.volume = (config.volume || DEFAULT_CONFIG.volume) / 100;
        art.playbackRate = (config.speed || DEFAULT_CONFIG.speed) / 100;
        art.loop = !!config.loopSingle;
        subtitleVisible = config.showSubtitles !== undefined ? config.showSubtitles : true;
    }
    
    // 设置播放时间和循环
    function setPlayTime(start: number, end?: number): void {
        if (!art) return;
        
        try {
            loopCount = 0;
            currentChapter = end !== undefined ? { start, end } : null;
            art.currentTime = start;
            art.play();
        } catch (error) {
            console.error('设置播放时间失败', error);
            showMessage(i18n.player?.error?.setTimeFailed || "设置时间失败");
        }
    }
    
    // 播放媒体
    async function play(url: string, options: PlayOptions = {}): Promise<void> {
        try {
            currentChapter = null;
            loopCount = 0;
            
            let playerConfig: any = {};
            let actualUrl = url;
            
            // B站视频处理
            if (options.biliDash) {
                const mpdUrl = createBiliMPD(options.biliDash);
                if (mpdUrl) {
                    actualUrl = mpdUrl;
                    playerConfig.type = 'mpd';
                    playerConfig.customType = { mpd: playMpd };
                    playerConfig.headers = options.headers;
                }
            }
            
            // 处理弹幕 (统一处理B站和本地弹幕)
            if (config?.enableDanmaku) {
                try {
                    let danmakuUrl = null;
                    if (options.cid) {
                        // B站弹幕
                        danmakuUrl = await DanmakuManager.loadBiliDanmakuUrl(options.cid, config);
                    } else {
                        // 本地弹幕
                        const opts = await DanmakuManager.getDanmakuFileForMedia(url);
                        if (opts) {
                            const list = await DanmakuManager.loadDanmaku(opts.url, opts.type);
                            if (list?.length) danmakuUrl = DanmakuManager.generateDanmakuUrl(list);
                        }
                    }
                    
                    if (danmakuUrl) {
                        playerConfig.plugins = [DanmakuManager.createDanmakuPlugin(danmakuUrl)];
                    }
                } catch (e) {}
            }
            
            // 创建播放器
            art = initPlayer(actualUrl, playerConfig);
            
            // 等待播放器就绪
            await new Promise(resolve => {
                art.on('ready', () => resolve(null));
                if (art.isReady) resolve(null);
            });
            
            // 设置开始时间与循环
            if (options.startTime !== undefined) {
                if (options.isLoop && options.endTime !== undefined) {
                    setPlayTime(options.startTime, options.endTime);
                } else {
                    art.currentTime = options.startTime;
                }
            }
            
            // 确保开始播放
            art.play().catch(() => {});
        } catch (error) {
            console.error("[Player] 播放失败", error);
            showMessage(i18n.player?.error?.playRetry || "播放失败，请重试");
            playerContainer?.dispatchEvent(new CustomEvent('mediaError', {
                detail: { url, options, error }
            }));
        }
    }
    
    // 获取当前播放时间
    function getCurrentTime(): number {
        return art?.currentTime || 0;
    }
    
    // 跳转到指定时间
    function seekTo(time: number): void {
        if (art) art.currentTime = time;
    }
    
    // 暂停播放
    function pause(): void {
        if (art) art.pause();
    }
    
    // 开始播放
    function resume(): void {
        if (art) art.play();
    }
    
    // 获取截图数据URL
    function getScreenshotDataURL(): Promise<string | null> {
        return art ? Promise.resolve(art.getDataURL()) : Promise.resolve(null);
    }
    
    // 设置循环播放
    function setLoop(isLoop, loopTimes) {
        if (art) {
        art.loop = isLoop;
            if (loopTimes !== undefined) config.loopCount = loopTimes;
        }
    }
    
    // 初始化
    function init() {
        if (playerContainer) {
            try { 
                art = initPlayer(); 
            } catch (error) { 
                console.error('初始化播放器失败', error); 
            }
        }
        
        playerContainer?.addEventListener('mediaError', async (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (detail?.error) {
                console.error("[Player] 媒体错误:", detail.error);
                showMessage(i18n.player?.error?.playFailed || "播放失败");
            }
        });
        
        // 直接暴露播放器方法
        Object.assign(api, {
            seekTo, 
            getCurrentTime, 
            getScreenshotDataURL,
            setPlayTime, 
            setLoopSegment: setPlayTime, 
            setLoop,
            updateConfig, 
            pause, 
            resume, 
            play
        });
    }
    
    // 生命周期
    onMount(init);
    onDestroy(cleanup);
</script>

<div class="artplayer-app" bind:this={playerContainer} style="width:100%; height:100%; position:relative; z-index:2;">
    {#if currentSubtitle && subtitleVisible}
        <div class="floating-subtitle">{currentSubtitle}</div>
    {/if}
</div>